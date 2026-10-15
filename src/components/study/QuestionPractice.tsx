import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { QuestionSourceBadge } from '@/components/study/QuestionSourceBadge';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import type { PcpaQuestion, QuestionDifficulty } from '@/integrations/supabase/types';
import {
  getPriorityLabel,
  getRoleSubject,
  getStudyRole,
  getSubjectsForRole,
  isSubjectInRole,
  type StudyRoleId,
  type SubjectName,
} from '@/lib/constants/subjects';
import { answerLetter, questionAnswerDisplay, questionExplanationLabel, questionOptionDetails } from '@/lib/utils';
import { generateAIQuestionBatch } from '@/lib/ai-questions';

const DIFFICULTIES: { value: QuestionDifficulty; label: string }[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'intermediaria', label: 'Intermediária' },
  { value: 'dificil', label: 'Difícil' },
];

const GENERATION_STAGES = [
  'Lendo o escopo do edital da trilha…',
  'Considerando sinais agregados disponíveis de provas anteriores…',
  'Criando itens originais por IA…',
  'Validando matéria, formato e quantidade…',
];

interface SearchSummary {
  ai_generated_questions?: number;
  message?: string;
}

function shuffleQuestions(values: PcpaQuestion[]) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function getFunctionErrorMessage(error: unknown): Promise<string | undefined> {
  if (!error || typeof error !== 'object') return error instanceof Error ? error.message : undefined;
  const context = 'context' in error ? (error as { context?: unknown }).context : undefined;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: unknown; message?: unknown };
      if (typeof payload?.error === 'string') return payload.error.slice(0, 240);
      if (typeof payload?.message === 'string') return payload.message.slice(0, 240);
    } catch {
      // A missing function or proxy error may return non-JSON text.
    }
    return `A função respondeu com HTTP ${context.status}.`;
  }
  const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
  return typeof message === 'string' && message.trim() ? message.slice(0, 240) : undefined;
}

interface QuestionPracticeProps {
  studyRoleId: StudyRoleId;
  initialSubject?: SubjectName;
  userId?: string;
  onAskTutor: (question: PcpaQuestion) => void;
}

