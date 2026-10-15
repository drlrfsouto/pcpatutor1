import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CircleHelp,
  Clock3,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { QuestionSourceBadge } from '@/components/study/QuestionSourceBadge';
import { cleanLegalCommentary, LegalReferenceNote } from '@/components/study/LegalReferenceNote';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { getSubjectsForRole, getStudyRole, isSubjectInRole, type StudyRoleId } from '@/lib/constants/subjects';
import { loadAIFlashcardProgress, loadAIGeneratedQuestions, recordAIFlashcardReview, type AIFlashcardProgress } from '@/lib/ai-study-data';
import { answerLetter, questionAnswerDisplay, questionOptionDetails } from '@/lib/utils';
import { generateAIQuestionBatch } from '@/lib/ai-questions';

interface FlashcardSessionProps { studyRoleId: StudyRoleId; userId?: string }
type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADE_CONFIG: { grade: Grade; label: string; hint: string; quality: number; className: string }[] = [
  { grade: 'again', label: 'Errei', hint: 'Rever em 1 dia', quality: 1, className: 'border-rose-400/20 bg-rose-400/[0.05] text-rose-200 hover:bg-rose-400/10' },
  { grade: 'hard', label: 'Difícil', hint: 'Rever em breve', quality: 3, className: 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100 hover:bg-amber-300/10' },
  { grade: 'good', label: 'Lembrei', hint: 'Intervalo normal', quality: 4, className: 'border-cyan-300/20 bg-cyan-300/[0.05] text-cyan-100 hover:bg-cyan-300/10' },
  { grade: 'easy', label: 'Fácil', hint: 'Aumentar intervalo', quality: 5, className: 'border-mint/20 bg-mint/[0.05] text-mint hover:bg-mint/10' },
];

function getDueDeck(deck: PcpaQuestion[], progress: Record<string, AIFlashcardProgress>) {
  const now = Date.now();
  return deck.filter((question) => !progress[question.id] || new Date(progress[question.id].next_review_date).getTime() <= now);
}

export function FlashcardSession({ studyRoleId, userId }: FlashcardSessionProps) {
  const studyRole = getStudyRole(studyRoleId);
  const roleSubjects = getSubjectsForRole(studyRoleId);
  const initialSubject = roleSubjects[0]?.name ?? '';
  const [subject, setSubject] = useState<string>(initialSubject);
  const [cardCount, setCardCount] = useState(10);
  const [deck, setDeck] = useState<PcpaQuestion[]>([]);
  const [sessionDeck, setSessionDeck] = useState<PcpaQuestion[]>([]);
  const [progressByQuestion, setProgressByQuestion] = useState<Record<string, AIFlashcardProgress>>({});
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [loadError, setLoadError] = useState('');
  const reviewIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
    setCompleted(false);
    if (!isSupabaseConfigured || !userId) {
      setDeck([]);
      setSessionDeck([]);
      setProgressByQuestion({});
      setLoadingDeck(false);
      setLoadError('');
      return () => { active = false; };
    }

    setLoadingDeck(true);
    setLoadError('');
    Promise.all([
      loadAIGeneratedQuestions(studyRoleId, 'flashcards', subject, 500),
      loadAIFlashcardProgress(studyRoleId),
    ]).then(([savedDeck, savedProgress]) => {
      if (!active) return;
      setDeck(savedDeck);
      setProgressByQuestion(savedProgress);
      setSessionDeck(getDueDeck(savedDeck, savedProgress));
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : 'Não foi possível carregar seus flashcards.';
      setLoadError(message);
      setDeck([]);
      setSessionDeck([]);
    }).finally(() => {
      if (active) setLoadingDeck(false);
    });
    return () => { active = false; };
  }, [studyRoleId, subject, userId]);

  useEffect(() => {
    reviewIdRef.current = null;
  }, [sessionDeck[index]?.id, index]);

  const card = sessionDeck[index];
  const answerOption = card ? card.options.map((option, optionIndex) => questionOptionDetails(card.type, option, optionIndex)).find((option) => option.value === answerLetter(card.answer))?.text : undefined;

  async function generateDeck() {
    if (!isSupabaseConfigured || !userId) {
      toast.error(!isSupabaseConfigured ? 'Supabase desconectado' : 'Entre na sua conta', {
        description: 'A geração de flashcards autorais exige uma conta aprovada e o serviço protegido do Supabase.',
      });
      return;
    }
    if (!subject || !isSubjectInRole(studyRoleId, subject)) {
      toast.error('Escolha uma matéria da trilha ativa.');
      return;
    }
    setGenerating(true);
    try {
      const questions = await generateAIQuestionBatch({
        role: studyRoleId,
        subject,
        topic: 'geral',
        difficulty: 'intermediaria',
        count: cardCount,
        format: 'mista',
        activity: 'flashcards',
      });
      if (!questions.length) throw new Error('A IA não retornou cartões válidos para esta seleção.');
      const [savedDeck, savedProgress] = await Promise.all([
        loadAIGeneratedQuestions(studyRoleId, 'flashcards', subject, 500),
        loadAIFlashcardProgress(studyRoleId),
      ]);
      setDeck(savedDeck);
      setProgressByQuestion(savedProgress);
      setSessionDeck(getDueDeck(savedDeck, savedProgress));
      setIndex(0);
      setFlipped(false);
      setReviewed(0);
      setCompleted(false);
    } catch (error) {
      toast.error('Não foi possível gerar os flashcards', { description: error instanceof Error ? error.message : 'Tente novamente em instantes.' });
    } finally {
      setGenerating(false);
    }
  }

  async function rateCard(quality: number) {
    if (!card || savingReview) return;
    const previous = progressByQuestion[card.id] ?? { question_id: card.id, repetitions: 0, ease_factor: 2.5, interval_days: 0, next_review_date: new Date().toISOString() };
    let repetitions = previous.repetitions;
    let intervalDays: number;
    let easeFactor = previous.ease_factor;
    if (quality < 3) {
      repetitions = 0;
      intervalDays = 1;
    } else {
      if (repetitions === 0) intervalDays = 1;
      else if (repetitions === 1) intervalDays = 6;
      else intervalDays = Math.max(1, Math.round(previous.interval_days * easeFactor));
      repetitions += 1;
      easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    }
    const next = new Date();
    next.setDate(next.getDate() + intervalDays);
    const progress: AIFlashcardProgress = { question_id: card.id, repetitions, ease_factor: easeFactor, interval_days: intervalDays, next_review_date: next.toISOString() };
    reviewIdRef.current ??= crypto.randomUUID();
    setSavingReview(true);
    try {
      await recordAIFlashcardReview({ questionId: card.id, role: studyRoleId, quality, progress, reviewId: reviewIdRef.current });
      setProgressByQuestion((current) => ({ ...current, [card.id]: progress }));
      setReviewed((value) => value + 1);
      setFlipped(false);
      reviewIdRef.current = null;
      if (index + 1 >= sessionDeck.length) setCompleted(true);
      else setIndex((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar esta revisão.');
    } finally {
      setSavingReview(false);
    }
  }

  function resetSession() {
    setSessionDeck(getDueDeck(deck, progressByQuestion));
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
    setCompleted(false);
  }

  const progressPercent = sessionDeck.length ? Math.min(index + (completed ? 1 : 0), sessionDeck.length) / sessionDeck.length * 100 : 0;

  return (
    <div className="animate-float-in mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-300"><BrainCircuit className="h-3.5 w-3.5" /> Repetição espaçada · {studyRole?.label} · {studyRole?.notice}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Flashcards</h1><p className="mt-2 text-sm leading-6 text-slate-400">Cartões autorais de IA · progresso sincronizado com sua conta.</p></div><Badge variant="secondary" className="gap-1.5"><Clock3 className="h-3.5 w-3.5 text-cyan-200" />SM-2 · conta</Badge></div>

      <Card className="grid gap-3 p-4 sm:grid-cols-[1fr_150px_auto] sm:items-end md:p-5">
        <label><span className="mb-1.5 block text-xs font-semibold text-slate-400">Matéria — {studyRole?.label}</span><select className="field-select" value={subject} disabled={generating || loadingDeck || savingReview} onChange={(event) => setSubject(event.target.value)}><option value="">Selecione uma matéria</option>{roleSubjects.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <label><span className="mb-1.5 block text-xs font-semibold text-slate-400">Quantidade</span><select className="field-select" value={cardCount} disabled={generating || loadingDeck || savingReview} onChange={(event) => setCardCount(Number(event.target.value))}><option value={5}>5 cartões</option><option value={10}>10 cartões</option><option value={20}>20 cartões</option></select></label>
        <Button onClick={() => void generateDeck()} disabled={generating || loadingDeck || !isSupabaseConfigured || !userId || !subject}>{generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{generating ? 'Gerando…' : deck.length ? 'Gerar novo baralho' : 'Gerar baralho'}</Button>
        {isSupabaseConfigured && !userId && <p className="text-[10px] leading-4 text-slate-500 sm:col-span-3">Entre com uma conta aprovada para gerar cartões.</p>}
      </Card>

      {generating || loadingDeck ? <div role="status" className="flex items-center gap-2 px-1 py-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-violet-200" />{generating ? 'Gerando cartões…' : 'Carregando cartões e progresso sincronizados…'}</div> : !deck.length ? <Card className="grid min-h-72 place-items-center p-8 text-center"><div className="max-w-md"><BrainCircuit className="mx-auto h-8 w-8 text-violet-300" /><h2 className="mt-4 text-lg font-semibold text-white">Seu baralho de IA está vazio</h2><p className="mt-2 text-sm leading-6 text-slate-500">{loadError || (!isSupabaseConfigured ? 'Conecte o Supabase para carregar os materiais salvos.' : !userId ? 'Entre em uma conta aprovada para carregar ou gerar cartões.' : 'Escolha uma matéria e gere seu baralho.')}</p></div></Card> : !sessionDeck.length ? <Card className="grid min-h-72 place-items-center p-8 text-center"><div className="max-w-md"><Clock3 className="mx-auto h-8 w-8 text-cyan-200" /><h2 className="mt-4 text-lg font-semibold text-white">Revisão em dia</h2><p className="mt-2 text-sm leading-6 text-slate-500">Nenhum cartão vencido. Próximas revisões sincronizadas com sua conta.</p></div></Card> : !card ? null : <>
        <Card className="p-4 md:p-5"><div className="flex items-center justify-between text-xs text-slate-400"><span>Cartão {Math.min(index + 1, sessionDeck.length)} de {sessionDeck.length}</span><span>{reviewed} revisados nesta sessão</span></div><Progress value={progressPercent} className="mt-3 h-1.5" /></Card>

        {completed ? <Card className="grid min-h-[430px] place-items-center overflow-hidden p-8 text-center"><div className="max-w-md"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint/10 text-mint"><Check className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-semibold text-white">Revisão concluída!</h2><p className="mt-2 text-sm leading-6 text-slate-400">Você revisou {reviewed} {reviewed === 1 ? 'cartão' : 'cartões'}. Próximas revisões sincronizadas com sua conta.</p><div className="mt-6 flex justify-center"><Button onClick={resetSession}><RotateCcw className="h-4 w-4" />Recomeçar</Button></div></div></Card> : <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-5 py-3"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={card.subject} /><QuestionSourceBadge source={card.source} /></div><span className="text-[10px] text-slate-500">{card.topic}</span></div>
          <button onClick={() => setFlipped((value) => !value)} className="group flex min-h-[350px] w-full flex-col items-center justify-center px-6 py-10 text-center transition-colors hover:bg-white/[0.012] md:min-h-[390px] md:px-12">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{flipped ? <><Sparkles className="h-3 w-3 text-mint" /> Resposta IA</> : <><CircleHelp className="h-3 w-3 text-violet-300" /> Lembre antes de virar</>}</span>
            {!flipped ? <><h2 className="max-w-2xl text-xl font-medium leading-8 text-white md:text-2xl">{card.flashcard_summary || card.prompt}</h2><p className="mt-5 text-xs text-slate-500">Clique para revelar a resposta</p></> : <div className="max-w-2xl animate-float-in"><p className="text-lg font-semibold text-mint">{answerOption || questionAnswerDisplay(card.type, card.answer)}</p><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Comentário didático de IA</p><p className="mt-1 text-sm leading-7 text-slate-300">{cleanLegalCommentary(card.gabarito_comentado)}</p><LegalReferenceNote question={card} /></div>}
            <span className="mt-8 inline-flex items-center gap-1.5 text-xs text-violet-200/70 group-hover:text-violet-100">{flipped ? 'Voltar ao enunciado' : 'Ver resposta'} <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>
          <div className="border-t border-white/[0.055] p-4 md:px-6">{!flipped ? <Button variant="secondary" className="w-full" onClick={() => setFlipped(true)}><RotateCcw className="h-4 w-4" />Revelar resposta</Button> : <div><p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Como foi a lembrança?</p>{savingReview && <p role="status" className="mb-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><LoaderCircle className="h-3 w-3 animate-spin" />Salvando progresso…</p>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{GRADE_CONFIG.map((item) => <button key={item.grade} onClick={() => void rateCard(item.quality)} disabled={savingReview} className={`rounded-xl border px-3 py-3 text-left transition ${item.className}`}><span className="block text-xs font-semibold">{item.label}</span><span className="mt-1 block text-[9px] opacity-65">{item.hint}</span></button>)}</div></div>}</div>
        </Card>}

        {!completed && <div className="flex items-center justify-between"><button onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false); }} disabled={index === 0} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" />Anterior</button><div className="flex items-center gap-1.5 text-[10px] text-slate-600"><Zap className="h-3 w-3 text-amber-200" />O algoritmo sincroniza a próxima revisão na conta</div><button onClick={() => { setIndex((value) => Math.min(sessionDeck.length - 1, value + 1)); setFlipped(false); }} disabled={index >= sessionDeck.length - 1} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 disabled:opacity-30">Próximo<ArrowRight className="h-3.5 w-3.5" /></button></div>}
      </>}
    </div>
  );
}
