import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Focus,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  TimerOff,
  Trophy,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { QuestionProvenance } from '@/components/study/QuestionProvenance';
import { QuestionSourceBadge } from '@/components/study/QuestionSourceBadge';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { PCPA_SUBJECTS } from '@/lib/constants/subjects';
import { filterVerifiedRealQuestions } from '@/lib/question-provenance';
import { recordAttempt } from '@/lib/attempts';
import { useWrongAnswerTracker } from '@/hooks/useWrongAnswerTracker';
import { saveDemoAttempt } from '@/lib/local-storage';
import { answerLetter, questionAnswerDisplay, questionExplanationLabel, questionOptionDetails } from '@/lib/utils';

interface SimuladoSessionProps { userId?: string }
type Phase = 'setup' | 'running' | 'result';

const SIMULATED_MINUTES = [15, 30, 60];

export function SimuladoSession({ userId }: SimuladoSessionProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [subject, setSubject] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [minutes, setMinutes] = useState(30);
  const [timerHidden, setTimerHidden] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<PcpaQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const tracker = useWrongAnswerTracker();

  const query = useQuery({
    queryKey: ['simulado-questions'],
    queryFn: async (): Promise<PcpaQuestion[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('pcpa_questions').select('*').eq('source', 'concurso_real').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return filterVerifiedRealQuestions((data ?? []) as unknown as PcpaQuestion[]);
    },
  });
  const available = useMemo(() => (query.data ?? []).filter((question) => !subject || question.subject === subject), [query.data, subject]);
  const currentQuestion = activeQuestions[currentIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] ?? '' : '';
  const correctCount = activeQuestions.filter((question) => answerLetter(answers[question.id]) === answerLetter(question.answer)).length;
  const answeredCount = activeQuestions.filter((question) => Boolean(answers[question.id])).length;
  const accuracy = activeQuestions.length ? Math.round(correctCount / activeQuestions.length * 100) : 0;

  useEffect(() => {
    if (phase !== 'running' || timerHidden) return;
    if (secondsLeft <= 0) {
      void finishExam();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // finishExam has intentionally stable effect inputs; the timer is driven by secondsLeft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft, timerHidden]);

  function startExam() {
    if (!available.length) {
      toast.error('Ainda não há questões oficiais nesta seleção', { description: 'Escolha outra matéria ou busque questões reais no Banco de questões. O simulado não usa itens artificiais.' });
      return;
    }
    const ordered = [...available].sort(() => Math.random() - 0.5).slice(0, questionCount);
    setActiveQuestions(ordered);
    setAnswers({});
    setCurrentIndex(0);
    setSecondsLeft(minutes * 60);
    setPhase('running');
  }

  async function finishExam() {
    if (phase !== 'running' || saving) return;
    setSaving(true);
    try {
      for (const question of activeQuestions) {
        const answer = answers[question.id];
        if (!answer) continue;
        let attemptId = '';
        let isCorrect = answerLetter(answer) === answerLetter(question.answer);
        try {
          const attempt = await recordAttempt(question, answer, 0);
          attemptId = attempt.id;
          isCorrect = attempt.isCorrect;
        } catch {
          // Preserve offline progress if the network or row policy is temporarily unavailable.
          const attempt = saveDemoAttempt(question, answer, 0);
          attemptId = attempt.id;
          isCorrect = attempt.is_correct;
        }
        if (!isCorrect) {
          try {
            await tracker.mutateAsync({ question, attemptId, wrongAnswer: answer, isCorrect: false });
          } catch {
            // Keep the result flow available even if the error notebook is temporarily offline.
          }
        }
      }
      if (isSupabaseConfigured && userId) {
        const { error } = await supabase.from('pcpa_simulados').insert({
          user_id: userId,
          subject: subject || null,
          question_ids: activeQuestions.map((question) => question.id),
          answers,
          total_questions: activeQuestions.length,
          correct_answers: correctCount,
          timer_hidden: timerHidden,
          focus_mode: focusMode,
          finished_at: new Date().toISOString(),
        });
        if (error) toast.warning('Resultado calculado', { description: 'Não foi possível salvar no histórico, mas você pode revisar seu desempenho nesta tela.' });
      }
      setPhase('result');
      await queryClient.invalidateQueries({ queryKey: ['study-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['wrong-answers'] });
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setPhase('setup');
    setActiveQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
  }

  function choose(letter: string) {
    if (!currentQuestion) return;
    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: letter }));
  }

  function moveTo(index: number) {
    setCurrentIndex(index);
  }

  const displayTime = `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`;

  if (query.isLoading) return <Card className="grid min-h-72 place-items-center p-10"><LoaderCircle className="h-6 w-6 animate-spin text-mint" /><p className="mt-3 text-sm text-slate-400">Preparando o banco para seu simulado…</p></Card>;
  if (query.isError) return <Card className="p-8 text-sm text-rose-200">Não foi possível carregar as questões agora. Tente novamente em instantes.</Card>;

  if (phase === 'setup') return <div className="animate-float-in mx-auto max-w-5xl space-y-6">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-cyan-300"><FileQuestion className="h-3.5 w-3.5" /> Ambiente de prova</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Simulados</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Treine gestão de tempo, foco e tomada de decisão em uma sessão contínua.</p></div>
    <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <Card className="p-5 md:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><FileQuestion className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold text-white">Configure sua prova</h2><p className="mt-1 text-xs text-slate-500">Você poderá revisar o resultado ao final.</p></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold text-slate-400">Matéria</span><select className="field-select" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">Todas as matérias</option>{PCPA_SUBJECTS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-semibold text-slate-400">Quantidade de questões</span><select className="field-select" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}><option value={5}>5 questões</option><option value={10}>10 questões</option><option value={20}>20 questões</option><option value={40}>40 questões</option></select></label></div>
        <div className="mt-5"><span className="mb-2 block text-xs font-semibold text-slate-400">Tempo de prova</span><div className="flex flex-wrap gap-2">{SIMULATED_MINUTES.map((value) => <button key={value} onClick={() => setMinutes(value)} className={`rounded-xl border px-4 py-2 text-xs transition ${minutes === value ? 'border-mint/25 bg-mint/[0.07] text-mint' : 'border-line text-slate-400 hover:bg-white/[0.04]'}`}>{value} min</button>)}</div></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><ToggleOption icon={TimerOff} title="Ocultar cronômetro" description="Faça uma sessão sem contagem regressiva" checked={timerHidden} onChange={() => setTimerHidden((value) => !value)} /><ToggleOption icon={Focus} title="Modo foco" description="Reduza distrações durante a prova" checked={focusMode} onChange={() => setFocusMode((value) => !value)} /></div>
        {!available.length && <p className="mt-5 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] p-3 text-xs leading-5 text-amber-100/70">Ainda não há questões oficiais verificadas nesta seleção. Busque questões reais no Banco de questões; o simulado não será preenchido com itens artificiais.</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5"><span className="text-xs text-slate-500">{available.length} {available.length === 1 ? 'questão oficial verificada disponível' : 'questões oficiais verificadas disponíveis'} nesta seleção</span><Button size="lg" onClick={startExam} disabled={!available.length}><Play className="h-4 w-4" />Começar simulado<ArrowRight className="h-4 w-4" /></Button></div>
      </Card>
      <div className="space-y-4"><Card className="p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mint/10 text-mint"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-slate-100">Como funciona</p><p className="text-[10px] text-slate-500">Simulado em ritmo de prova</p></div></div><ul className="mt-4 space-y-3 text-xs leading-5 text-slate-400"><li className="flex gap-2"><span className="text-mint">01</span> Responda e navegue entre as questões.</li><li className="flex gap-2"><span className="text-mint">02</span> O cronômetro pode ser ocultado a qualquer momento.</li><li className="flex gap-2"><span className="text-mint">03</span> Ao finalizar, as respostas incorretas vão para o caderno de erros.</li></ul></Card><Card className="p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><Trophy className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-slate-100">Meta de hoje</p><p className="text-[10px] text-slate-500">Uma sessão focada vale mais que pressa.</p></div></div><div className="mt-4 flex items-end justify-between"><span className="text-2xl font-semibold text-white">{answeredCount}<span className="text-sm text-slate-500"> / {questionCount}</span></span><span className="text-xs text-slate-500">respondidas na última sessão</span></div><Progress value={0} className="mt-3" /></Card></div>
    </div>
  </div>;

  if (phase === 'result') return <div className="animate-float-in mx-auto max-w-5xl space-y-6">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-mint"><Trophy className="h-3.5 w-3.5" /> Resultado</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Simulado concluído</h1><p className="mt-2 text-sm text-slate-400">Confira seu desempenho e revise cada resposta com calma.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><ResultStat label="Aproveitamento" value={`${accuracy}%`} color="text-mint" /><ResultStat label="Acertos" value={`${correctCount} / ${activeQuestions.length}`} color="text-cyan-200" /><ResultStat label="Respondidas" value={`${answeredCount}`} color="text-violet-200" /><ResultStat label="Não respondidas" value={`${activeQuestions.length - answeredCount}`} color="text-amber-200" /></div>
    <Card className="p-5 md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">Revisão da prova</p><p className="mt-1 text-xs text-slate-500">As incorretas já foram incluídas no seu caderno de erros.</p></div><Button variant="secondary" onClick={restart}><RotateCcw className="h-4 w-4" />Novo simulado</Button></div><div className="mt-5 space-y-3">{activeQuestions.map((question, index) => { const picked = answers[question.id]; const correct = answerLetter(picked) === answerLetter(question.answer); return <details key={question.id} className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-4"><summary className="flex cursor-pointer list-none items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${correct ? 'bg-mint/10 text-mint' : 'bg-rose-400/10 text-rose-300'}`}>{correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-[10px] text-slate-500">Questão {index + 1} · {picked ? `Sua resposta ${questionAnswerDisplay(question.type, picked)}` : 'Sem resposta'}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-200">{question.prompt}</span></span><Badge variant="secondary">Gabarito {questionAnswerDisplay(question.type, question.answer)}</Badge></summary><div className="mt-4 border-t border-white/[0.05] pt-4"><div className="flex flex-wrap gap-2"><SubjectBadge subject={question.subject} /><QuestionSourceBadge source={question.source} metadata={question.metadata} /></div><QuestionProvenance question={question} showOfficialAnswer className="mt-4" /><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{questionExplanationLabel(question.metadata)}</p><p className="mt-1 text-xs leading-6 text-slate-300">{question.gabarito_comentado}</p></div></details>; })}</div></Card>
  </div>;

  return <div className={`animate-float-in mx-auto max-w-6xl space-y-5 ${focusMode ? 'max-w-4xl' : ''}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><FileQuestion className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-white">Simulado em andamento</p><p className="text-[10px] text-slate-500">Questão {currentIndex + 1} de {activeQuestions.length} · {answeredCount} respondidas</p></div></div><div className="flex items-center gap-2">{!timerHidden && <span className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm tabular-nums ${secondsLeft < 120 ? 'border-rose-400/20 bg-rose-400/[0.05] text-rose-200' : 'border-line bg-white/[0.025] text-slate-200'}`}><Clock3 className="h-4 w-4" />{displayTime}</span>}<Button variant="destructive" size="sm" onClick={() => void finishExam()} disabled={saving}>{saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Finalizar</Button></div></div>
    <Progress value={(currentIndex + 1) / activeQuestions.length * 100} className="h-1.5" />
    <div className={`grid gap-4 ${focusMode ? '' : 'lg:grid-cols-[1fr_260px]'}`}>
      <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-5 py-3"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={currentQuestion.subject} /><QuestionSourceBadge source={currentQuestion.source} metadata={currentQuestion.metadata} /></div><span className="text-[10px] text-slate-500">Questão {currentIndex + 1}</span></div><div className="p-5 md:p-7"><h2 className="whitespace-pre-line text-base font-medium leading-7 text-slate-100 md:text-lg">{currentQuestion.prompt}</h2><QuestionProvenance question={currentQuestion} className="mt-4" /><div className="mt-5 space-y-2">{currentQuestion.options.map((option, optionIndex) => { const details = questionOptionDetails(currentQuestion.type, option, optionIndex); const value = details.value; return <button key={`${value}-${option}`} onClick={() => choose(value)} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm leading-6 transition ${selectedAnswer === value ? 'border-cyan-300/25 bg-cyan-300/[0.05] text-slate-100' : 'border-white/[0.06] text-slate-400 hover:bg-white/[0.025] hover:text-slate-200'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-[10px] font-bold ${selectedAnswer === value ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.08] text-slate-500'}`}>{details.label}</span>{details.text}</button>; })}</div><div className="mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4"><Button variant="ghost" size="sm" onClick={() => moveTo(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}><ArrowLeft className="h-3.5 w-3.5" />Anterior</Button><span className="text-[10px] text-slate-600">{selectedAnswer ? currentQuestion.type === 'certo_errado' ? `${questionAnswerDisplay(currentQuestion.type, selectedAnswer)} marcado` : `Alternativa ${selectedAnswer} marcada` : currentQuestion.type === 'certo_errado' ? 'Marque Certo ou Errado' : 'Selecione uma alternativa'}</span><Button size="sm" onClick={() => currentIndex < activeQuestions.length - 1 ? moveTo(currentIndex + 1) : void finishExam()}>{currentIndex === activeQuestions.length - 1 ? 'Concluir' : 'Próxima'}<ArrowRight className="h-3.5 w-3.5" /></Button></div></div></Card>
      {!focusMode && <Card className="h-fit p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-200">Navegação</p><p className="mt-1 text-[10px] text-slate-500">Acesse uma questão</p></div><Badge variant="secondary">{answeredCount}/{activeQuestions.length}</Badge></div><div className="mt-4 grid grid-cols-5 gap-2">{activeQuestions.map((question, index) => <button key={question.id} onClick={() => moveTo(index)} aria-label={`Ir para questão ${index + 1}`} className={`grid h-9 place-items-center rounded-lg border text-xs font-semibold ${currentIndex === index ? 'border-mint/25 bg-mint/10 text-mint' : answers[question.id] ? 'border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200' : 'border-white/[0.06] text-slate-500 hover:bg-white/[0.04]'}`}>{index + 1}</button>)}</div><div className="mt-5 border-t border-white/[0.05] pt-4"><p className="text-[10px] leading-5 text-slate-500">Questões sem resposta não contam como acerto. Seus erros entram automaticamente no caderno ao finalizar.</p></div></Card>}
    </div>
    <div className="flex items-center justify-between text-[10px] text-slate-600"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" />Progresso salvo ao finalizar</span><button onClick={() => { if (window.confirm('Deseja sair do simulado sem registrar o resultado?')) restart(); }} className="flex items-center gap-1 hover:text-rose-300"><ArrowLeft className="h-3 w-3" />Sair do simulado</button></div>
  </div>;
}

function ToggleOption({ icon: Icon, title, description, checked, onChange }: { icon: typeof Clock3; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <button onClick={onChange} aria-pressed={checked} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${checked ? 'border-cyan-300/20 bg-cyan-300/[0.045]' : 'border-white/[0.06] hover:bg-white/[0.025]'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${checked ? 'bg-cyan-300/10 text-cyan-200' : 'bg-white/[0.04] text-slate-500'}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-200">{title}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span></span><span className={`mt-1 h-4 w-7 shrink-0 rounded-full p-0.5 transition ${checked ? 'bg-mint/60' : 'bg-slate-700'}`}><span className={`block h-3 w-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-3' : ''}`} /></span></button>;
}

function ResultStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <Card className="p-4"><p className="text-[10px] text-slate-500">{label}</p><p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p></Card>;
}
