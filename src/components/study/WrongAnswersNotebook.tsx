import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Filter,
  Flame,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { QuestionProvenance } from '@/components/study/QuestionProvenance';
import { QuestionSourceBadge } from '@/components/study/QuestionSourceBadge';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion, WrongAnswerRecord } from '@/integrations/supabase/types';
import { getStudyRole, getSubjectsForRole, type StudyRoleId } from '@/lib/constants/subjects';
import { isVerifiedRealQuestion } from '@/lib/question-provenance';
import { getDemoWrongAnswers, removeMasteredDemoWrongAnswers, updateDemoWrongAnswer, type DemoWrongAnswer } from '@/lib/local-storage';
import { answerLetter, questionAnswerDisplay, questionExplanationLabel, questionOptionDetails } from '@/lib/utils';

interface WrongAnswersNotebookProps {
  studyRoleId: StudyRoleId;
  userId?: string;
  onPractice?: (subject?: string) => void;
}

type NotebookRecord = WrongAnswerRecord | DemoWrongAnswer;

export function WrongAnswersNotebook({ studyRoleId, userId, onPractice }: WrongAnswersNotebookProps) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showOnlyUnreviewed, setShowOnlyUnreviewed] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const queryClient = useQueryClient();
  const studyRole = getStudyRole(studyRoleId);
  const roleSubjects = getSubjectsForRole(studyRoleId);
  const roleSubjectNames: string[] = roleSubjects.map((subject) => subject.name);

  const query = useQuery({
    queryKey: ['wrong-answers', userId ?? 'local', studyRoleId],
    queryFn: async (): Promise<NotebookRecord[]> => {
      if (!roleSubjectNames.length) return [];
      if (!isSupabaseConfigured || !userId) return getDemoWrongAnswers()
        .filter((record) => isVerifiedRealQuestion(record.question))
        .filter((record) => roleSubjectNames.includes(record.question.subject))
        .filter((record) => !record.study_role_id || record.study_role_id === studyRoleId);
      const { data, error } = await supabase
        .from('pcpa_wrong_answers')
        .select('*, question:pcpa_questions(*)')
        .eq('user_id', userId)
        .or(`study_role_id.is.null,study_role_id.eq.${studyRoleId}`)
        .in('question.subject', roleSubjectNames)
        .order('attempted_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as (WrongAnswerRecord & { question: PcpaQuestion | null })[])
        .filter((record) => isVerifiedRealQuestion(record.question))
        .filter((record) => roleSubjectNames.includes(record.question.subject))
        .filter((record) => !record.study_role_id || record.study_role_id === studyRoleId) as WrongAnswerRecord[];
    },
  });
  const allRecords = query.data ?? [];
  const records = useMemo(() => allRecords.filter((record) => {
    const matchesSubject = !selectedSubjects.length || selectedSubjects.includes(record.question.subject);
    const matchesReview = !showOnlyUnreviewed || !record.reviewed;
    return matchesSubject && matchesReview;
  }), [allRecords, selectedSubjects, showOnlyUnreviewed]);
  const visibleRecords = records.slice(0, visibleCount);

  const updateRecord = useMutation({
    mutationFn: async ({ record, mastered }: { record: NotebookRecord; mastered: boolean }) => {
      const nextCount = (record.review_count ?? 0) + 1;
      const now = new Date().toISOString();
      if (!isSupabaseConfigured || !userId || record.id.startsWith('demo-')) {
        updateDemoWrongAnswer(record.id, { reviewed: true, mastered, review_count: nextCount, last_reviewed_at: now });
        return;
      }
      const { error } = await supabase.from('pcpa_wrong_answers').update({
        reviewed: true,
        mastered,
        review_count: nextCount,
        last_reviewed_at: now,
        updated_at: now,
      }).eq('id', record.id).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['wrong-answers'] });
      await queryClient.invalidateQueries({ queryKey: ['study-stats'] });
      toast.success(variables.mastered ? 'Questão dominada! 🎯' : 'Questão revisada ✅', { description: variables.mastered ? 'Parabéns. Continue mantendo a revisão em dia.' : 'Uma revisão de cada vez leva à confiança.' });
    },
    onError: () => toast.error('Não foi possível atualizar a revisão', { description: 'Tente novamente em instantes.' }),
  });

  const removeMastered = useMutation({
    mutationFn: async () => {
      const masteredIds = allRecords.filter((record) => record.mastered).map((record) => record.id);
      if (!masteredIds.length) return;
      if (!isSupabaseConfigured || !userId) {
        removeMasteredDemoWrongAnswers(roleSubjectNames, studyRoleId);
        return;
      }
      const { error } = await supabase.from('pcpa_wrong_answers').delete().eq('user_id', userId).in('id', masteredIds);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wrong-answers'] });
      await queryClient.invalidateQueries({ queryKey: ['study-stats'] });
      toast.success('Caderno organizado', { description: 'As questões dominadas foram removidas.' });
    },
    onError: () => toast.error('Não foi possível limpar o caderno', { description: 'Tente novamente em instantes.' }),
  });

  const total = allRecords.length;
  const reviewed = allRecords.filter((record) => record.reviewed).length;
  const mastered = allRecords.filter((record) => record.mastered).length;
  const unreviewed = allRecords.filter((record) => !record.reviewed && !record.mastered).length;
  const reviewProgress = total ? Math.round(reviewed / total * 100) : 0;

  function toggleSubject(subject: string) {
    setVisibleCount(20);
    setSelectedSubjects((previous) => previous.includes(subject) ? previous.filter((item) => item !== subject) : [...previous, subject]);
  }

  if (query.isError) return <Alert className="border-rose-400/20 bg-rose-400/[0.06]"><AlertCircle className="h-4 w-4 text-rose-300" /><AlertTitle className="text-rose-200">Erro ao carregar o caderno</AlertTitle><AlertDescription>Não foi possível atualizar seu caderno agora. Tente novamente mais tarde.</AlertDescription></Alert>;

  return (
    <div className="animate-float-in mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-rose-300"><NotebookIcon /> Revisão inteligente · {studyRole?.label} · {studyRole?.notice}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Caderno de erros</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Cada questão errada é uma pista do que revisar. Este caderno exibe apenas matérias desta trilha; volte ao item, entenda o raciocínio e marque quando dominar.</p></div>
        {mastered > 0 && <Button variant="secondary" onClick={() => removeMastered.mutate()} disabled={removeMastered.isPending}><Trash2 className="h-4 w-4" />Limpar dominadas</Button>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NotebookStat icon={XCircle} label="No caderno" value={total} tint="text-rose-300" accent="bg-rose-400/10" />
        <NotebookStat icon={RotateCcw} label="Para revisar" value={unreviewed} tint="text-amber-200" accent="bg-amber-300/10" />
        <NotebookStat icon={Check} label="Revisadas" value={reviewed} tint="text-cyan-200" accent="bg-cyan-300/10" />
        <NotebookStat icon={Flame} label="Dominadas" value={mastered} tint="text-mint" accent="bg-mint/10" />
      </section>

      <Card className="p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-400/10 text-rose-300"><BookOpen className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-slate-200">Ritmo de revisão</p><p className="mt-0.5 text-[10px] text-slate-500">{reviewed} de {total} questões já revisadas</p></div></div>
          <div className="w-full sm:w-48"><Progress value={reviewProgress} /><p className="mt-1 text-right text-[10px] text-slate-500">{reviewProgress}%</p></div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-200">Questões para retomar</span><Badge variant="secondary">{records.length}</Badge></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white/[0.025] px-3 py-2 text-xs text-slate-400"><input type="checkbox" checked={showOnlyUnreviewed} onChange={(event) => { setVisibleCount(20); setShowOnlyUnreviewed(event.target.checked); }} className="accent-emerald-300" />Só não revisadas</label>
          <Button variant="secondary" size="sm" onClick={() => setShowFilters((value) => !value)}><Filter className="h-3.5 w-3.5" />Matérias{selectedSubjects.length > 0 && <Badge className="ml-1 px-1.5 py-0">{selectedSubjects.length}</Badge>}</Button>
        </div>
      </div>

      {showFilters && <Card className="p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-slate-300">Filtrar por matéria</p><button onClick={() => { setVisibleCount(20); setSelectedSubjects([]); }} className="text-[11px] text-mint hover:underline">Limpar</button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{roleSubjectNames.map((subject) => <label key={subject} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/[0.05] px-2.5 py-2 text-[11px] leading-4 text-slate-400 hover:bg-white/[0.03]"><input type="checkbox" checked={selectedSubjects.includes(subject)} onChange={() => toggleSubject(subject)} className="mt-0.5 accent-emerald-300" /><span>{subject}</span></label>)}</div></Card>}

      {query.isLoading ? <Card className="grid place-items-center p-12"><LoaderCircle className="h-6 w-6 animate-spin text-mint" /><span className="mt-3 text-xs text-slate-500">Carregando revisões…</span></Card> : records.length === 0 ? (
        <Card className="grid min-h-64 place-items-center p-8 text-center">
          <div className="max-w-md"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-mint/15 bg-mint/[0.05] text-mint"><CheckCheck className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-semibold text-white">{total === 0 ? 'Seu caderno está pronto' : 'Tudo em dia nesta seleção'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{total === 0 ? 'Quando uma resposta estiver incorreta, ela será adicionada automaticamente aqui para você revisar.' : 'Ajuste os filtros ou pratique novas questões para continuar seu ciclo de revisão.'}</p>{onPractice && <Button variant="secondary" className="mt-5" onClick={() => onPractice()}><Sparkles className="h-4 w-4" />Praticar questões</Button>}</div>
        </Card>
      ) : <div className="space-y-3">{visibleRecords.map((record, index) => <WrongQuestionCard key={record.id} record={record} number={index + 1} expanded={expanded === record.id} onToggle={() => setExpanded((value) => value === record.id ? null : record.id)} onReviewed={() => updateRecord.mutate({ record, mastered: false })} onMastered={() => updateRecord.mutate({ record, mastered: true })} onPractice={() => onPractice?.(record.question.subject)} busy={updateRecord.isPending} />)}</div>}
      {records.length > visibleRecords.length && <div className="flex justify-center"><Button variant="secondary" className="w-full sm:w-auto" onClick={() => setVisibleCount((count) => count + 20)}>Carregar mais questões ({records.length - visibleRecords.length} restantes)</Button></div>}

      <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Sparkles className="h-4 w-4" /></span><p className="text-xs leading-5 text-slate-400"><strong className="font-semibold text-cyan-100">Ciclo de aprendizagem:</strong> responda, entenda o motivo do erro, revise mais tarde e marque como dominada quando conseguir explicar o conceito sem consultar o gabarito.</p></div>
    </div>
  );
}

function NotebookIcon() { return <BookOpen className="h-3.5 w-3.5" />; }

function NotebookStat({ icon: Icon, label, value, tint, accent }: { icon: typeof BookOpen; label: string; value: number; tint: string; accent: string }) {
  return <Card className="p-4"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-medium text-slate-500">{label}</p><span className={`grid h-8 w-8 place-items-center rounded-xl ${accent} ${tint}`}><Icon className="h-4 w-4" /></span></div><p className={`mt-3 text-2xl font-semibold ${tint}`}>{value}</p></Card>;
}

function WrongQuestionCard({ record, number, expanded, onToggle, onReviewed, onMastered, onPractice, busy }: {
  record: NotebookRecord; number: number; expanded: boolean; onToggle: () => void; onReviewed: () => void; onMastered: () => void; onPractice: () => void; busy: boolean;
}) {
  const question = record.question;
  const wrongChoice = answerLetter(record.wrong_answer);
  const correctChoice = answerLetter(question.answer);
  return <Card className="overflow-hidden transition-colors hover:border-white/[0.12]">
    <button onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left md:gap-4 md:p-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-400/15 bg-rose-400/[0.06] text-sm font-semibold text-rose-300">{String(number).padStart(2, '0')}</span>
      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><SubjectBadge subject={question.subject} /><QuestionSourceBadge source={question.source} metadata={question.metadata} />{record.mastered && <Badge className="border-mint/20 bg-mint/10 text-mint">Dominada</Badge>}</span><span className="mt-3 block line-clamp-2 text-sm font-medium leading-6 text-slate-200">{question.prompt}</span><span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>Sua resposta: <strong className="text-rose-300">{questionAnswerDisplay(question.type, record.wrong_answer)}</strong></span><span>Gabarito: <strong className="text-mint">{questionAnswerDisplay(question.type, question.answer)}</strong></span><span>{record.review_count} {record.review_count === 1 ? 'revisão' : 'revisões'}</span></span></span>
      <span className="mt-1 text-slate-500">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
    </button>
    {expanded && <div className="border-t border-white/[0.055] px-4 pb-4 pt-4 md:px-5 md:pb-5">
      <QuestionProvenance question={question} showOfficialAnswer className="mb-4" />
      {question.needs_verification && <Alert className="mb-4 border-amber-400/20 bg-amber-400/[0.045] p-3"><AlertCircle className="h-4 w-4 text-amber-300" /><AlertDescription className="text-xs text-amber-100/80">⚠️ Verificar Lei Seca: confirme os dispositivos em fonte oficial atualizada.</AlertDescription></Alert>}
      <div className="space-y-2">{question.options.map((option, index) => { const details = questionOptionDetails(question.type, option, index); const value = details.value; const isWrong = value === wrongChoice; const isAnswer = value === correctChoice; return <div key={`${value}-${option}`} className={`rounded-xl border px-3 py-2.5 text-xs leading-5 ${isAnswer ? 'border-mint/20 bg-mint/[0.045] text-mint' : isWrong ? 'border-rose-400/20 bg-rose-400/[0.04] text-rose-200' : 'border-white/[0.04] text-slate-400'}`}><span className="mr-2 font-bold">{details.label}.</span>{details.text}{isWrong && <span className="ml-2 text-[9px] uppercase text-rose-300">Sua resposta</span>}{isAnswer && <span className="ml-2 text-[9px] uppercase text-mint">Gabarito</span>}</div>; })}</div>
      <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{questionExplanationLabel(question.metadata)}</p><p className="mt-2 text-xs leading-6 text-slate-300">{question.gabarito_comentado}</p>{question.ponto_de_atencao && <p className="mt-3 border-t border-white/[0.05] pt-3 text-xs leading-5 text-amber-100/70"><strong className="text-amber-200">Ponto de atenção:</strong> {question.ponto_de_atencao}</p>}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={onPractice}><RotateCcw className="h-3.5 w-3.5" />Tentar novamente</Button>{!record.reviewed && <Button size="sm" variant="outline" onClick={onReviewed} disabled={busy}><Check className="h-3.5 w-3.5" />Marcar revisada</Button>}{!record.mastered && <Button size="sm" onClick={onMastered} disabled={busy}>{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" />}Dominei</Button>}</div>
    </div>}
  </Card>;
}
