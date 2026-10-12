import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
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
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion, QuestionDifficulty } from '@/integrations/supabase/types';
import { PCPA_SUBJECTS, type SubjectName } from '@/lib/constants/subjects';
import { DEMO_QUESTIONS } from '@/lib/demo-data';
import { recordAttempt } from '@/lib/attempts';
import { saveDemoAttempt } from '@/lib/local-storage';
import { answerLetter } from '@/lib/utils';
import { useWrongAnswerTracker } from '@/hooks/useWrongAnswerTracker';

const DIFFICULTIES: { value: QuestionDifficulty; label: string }[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'intermediaria', label: 'Intermediária' },
  { value: 'dificil', label: 'Difícil' },
];

interface QuestionPracticeProps {
  initialSubject?: SubjectName;
  userId?: string;
  onAskTutor: (question: PcpaQuestion) => void;
}

export function QuestionPractice({ initialSubject, userId, onAskTutor }: QuestionPracticeProps) {
  const [subject, setSubject] = useState<string>(initialSubject ?? '');
  const [difficulty, setDifficulty] = useState<string>('');
  const [topic, setTopic] = useState('geral');
  const [generationCount, setGenerationCount] = useState(5);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [searchSummary, setSearchSummary] = useState<{ real_questions?: number; ai_generated?: number; search_available?: boolean; sources_consulted?: string[] } | null>(null);
  const queryClient = useQueryClient();
  const tracker = useWrongAnswerTracker();
  const lastInitialSubject = useRef(initialSubject);

  useEffect(() => {
    if (initialSubject && lastInitialSubject.current !== initialSubject) {
      setSubject(initialSubject);
      setQuestionIndex(0);
      setHasAnswered(false);
      setSelectedAnswer('');
      lastInitialSubject.current = initialSubject;
    }
  }, [initialSubject]);

  const questionsQuery = useQuery({
    queryKey: ['questions', subject, difficulty],
    queryFn: async (): Promise<PcpaQuestion[]> => {
      if (!isSupabaseConfigured) {
        return DEMO_QUESTIONS.filter((question) => (!subject || question.subject === subject) && (!difficulty || question.difficulty === difficulty));
      }
      let query = supabase.from('pcpa_questions').select('*').order('created_at', { ascending: false }).limit(100);
      if (subject) query = query.eq('subject', subject);
      if (difficulty) query = query.eq('difficulty', difficulty);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as PcpaQuestion[];
    },
  });
  const questions = questionsQuery.data ?? [];
  const question = questions.length ? questions[questionIndex % questions.length] : undefined;
  const correct = question ? answerLetter(question.answer) === answerLetter(selectedAnswer) : false;

  useEffect(() => {
    setQuestionIndex(0);
    setHasAnswered(false);
    setSelectedAnswer('');
    setQuestionStartedAt(Date.now());
  }, [subject, difficulty]);

  const answerOptions = useMemo(() => (question?.options ?? []).map((option, index) => {
    const match = option.match(/^\s*([A-E])\s*[).:-]\s*/i);
    const letter = match?.[1]?.toUpperCase() ?? String.fromCharCode(65 + index);
    const text = match ? option.slice(match[0].length) : option;
    return { letter, text, original: option };
  }), [question]);

  async function generateQuestions() {
    if (!isSupabaseConfigured) {
      toast.error('Novas questões indisponíveis no momento', { description: 'Pratique com as questões disponíveis ou tente novamente mais tarde.' });
      return;
    }
    if (!userId) {
      toast.error('Entre na sua conta para pesquisar questões', { description: 'Acesse pelo botão Entrar para proteger seu progresso e suas consultas.' });
      return;
    }
    if (!subject) {
      toast.error('Escolha uma matéria', { description: 'Selecione uma das 11 matérias oficiais do PCPA.' });
      return;
    }
    setGenerating(true);
    setSearchSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke('pcpa-gerar-questoes', {
        body: { subject, topic: topic.trim() || 'geral', difficulty: difficulty || 'intermediaria', count: generationCount },
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string; questions?: PcpaQuestion[]; search_summary?: typeof searchSummary; message?: string };
      if (!result?.success) throw new Error(result?.error || 'A busca não retornou questões.');
      setSearchSummary(result.search_summary ?? null);
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      setQuestionIndex(0);
      setHasAnswered(false);
      setSelectedAnswer('');
      toast.success(result.message || `${result.questions?.length ?? 0} questões prontas para praticar.`);
    } catch {
      toast.error('Não foi possível buscar novas questões', { description: 'Tente novamente em instantes. Suas respostas anteriores continuam salvas.' });
    } finally {
      setGenerating(false);
    }
  }

  async function submitAnswer() {
    if (!question || !selectedAnswer || hasAnswered || submitting) return;
    setSubmitting(true);
    let attemptId: string | null = null;
    let isCorrect = answerLetter(selectedAnswer) === answerLetter(question.answer);
    try {
      const recorded = await recordAttempt(question, selectedAnswer, (Date.now() - questionStartedAt) / 1000);
      attemptId = recorded.id;
      isCorrect = recorded.isCorrect;
    } catch {
      const local = saveDemoAttempt(question, selectedAnswer, (Date.now() - questionStartedAt) / 1000);
      attemptId = local.id;
      isCorrect = local.is_correct;
      toast.warning('Resposta registrada neste dispositivo', { description: 'A sincronização do seu progresso está temporariamente indisponível.' });
    }
    try {
      if (!isCorrect) await tracker.mutateAsync({ question, attemptId, wrongAnswer: answerLetter(selectedAnswer), isCorrect: false });
    } catch {
      // A tentativa permanece registrada mesmo se a sincronização do caderno falhar.
    } finally {
      setHasAnswered(true);
      setSubmitting(false);
      void queryClient.invalidateQueries({ queryKey: ['study-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['wrong-answers'] });
    }
  }

  function nextQuestion() {
    if (!questions.length) return;
    setQuestionIndex((index) => (index + 1) % questions.length);
    setSelectedAnswer('');
    setHasAnswered(false);
    setQuestionStartedAt(Date.now());
  }

  const isQuestionLoading = questionsQuery.isLoading;

  return (
    <div className="animate-float-in mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-mint"><Target className="h-3.5 w-3.5" /> Prática direcionada</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Banco de questões</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Pratique por matéria, entenda cada alternativa e transforme seus erros em revisão inteligente.</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.025] px-3 py-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-mint' : 'bg-amber-300'}`} />{isSupabaseConfigured ? 'Banco sincronizado' : 'Modo demonstrativo'}</div>
      </div>

      <Card>
        <div className="flex items-start gap-3 border-b border-white/[0.055] p-5 md:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Search className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-100">Monte sua sessão</h2><p className="mt-1 text-xs text-slate-500">A busca na web prioriza questões verificáveis de concursos e completa a lista com questões inéditas identificadas como IA.</p></div>
          <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex"><Sparkles className="h-3 w-3 text-amber-200" />Busca inteligente</Badge>
        </div>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_110px_auto] xl:items-end">
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Matéria</span><select className="field-select" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">Todas as matérias</option>{PCPA_SUBJECTS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Tópico</span><input className="field-input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex.: segurança pública" /></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Dificuldade</span><select className="field-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">Todas</option>{DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Questões</span><select className="field-select" value={generationCount} onChange={(event) => setGenerationCount(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select></label>
          <Button onClick={generateQuestions} disabled={generating || !isSupabaseConfigured || !userId} className="w-full xl:min-w-40">{generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Pesquisar questões</Button>
          {!isSupabaseConfigured && <p className="text-[10px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-5">Esta versão de demonstração oferece questões de exemplo. A pesquisa de novas questões e outros recursos estarão disponíveis na versão completa.</p>}
          {isSupabaseConfigured && !userId && <p className="text-[10px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-5">Entre na sua conta para salvar seu progresso e acessar seu histórico de estudos.</p>}
        </CardContent>
      </Card>

      {searchSummary && <Alert className="border-mint/20 bg-mint/[0.045]"><Sparkles className="h-4 w-4 text-mint" /><AlertTitle className="text-mint">Resumo da pesquisa</AlertTitle><AlertDescription>{searchSummary.search_available ? `${searchSummary.real_questions ?? 0} questões reais verificadas e ${searchSummary.ai_generated ?? 0} questões geradas por IA. As fontes verificadas aparecem nos detalhes de cada questão real.` : `Busca web indisponível nesta chamada; ${searchSummary.ai_generated ?? 0} questões foram geradas por IA e identificadas como tal.`}</AlertDescription></Alert>}

      {questionsQuery.isError && <Alert className="border-rose-400/20 bg-rose-400/[0.06]"><AlertTriangle className="h-4 w-4 text-rose-300" /><AlertTitle className="text-rose-200">Não foi possível carregar as questões</AlertTitle><AlertDescription>Não foi possível atualizar sua lista agora. Tente novamente em instantes.<button onClick={() => questionsQuery.refetch()} className="ml-2 font-semibold text-rose-200 underline">Tentar novamente</button></AlertDescription></Alert>}

      {isQuestionLoading ? <Card className="p-10 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-mint" /><p className="mt-3 text-sm text-slate-400">Carregando seu banco de questões…</p></Card> : question ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={question.subject} /><QuestionSourceBadge source={question.source} metadata={question.metadata} />{question.topic && <Badge variant="secondary">{question.topic}</Badge>}</div><span className="text-xs tabular-nums text-slate-500">Questão {questionIndex + 1} de {questions.length}</span></div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-3 md:px-7"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="font-semibold text-slate-300">{question.difficulty === 'facil' ? 'Fácil' : question.difficulty === 'dificil' ? 'Difícil' : 'Intermediária'}</span><span className="h-1 w-1 rounded-full bg-slate-600" />{question.type === 'multipla_escolha' ? 'Múltipla escolha' : question.type}</div><div className="flex items-center gap-2"><span className="rounded-lg bg-white/[0.035] px-2 py-1 text-[10px] text-slate-500">Resposta única</span><button onClick={() => { setHasAnswered(false); setSelectedAnswer(''); }} title="Limpar resposta" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button></div></div>
            <CardContent className="p-5 md:p-7">
              {question.needs_verification && <Alert className="mb-5 border-amber-400/20 bg-amber-400/[0.055] p-3"><AlertTriangle className="h-4 w-4 text-amber-300" /><AlertDescription className="text-xs text-amber-100/80"><strong className="text-amber-200">⚠️ Verificar Lei Seca.</strong> Confirme os dispositivos citados no texto legal atualizado em fonte oficial antes de memorizar.</AlertDescription></Alert>}
              <h2 className="max-w-3xl text-base font-medium leading-7 text-slate-100 md:text-lg md:leading-8">{question.prompt}</h2>
              <div className="mt-6 space-y-2.5">
                {answerOptions.map((option) => {
                  const isSelected = selectedAnswer === option.letter;
                  const isCorrectOption = answerLetter(question.answer) === option.letter;
                  const showCorrect = hasAnswered && isCorrectOption;
                  const showWrong = hasAnswered && isSelected && !correct;
                  return <button key={`${option.letter}-${option.text}`} onClick={() => !hasAnswered && setSelectedAnswer(option.letter)} disabled={hasAnswered} className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${showCorrect ? 'border-mint/35 bg-mint/[0.07]' : showWrong ? 'border-rose-400/30 bg-rose-400/[0.06]' : isSelected ? 'border-cyan-300/30 bg-cyan-300/[0.055]' : 'border-white/[0.07] bg-white/[0.015] hover:border-white/[0.14] hover:bg-white/[0.035]'}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-[10px] font-bold ${showCorrect ? 'border-mint/30 bg-mint/15 text-mint' : showWrong ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : isSelected ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200' : 'border-white/10 bg-white/[0.035] text-slate-500 group-hover:text-slate-200'}`}>{showCorrect ? <Check className="h-3.5 w-3.5" /> : showWrong ? <X className="h-3.5 w-3.5" /> : option.letter}</span>
                    <span className={`pt-0.5 text-sm leading-6 ${showCorrect ? 'text-mint' : showWrong ? 'text-rose-200' : 'text-slate-300'}`}>{option.text}</span>
                    {showCorrect && <CheckCircle2 className="ml-auto mt-1 h-4 w-4 shrink-0 text-mint" />}
                  </button>;
                })}
              </div>

              {hasAnswered && <div className={`mt-5 rounded-2xl border p-4 md:p-5 ${correct ? 'border-mint/20 bg-mint/[0.045]' : 'border-rose-400/15 bg-rose-400/[0.04]'}`}>
                <div className="flex items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${correct ? 'bg-mint/10 text-mint' : 'bg-rose-400/10 text-rose-300'}`}>{correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${correct ? 'text-mint' : 'text-rose-200'}`}>{correct ? 'Boa! Resposta correta.' : `A resposta correta é ${answerLetter(question.answer)}.`}</p><p className="mt-2 text-sm leading-6 text-slate-300">{question.gabarito_comentado}</p>{question.ponto_de_atencao && <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.035] p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-amber-200">Ponto de atenção</p><p className="mt-1 text-xs leading-5 text-slate-400">{question.ponto_de_atencao}</p></div>}</div></div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4"><Button size="sm" onClick={nextQuestion}><ArrowRight className="h-3.5 w-3.5" />Próxima questão</Button><Button size="sm" variant="secondary" onClick={() => onAskTutor(question)}><CircleHelp className="h-3.5 w-3.5" />Perguntar ao tutor</Button>{question.metadata && 'url_fonte' in question.metadata && question.metadata.url_fonte && <a href={question.metadata.url_fonte} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline">Fonte original <ExternalLink className="h-3 w-3" /></a>}</div>
              </div>}

              {!hasAnswered && <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Selecione uma alternativa para registrar sua resposta.</p><Button onClick={submitAnswer} disabled={!selectedAnswer || submitting} className="min-w-36">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Confirmar resposta</Button></div>}
            </CardContent>
          </Card>
          <div className="flex items-center justify-between gap-3"><button onClick={() => { setQuestionIndex((index) => (index - 1 + questions.length) % questions.length); setSelectedAnswer(''); setHasAnswered(false); setQuestionStartedAt(Date.now()); }} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200"><ArrowLeft className="h-3.5 w-3.5" /> Anterior</button><div className="flex-1 px-6"><Progress value={((questionIndex + (hasAnswered ? 1 : 0)) / Math.max(questions.length, 1)) * 100} className="h-1" /></div><button onClick={nextQuestion} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200">Pular <ArrowRight className="h-3.5 w-3.5" /></button></div>
        </div>
      ) : (
        <Card className="grid min-h-72 place-items-center p-8 text-center">
          <div className="max-w-md"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-slate-400"><Search className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-semibold text-white">Nenhuma questão nesta seleção</h2><p className="mt-2 text-sm leading-6 text-slate-500">{isSupabaseConfigured ? 'Use a pesquisa na web acima para priorizar questões reais e completar a lista com questões inéditas.' : 'As questões de demonstração estão disponíveis para algumas matérias. Escolha outra matéria ou volte mais tarde para novas questões.'}</p>{isSupabaseConfigured && <Button className="mt-5" onClick={generateQuestions} disabled={!userId}><Sparkles className="h-4 w-4" />Buscar questões</Button>}</div>
        </Card>
      )}

      {question && questions.length > 1 && <div className="flex items-center justify-between text-xs text-slate-500"><span>Questões disponíveis nesta seleção</span><button onClick={() => { setQuestionIndex(0); setSelectedAnswer(''); setHasAnswered(false); }} className="flex items-center gap-1 font-medium text-slate-400 hover:text-mint"><ChevronDown className="h-3.5 w-3.5" />Reiniciar sessão</button></div>}
    </div>
  );
}