export function QuestionPractice({ studyRoleId, initialSubject, userId, onAskTutor }: QuestionPracticeProps) {
  const [subject, setSubject] = useState<string>(initialSubject ?? '');
  const [sessionQuestions, setSessionQuestions] = useState<PcpaQuestion[]>([]);
  const [difficulty, setDifficulty] = useState<string>('');
  const [topic, setTopic] = useState('geral');
  const [questionCount, setQuestionCount] = useState(5);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [searchStageIndex, setSearchStageIndex] = useState(0);
  const [searchSummary, setSearchSummary] = useState<SearchSummary | null>(null);
  const lastInitialSubject = useRef(initialSubject);
  const studyRole = getStudyRole(studyRoleId);
  const roleSubjects = getSubjectsForRole(studyRoleId);
  const selectedSubjectProfile = getRoleSubject(studyRoleId, subject);
  const progressStages = GENERATION_STAGES;

  useEffect(() => {
    if (initialSubject && lastInitialSubject.current !== initialSubject) {
      setSubject(initialSubject);
      setQuestionIndex(0);
      setHasAnswered(false);
      setSelectedAnswer('');
      lastInitialSubject.current = initialSubject;
    }
  }, [initialSubject]);

  useEffect(() => {
    if (subject && !isSubjectInRole(studyRoleId, subject)) {
      setSubject(initialSubject && isSubjectInRole(studyRoleId, initialSubject) ? initialSubject : '');
    }
  }, [studyRoleId, subject, initialSubject]);

  useEffect(() => {
    if (!generating) {
      setSearchStageIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSearchStageIndex((current) => (current + 1) % progressStages.length);
    }, 2300);
    return () => window.clearInterval(timer);
  }, [generating, progressStages.length]);

  const questions = sessionQuestions;
  const question = questions.length ? questions[questionIndex % questions.length] : undefined;
  const correct = question ? answerLetter(question.answer) === answerLetter(selectedAnswer) : false;

  useEffect(() => {
    setQuestionIndex(0);
    setHasAnswered(false);
    setSelectedAnswer('');
    setSessionQuestions([]);
    setSearchSummary(null);
  }, [studyRoleId, subject, topic, difficulty]);

  const answerOptions = useMemo(() => question
    ? question.options.map((option, index) => ({ ...questionOptionDetails(question.type, option, index), original: option }))
    : [], [question]);

  function clearPracticeSession() {
    setSessionQuestions([]);
    setSearchSummary(null);
    setQuestionIndex(0);
    setHasAnswered(false);
    setSelectedAnswer('');
  }

  async function generateQuestions() {
    if (!isSupabaseConfigured) {
      toast.error('Geração indisponível', { description: 'Conecte o Supabase para gerar questões com segurança.' });
      return;
    }
    if (!userId) {
      toast.error('Entre na sua conta', { description: 'A geração de questões exige uma conta aprovada.' });
      return;
    }
    if (!studyRole || !subject || !isSubjectInRole(studyRoleId, subject)) {
      toast.error('Escolha uma matéria da trilha ativa', { description: `Selecione uma matéria prevista para ${studyRole?.label ?? 'o cargo'} no edital ${studyRole?.notice ?? 'selecionado'}.` });
      return;
    }

    setGenerating(true);
    setSearchStageIndex(0);
    setSearchSummary(null);
    setSessionQuestions([]);
    try {
      const generatedQuestions = await generateAIQuestionBatch({
        role: studyRoleId,
        subject,
        topic: topic.trim() || 'geral',
        difficulty: difficulty || 'intermediaria',
        count: questionCount,
        format: 'mista',
      });
      const session = shuffleQuestions(generatedQuestions).slice(0, questionCount);
      setSessionQuestions(session);
      setSearchSummary({
        ai_generated_questions: session.length,
        message: session.length === questionCount
          ? `${session.length} item(ns) autoral(is) criado(s) com base no edital e nos sinais agregados compatíveis disponíveis para esta matéria. Os itens são identificados como IA; não são questões reais e não entram no banco oficial, nas estatísticas reais ou no caderno de erros.`
          : `A IA gerou ${session.length} de ${questionCount} item(ns) solicitados. As questões são autorais, identificadas como IA e não são registradas como desempenho real.`,
      });
      setQuestionIndex(0);
      setHasAnswered(false);
      setSelectedAnswer('');
      if (session.length) {
        toast.success(`${session.length} questão(ões) autoral(is) prontas.`);
      } else {
        toast.info('A IA não retornou questões válidas para esta seleção. Tente novamente ou escolha outro tópico.');
      }
    } catch (error) {
      const diagnostic = await getFunctionErrorMessage(error);
      toast.error('As questões não puderam ser geradas', {
        description: diagnostic || 'Tente novamente. O app não usa questões reais nem exibe referências oficiais nesta prática.',
      });
    } finally {
      setGenerating(false);
    }
  }

  function submitAnswer() {
    if (!question || !selectedAnswer || hasAnswered) return;
    setHasAnswered(true);
  }

  function nextQuestion() {
    if (!questions.length) return;
    setQuestionIndex((index) => (index + 1) % questions.length);
    setSelectedAnswer('');
    setHasAnswered(false);
  }

  return (
    <div className="animate-float-in mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-mint"><Target className="h-3.5 w-3.5" /> Prática direcionada</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Gerar questões</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Questões autorais de IA, orientadas pelo edital e, quando houver, por sinais agregados compatíveis de provas anteriores. Nenhum enunciado real é exibido na prática.</p><p className="mt-2 text-[11px] font-medium text-cyan-200/80">{studyRole?.label} · Edital {studyRole?.notice} · {roleSubjects.length} matérias separadas para esta trilha</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.025] px-3 py-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${!isSupabaseConfigured ? 'bg-amber-300' : 'bg-mint'}`} />{!isSupabaseConfigured ? 'Supabase desconectado' : 'Itens autorais identificados como IA'}</div>
      </div>

      <Card>
        <div className="flex items-start gap-3 border-b border-white/[0.055] p-5 md:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Search className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-100">Defina o que quer praticar</h2><p className="mt-1 text-xs text-slate-500">A IA cria itens novos conforme o escopo do edital e, quando disponíveis para a trilha, sinais agregados de matéria, tópico e formato. O app não exibe nem aplica enunciados reais ou listas de fontes.</p></div>
          <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex"><ShieldCheck className="h-3 w-3 text-violet-200" />Questões autorais por IA</Badge>
        </div>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Matéria — {studyRole?.label}</span><select className="field-select" value={subject} disabled={generating} onChange={(event) => { setSubject(event.target.value); setTopic('geral'); }}><option value="">Selecione uma matéria desta trilha</option>{roleSubjects.map((item) => { const profile = getRoleSubject(studyRoleId, item.name); const share = studyRole && profile ? Math.round(profile.points / studyRole.total_points * 100) : 0; return <option key={item.name} value={item.name}>{item.name} · {profile ? getPriorityLabel(profile.relative_priority) : ''} · {share}%</option>; })}</select></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Tópico do edital</span><select className="field-select" value={topic} disabled={generating || !subject} onChange={(event) => { setTopic(event.target.value); clearPracticeSession(); }}><option value="geral">Programa completo da matéria</option>{selectedSubjectProfile?.topics.map((item) => <option key={item.name} value={item.name}>{item.name} · prioridade {getPriorityLabel(item.relative_priority).toLowerCase()}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Dificuldade</span><select className="field-select" value={difficulty} disabled={generating} onChange={(event) => setDifficulty(event.target.value)}><option value="">Todas</option>{DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Questões</span><select className="field-select" value={questionCount} disabled={generating} onChange={(event) => { setQuestionCount(Number(event.target.value)); clearPracticeSession(); }}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select></label>
          <Button onClick={generateQuestions} disabled={generating || !isSupabaseConfigured || !userId || !subject} className="w-full xl:min-w-40">{generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{generating ? 'Gerando questões…' : 'Gerar questões'}</Button>
          {!isSupabaseConfigured && <p className="text-[10px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-3">Conecte o Supabase para gerar itens autorais com segurança. A chave de IA permanece no servidor.</p>}
          {isSupabaseConfigured && !userId && <p className="text-[10px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-3">Entre com uma conta aprovada para gerar questões autorais, identificadas como IA e fora das estatísticas reais.</p>}
        </CardContent>
        {selectedSubjectProfile && <div className="border-t border-white/[0.05] px-5 py-3 md:px-6"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]"><span className="font-semibold text-cyan-200">Prioridade {getPriorityLabel(selectedSubjectProfile.relative_priority)}</span><span className="text-slate-500">{selectedSubjectProfile.question_count} questões · {selectedSubjectProfile.points} pontos no edital</span><span className="text-slate-500">Tópicos ordenados como orientação relativa, não previsão</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Escopo do edital: {selectedSubjectProfile.scope_summary}</p></div>}
      </Card>

      {generating && <div role="status" aria-live="polite" aria-atomic="true" className="animate-float-in overflow-hidden rounded-2xl border border-cyan-300/15 bg-gradient-to-r from-cyan-300/[0.06] via-emerald-300/[0.035] to-cyan-300/[0.06] p-4 shadow-[0_12px_50px_rgba(34,211,238,0.045)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-200"><span className="absolute inset-0 rounded-xl bg-cyan-300/10 animate-pulse" /><LoaderCircle className="relative h-5 w-5 animate-spin" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cyan-100">{progressStages[searchStageIndex]}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">A geração usa o escopo do edital e, quando há comparação compatível com a trilha, tendências agregadas por matéria e tópico. A IA cria itens autorais; nenhum enunciado real ou link de fonte é exibido, e a quantidade não excede a solicitada.</p>
          </div>
          <span className="hidden items-end gap-1 pt-2 sm:flex" aria-hidden="true"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-.3s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-.15s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200" /></span>
        </div>
      </div>}

      {searchSummary && <Alert className={searchSummary.ai_generated_questions ? 'border-violet-300/20 bg-violet-300/[0.045]' : 'border-amber-300/20 bg-amber-300/[0.045]'}>
        <ShieldCheck className={`h-4 w-4 ${searchSummary.ai_generated_questions ? 'text-violet-200' : 'text-amber-200'}`} />
        <AlertTitle className={searchSummary.ai_generated_questions ? 'text-violet-100' : 'text-amber-100'}>{searchSummary.ai_generated_questions ? `Sessão pronta: ${searchSummary.ai_generated_questions} item(ns) autoral(is) por IA` : 'Nenhuma questão pôde ser gerada'}</AlertTitle>
        <AlertDescription>{searchSummary.message}</AlertDescription>
      </Alert>}

      {generating ? null : question ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={question.subject} /><QuestionSourceBadge source={question.source} />{question.topic && <Badge variant="secondary">{question.topic}</Badge>}</div><span className="text-xs tabular-nums text-slate-500">Questão {questionIndex + 1} de {questions.length}</span></div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-3 md:px-7"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="font-semibold text-slate-300">{question.difficulty === 'facil' ? 'Fácil' : question.difficulty === 'dificil' ? 'Difícil' : 'Intermediária'}</span><span className="h-1 w-1 rounded-full bg-slate-600" />{question.type === 'multipla_escolha' ? 'Múltipla escolha' : question.type === 'certo_errado' ? 'Certo ou Errado' : question.type}</div><div className="flex items-center gap-2"><span className="rounded-lg bg-white/[0.035] px-2 py-1 text-[10px] text-slate-500">{question.type === 'certo_errado' ? 'Julgamento C/E' : 'Resposta única'}</span><button onClick={() => { setHasAnswered(false); setSelectedAnswer(''); }} title="Limpar resposta" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button></div></div>
            <CardContent className="p-5 md:p-7">
              {question.needs_verification && <Alert className="mb-5 border-amber-400/20 bg-amber-400/[0.055] p-3"><AlertTriangle className="h-4 w-4 text-amber-300" /><AlertDescription className="text-xs text-amber-100/80"><strong className="text-amber-200">⚠️ Verificar Lei Seca.</strong> Confirme os dispositivos citados no texto legal atualizado em fonte oficial antes de memorizar.</AlertDescription></Alert>}
              <h2 className="max-w-3xl whitespace-pre-line text-base font-medium leading-7 text-slate-100 md:text-lg md:leading-8">{question.prompt}</h2>
              
              <div className="mt-6 space-y-2.5">
                {answerOptions.map((option) => {
                  const isSelected = selectedAnswer === option.value;
                  const isCorrectOption = answerLetter(question.answer) === option.value;
                  const showCorrect = hasAnswered && isCorrectOption;
                  const showWrong = hasAnswered && isSelected && !correct;
                  return <button key={`${option.value}-${option.text}`} onClick={() => !hasAnswered && setSelectedAnswer(option.value)} disabled={hasAnswered} className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${showCorrect ? 'border-mint/35 bg-mint/[0.07]' : showWrong ? 'border-rose-400/30 bg-rose-400/[0.06]' : isSelected ? 'border-cyan-300/30 bg-cyan-300/[0.055]' : 'border-white/[0.07] bg-white/[0.015] hover:border-white/[0.14] hover:bg-white/[0.035]'}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-[10px] font-bold ${showCorrect ? 'border-mint/30 bg-mint/15 text-mint' : showWrong ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : isSelected ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200' : 'border-white/10 bg-white/[0.035] text-slate-500 group-hover:text-slate-200'}`}>{showCorrect ? <Check className="h-3.5 w-3.5" /> : showWrong ? <X className="h-3.5 w-3.5" /> : option.label}</span>
                    <span className={`pt-0.5 text-sm leading-6 ${showCorrect ? 'text-mint' : showWrong ? 'text-rose-200' : 'text-slate-300'}`}>{option.text}</span>
                    {showCorrect && <CheckCircle2 className="ml-auto mt-1 h-4 w-4 shrink-0 text-mint" />}
                  </button>;
                })}
              </div>

              {hasAnswered && <div className={`mt-5 rounded-2xl border p-4 md:p-5 ${correct ? 'border-mint/20 bg-mint/[0.045]' : 'border-rose-400/15 bg-rose-400/[0.04]'}`}>
                <div className="flex items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${correct ? 'bg-mint/10 text-mint' : 'bg-rose-400/10 text-rose-300'}`}>{correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${correct ? 'text-mint' : 'text-rose-200'}`}>{correct ? 'Boa! Resposta correta.' : `A resposta correta é ${questionAnswerDisplay(question.type, question.answer)}.`}</p><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{questionExplanationLabel(question.metadata)}</p><p className="mt-1 text-sm leading-6 text-slate-300">{question.gabarito_comentado}</p>{question.ponto_de_atencao && <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.035] p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-amber-200">Ponto de atenção</p><p className="mt-1 text-xs leading-5 text-slate-400">{question.ponto_de_atencao}</p></div>}</div></div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4"><Button size="sm" onClick={nextQuestion}><ArrowRight className="h-3.5 w-3.5" />Próxima questão</Button><Button size="sm" variant="secondary" onClick={() => onAskTutor(question)}><CircleHelp className="h-3.5 w-3.5" />Perguntar ao tutor</Button></div>
              </div>}

              {!hasAnswered && <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{question.source === 'ai_generated' ? 'Item autoral por IA: sua resposta não altera estatísticas reais nem o caderno de erros.' : question.type === 'certo_errado' ? 'Marque Certo ou Errado para registrar sua resposta.' : 'Selecione uma alternativa para registrar sua resposta.'}</p><Button onClick={submitAnswer} disabled={!selectedAnswer} className="min-w-36"><Check className="h-4 w-4" />Conferir resposta</Button></div>}
            </CardContent>
          </Card>
          <div className="flex items-center justify-between gap-3"><button onClick={() => { setQuestionIndex((index) => (index - 1 + questions.length) % questions.length); setSelectedAnswer(''); setHasAnswered(false); }} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200"><ArrowLeft className="h-3.5 w-3.5" /> Anterior</button><div className="flex-1 px-6"><Progress value={((questionIndex + (hasAnswered ? 1 : 0)) / Math.max(questions.length, 1)) * 100} className="h-1" /></div><button onClick={nextQuestion} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200">Pular <ArrowRight className="h-3.5 w-3.5" /></button></div>
        </div>
      ) : (
        <Card className="grid min-h-72 place-items-center p-8 text-center">
          <div className="max-w-md"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-slate-400"><Search className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-semibold text-white">Nenhuma questão nesta sessão</h2><p className="mt-2 text-sm leading-6 text-slate-500">{!isSupabaseConfigured ? 'Conecte o Supabase para gerar questões autorais com segurança.' : !subject ? 'Escolha uma matéria da trilha. A IA usará o edital e, quando houver, sinais agregados comparáveis para criar itens autorais.' : 'Gere uma sessão de questões autorais por IA, orientadas pelo edital e por sinais agregados disponíveis. Nenhuma questão real ou referência oficial será exibida.'}</p>{isSupabaseConfigured && <Button className="mt-5" onClick={generateQuestions} disabled={!userId || !subject || generating}><Search className="h-4 w-4" />Gerar questões</Button>}</div>
        </Card>
      )}

      {question && questions.length > 1 && <div className="flex items-center justify-between text-xs text-slate-500"><span>Questões disponíveis nesta seleção</span><button onClick={() => { setQuestionIndex(0); setSelectedAnswer(''); setHasAnswered(false); }} className="flex items-center gap-1 font-medium text-slate-400 hover:text-mint"><RefreshCw className="h-3.5 w-3.5" />Reiniciar sessão</button></div>}
    </div>
  );
}
