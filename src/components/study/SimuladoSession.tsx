import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Focus,
  LoaderCircle,
  Play,
  RotateCcw,
  TimerOff,
  Trophy,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { QuestionSourceBadge } from '@/components/study/QuestionSourceBadge';
import { cleanLegalCommentary, LegalReferenceNote } from '@/components/study/LegalReferenceNote';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { getPriorityLabel, getRoleSubject, getStudyRole, getSubjectsForRole, isSubjectInRole, type StudyRoleId } from '@/lib/constants/subjects';
import { answerLetter, questionAnswerDisplay, questionOptionDetails } from '@/lib/utils';
import { generateAIQuestionBatch } from '@/lib/ai-questions';
import { createAISimulado, loadAIQuestionsByIds, loadAISimuladoHistory, recordAISimuladoAnswer, saveAISimuladoAttempts, updateAISimulado, type AISimuladoHistoryItem } from '@/lib/ai-study-data';

interface SimuladoSessionProps { studyRoleId: StudyRoleId; userId?: string }
type Phase = 'setup' | 'running' | 'result';

const SIMULATED_MINUTES = [15, 30, 60];

export function SimuladoSession({ studyRoleId, userId }: SimuladoSessionProps) {
  const studyRole = getStudyRole(studyRoleId);
  const roleSubjects = getSubjectsForRole(studyRoleId);
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
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [simuladoId, setSimuladoId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<AISimuladoHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const savingAnswerIdRef = useRef<string | null>(null);
  const finishingRef = useRef(false);
  const autoFinishAttemptedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  const refreshHistory = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setSavedSessions([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      setSavedSessions(await loadAISimuladoHistory(studyRoleId, 20));
    } catch (error) {
      console.error('Não foi possível carregar o histórico de simulados.', error);
      setSavedSessions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [studyRoleId, userId]);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  const currentQuestion = activeQuestions[currentIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] ?? '' : '';
  const correctCount = activeQuestions.filter((question) => answerLetter(answers[question.id]) === answerLetter(question.answer)).length;
  const answeredCount = activeQuestions.filter((question) => Boolean(answers[question.id])).length;
  const accuracy = activeQuestions.length ? Math.round(correctCount / activeQuestions.length * 100) : 0;

  useEffect(() => {
    if (phase !== 'running' || timerHidden || finishing) return;
    if (secondsLeft <= 0) {
      if (!savingAnswerIdRef.current && !finishingRef.current && !autoFinishAttemptedRef.current) {
        autoFinishAttemptedRef.current = true;
        void finishExam();
      }
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // The timer is driven by secondsLeft; finishExam saves the session before showing its result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft, timerHidden, finishing, savingAnswerId]);

  async function finishExam() {
    if (phase !== 'running' || finishingRef.current || savingAnswerIdRef.current || !simuladoId) return;
    finishingRef.current = true;
    setFinishing(true);
    setSessionError('');
    const finalAnswers = { ...answersRef.current };
    try {
      const result = await saveAISimuladoAttempts({
        id: simuladoId,
        role: studyRoleId,
        answers: finalAnswers,
        questions: activeQuestions,
        startedAt: startedAtRef.current,
      });
      const durationSeconds = timerHidden
        ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
        : Math.max(0, minutes * 60 - secondsLeft);
      await updateAISimulado(simuladoId, {
        status: 'completed',
        generated_questions: activeQuestions.length,
        question_ids: activeQuestions.map((question) => question.id),
        answers: finalAnswers,
        answered_count: result.answeredCount,
        correct_answers: result.correctAnswers,
        duration_seconds: durationSeconds,
        finished_at: new Date().toISOString(),
      });
      await refreshHistory();
      setPhase('result');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o resultado do simulado.';
      setSessionError(message);
      toast.error('O resultado ainda não foi salvo', { description: message });
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }

  async function startExam() {
    if (!isSupabaseConfigured || !userId) {
      toast.error(!isSupabaseConfigured ? 'Supabase desconectado' : 'Entre na sua conta', {
        description: 'A geração de simulados autorais exige uma conta aprovada e o serviço protegido do Supabase.',
      });
      return;
    }
    if (subject && !isSubjectInRole(studyRoleId, subject)) {
      toast.error('Matéria fora da trilha ativa');
      return;
    }

    setGenerating(true);
    setSessionError('');
    setGenerationProgress('Preparando a distribuição da sessão conforme o edital…');
    let sessionRecordId: string | null = null;
    try {
      const allocations = subject
        ? [{ subject, count: questionCount }]
        : allocateQuestionCounts(roleSubjects.map((item) => item.name), questionCount, studyRoleId);
      sessionRecordId = await createAISimulado({
        role: studyRoleId,
        subject: subject || 'todas',
        requestedQuestions: questionCount,
        timerHidden,
        focusMode,
        timerSeconds: minutes * 60,
      });
      setSimuladoId(sessionRecordId);

      const generated: PcpaQuestion[] = [];
      const seenPrompts = new Set<string>();
      let requestNumber = 0;

      for (const allocation of allocations) {
        let remaining = allocation.count;
        while (remaining > 0) {
          const batchCount = Math.min(20, remaining);
          requestNumber += 1;
          setGenerationProgress(`Criando itens autorais por matéria (${requestNumber}ª solicitação)…`);
          const batch = await generateAIQuestionBatch({
            role: studyRoleId,
            subject: allocation.subject,
            topic: 'geral',
            difficulty: 'intermediaria',
            count: batchCount,
            format: 'mista',
            activity: 'simulado',
            simuladoId: sessionRecordId,
          });
          let added = 0;
          for (const question of batch) {
            const normalizedPrompt = question.prompt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (seenPrompts.has(normalizedPrompt)) continue;
            seenPrompts.add(normalizedPrompt);
            generated.push(question);
            added += 1;
            if (added >= remaining) break;
          }
          remaining -= added;
          if (added === 0) break;
        }
      }

      const session = shuffleQuestions(generated).slice(0, questionCount);
      if (!session.length) throw new Error('A IA não retornou questões válidas para esta seleção.');
      startedAtRef.current = Date.now();
      await updateAISimulado(sessionRecordId, {
        status: 'running',
        started_at: new Date(startedAtRef.current).toISOString(),
        generated_questions: session.length,
        question_ids: session.map((question) => question.id),
        answers: {},
        answered_count: 0,
        correct_answers: 0,
      });
      answersRef.current = {};
      savingAnswerIdRef.current = null;
      finishingRef.current = false;
      autoFinishAttemptedRef.current = false;
      setActiveQuestions(session);
      setAnswers({});
      setCurrentIndex(0);
      setSecondsLeft(minutes * 60);
      setFinishing(false);
      setSavingAnswerId(null);
      setPhase('running');
      if (session.length < questionCount) {
        toast.message('Simulado parcial', { description: `${session.length} de ${questionCount} itens foram gerados.` });
      } else {
        toast.success('Simulado autoral pronto.');
      }
    } catch (error) {
      if (sessionRecordId) {
        try {
          await updateAISimulado(sessionRecordId, { status: 'failed', finished_at: new Date().toISOString() });
        } catch (saveError) {
          console.error('Não foi possível encerrar o registro do simulado com falha.', saveError);
        }
      }
      const message = error instanceof Error ? error.message : 'Tente novamente em instantes.';
      setSessionError(message);
    } finally {
      setGenerating(false);
      setGenerationProgress('');
      void refreshHistory();
    }
  }

  async function openSavedSession(saved: AISimuladoHistoryItem) {
    if (saved.status !== 'running' && saved.status !== 'completed') {
      toast.info(saved.status === 'generating' ? 'Esta sessão ainda estava sendo gerada; crie um novo simulado.' : 'Esta sessão não foi concluída.');
      return;
    }
    setLoadingSessionId(saved.id);
    try {
      const questions = await loadAIQuestionsByIds(saved.question_ids, studyRoleId);
      if (!questions.length) throw new Error('Não há questões disponíveis para esta sessão.');
      const savedAnswers = saved.answers ?? {};
      const startedAt = new Date(saved.started_at).getTime();
      answersRef.current = savedAnswers;
      savingAnswerIdRef.current = null;
      finishingRef.current = false;
      autoFinishAttemptedRef.current = false;
      setSubject(saved.subject === 'todas' ? '' : saved.subject ?? '');
      setQuestionCount(saved.requested_questions);
      setActiveQuestions(questions);
      setAnswers(savedAnswers);
      setCurrentIndex(saved.status === 'running' ? Math.max(0, questions.findIndex((question) => !savedAnswers[question.id])) : 0);
      setSimuladoId(saved.id);
      setTimerHidden(saved.timer_hidden);
      setFocusMode(saved.focus_mode);
      setMinutes(Math.max(15, Math.min(60, Math.round(saved.timer_seconds / 60))));
      setSecondsLeft(Math.max(0, saved.timer_seconds - Math.floor((Date.now() - (Number.isFinite(startedAt) ? startedAt : Date.now())) / 1000)));
      startedAtRef.current = Number.isFinite(startedAt) ? startedAt : Date.now();
      setFinishing(false);
      setSavingAnswerId(null);
      setSessionError('');
      setPhase(saved.status === 'completed' ? 'result' : 'running');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir esta sessão.');
    } finally {
      setLoadingSessionId(null);
    }
  }

  function restart() {
    if (savingAnswerIdRef.current || finishingRef.current) return;
    answersRef.current = {};
    setPhase('setup');
    setActiveQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setSessionError('');
    setSimuladoId(null);
    finishingRef.current = false;
    autoFinishAttemptedRef.current = false;
    setFinishing(false);
    setSavingAnswerId(null);
  }

  async function choose(letter: string) {
    if (!currentQuestion || !simuladoId || finishingRef.current || savingAnswerIdRef.current) return;
    const questionId = currentQuestion.id;
    const sessionId = simuladoId;
    const nextAnswers = { ...answersRef.current, [questionId]: letter };
    answersRef.current = nextAnswers;
    savingAnswerIdRef.current = questionId;
    setAnswers(nextAnswers);
    setSavingAnswerId(questionId);
    try {
      await recordAISimuladoAnswer(sessionId, questionId, letter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a resposta do simulado.');
    } finally {
      if (savingAnswerIdRef.current === questionId) {
        savingAnswerIdRef.current = null;
        setSavingAnswerId(null);
      }
    }
  }

  function moveTo(index: number) {
    if (savingAnswerIdRef.current || finishingRef.current || index < 0 || index >= activeQuestions.length) return;
    setCurrentIndex(index);
  }

  const displayTime = `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`;

  if (phase === 'setup') return <div className="animate-float-in mx-auto max-w-5xl space-y-6">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-cyan-300"><FileQuestion className="h-3.5 w-3.5" /> Ambiente de prova · {studyRole?.label} · {studyRole?.notice}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Simulados</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Itens autorais de IA para treinar gestão do tempo e tomada de decisão.</p></div>
    <div className="grid gap-4">
      <Card className="p-5 md:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><FileQuestion className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold text-white">Configure sua sessão</h2><p className="mt-1 text-xs text-slate-500">Itens autorais de IA; sessão e resultado salvos na sua conta.</p></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold text-slate-400">Matéria — {studyRole?.label}</span><select className="field-select" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">Todas as matérias da trilha</option>{roleSubjects.map((item) => { const profile = getRoleSubject(studyRoleId, item.name); const share = studyRole && profile ? Math.round(profile.points / studyRole.total_points * 100) : 0; return <option key={item.name} value={item.name}>{item.name} · {profile ? getPriorityLabel(profile.relative_priority) : ''} · {share}%</option>; })}</select></label><label><span className="mb-1.5 block text-xs font-semibold text-slate-400">Quantidade de questões</span><select className="field-select" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}><option value={5}>5 questões</option><option value={10}>10 questões</option><option value={20}>20 questões</option><option value={40}>40 questões</option>{studyRole && <option value={studyRole.total_questions}>Prova completa · {studyRole.total_questions} questões</option>}</select></label></div>
        <div className="mt-5"><span className="mb-2 block text-xs font-semibold text-slate-400">Tempo de sessão</span><div className="flex flex-wrap gap-2">{SIMULATED_MINUTES.map((value) => <button key={value} onClick={() => setMinutes(value)} className={`rounded-xl border px-4 py-2 text-xs transition ${minutes === value ? 'border-mint/25 bg-mint/[0.07] text-mint' : 'border-line text-slate-400 hover:bg-white/[0.04]'}`}>{value} min</button>)}</div></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><ToggleOption icon={TimerOff} title="Ocultar cronômetro" description="Faça uma sessão sem contagem regressiva" checked={timerHidden} onChange={() => setTimerHidden((value) => !value)} /><ToggleOption icon={Focus} title="Modo foco" description="Reduza distrações durante a prova" checked={focusMode} onChange={() => setFocusMode((value) => !value)} /></div>
        {generating && <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-200" />{generationProgress}</p>}
        {sessionError && <Alert className="mt-4 border-rose-400/20 bg-rose-400/[0.06]"><AlertTitle className="text-rose-200">Geração não concluída</AlertTitle><AlertDescription>{sessionError}</AlertDescription></Alert>}
        {isSupabaseConfigured && !userId && <p className="mt-4 text-[10px] text-slate-500">Entre com uma conta aprovada para gerar.</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5"><span className="text-xs text-slate-500">{questionCount} itens · {subject || 'distribuídos pelas matérias do edital'}</span><Button size="lg" onClick={() => void startExam()} disabled={generating || !isSupabaseConfigured || !userId}><Play className="h-4 w-4" />{generating ? 'Gerando…' : 'Gerar simulado'}<ArrowRight className="h-4 w-4" /></Button></div>
      </Card>
      {isSupabaseConfigured && userId && <details className="rounded-2xl border border-white/[0.06] bg-white/[0.012] p-4">
        <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200">Sessões salvas{savedSessions.length ? ` · ${savedSessions.length}` : ''}</summary>
        <div className="mt-3 space-y-2">
          {historyLoading ? <p className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3 w-3 animate-spin" />Carregando histórico…</p> : savedSessions.length ? savedSessions.map((saved) => {
            const statusLabel = saved.status === 'completed' ? 'Concluído' : saved.status === 'running' ? 'Em andamento' : saved.status === 'generating' ? 'Geração incompleta' : 'Falha registrada';
            const canOpen = saved.status === 'completed' || saved.status === 'running';
            return <div key={saved.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
              <div className="min-w-0"><p className="text-xs font-medium text-slate-300">{saved.subject === 'todas' ? 'Todas as matérias' : saved.subject || 'Trilha completa'} · {saved.generated_questions} questão(ões)</p><p className="mt-1 text-[10px] text-slate-500">{new Date(saved.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {statusLabel}{saved.status === 'completed' ? ` · ${saved.correct_answers}/${saved.generated_questions} acertos` : ''}</p></div>
              <Button size="sm" variant="secondary" onClick={() => void openSavedSession(saved)} disabled={!canOpen || loadingSessionId === saved.id}>{loadingSessionId === saved.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}{loadingSessionId === saved.id ? 'Abrindo…' : saved.status === 'running' ? 'Retomar' : saved.status === 'completed' ? 'Ver resultado' : 'Indisponível'}</Button>
            </div>;
          }) : <p className="text-xs text-slate-500">Seus simulados concluídos e em andamento aparecerão aqui.</p>}
        </div>
      </details>}
    </div>
  </div>;

  if (phase === 'result') return <div className="animate-float-in mx-auto max-w-5xl space-y-6">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-mint"><Trophy className="h-3.5 w-3.5" /> Resultado · sessão de IA</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Simulado concluído</h1></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><ResultStat label="Aproveitamento nesta sessão" value={`${accuracy}%`} color="text-mint" /><ResultStat label="Acertos" value={`${correctCount} / ${activeQuestions.length}`} color="text-cyan-200" /><ResultStat label="Respondidas" value={`${answeredCount}`} color="text-violet-200" /><ResultStat label="Não respondidas" value={`${activeQuestions.length - answeredCount}`} color="text-amber-200" /></div>
    <Card className="p-5 md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">Revisão da sessão</p><p className="mt-1 text-xs text-slate-500">Comentários didáticos · IA</p></div><Button variant="secondary" onClick={restart}><RotateCcw className="h-4 w-4" />Novo simulado</Button></div><div className="mt-5 space-y-3">{activeQuestions.map((question, index) => { const picked = answers[question.id]; const correct = answerLetter(picked) === answerLetter(question.answer); return <details key={question.id} className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-4"><summary className="flex cursor-pointer list-none items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${correct ? 'bg-mint/10 text-mint' : 'bg-rose-400/10 text-rose-300'}`}>{correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-[10px] text-slate-500">Item {index + 1} · {picked ? `Sua resposta ${questionAnswerDisplay(question.type, picked)}` : 'Sem resposta'}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-200">{question.prompt}</span></span><Badge variant="secondary">Resposta {questionAnswerDisplay(question.type, question.answer)}</Badge></summary><div className="mt-4 border-t border-white/[0.05] pt-4"><div className="flex flex-wrap gap-2"><SubjectBadge subject={question.subject} /><QuestionSourceBadge source={question.source} /></div><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Comentário didático de IA</p><p className="mt-1 text-xs leading-6 text-slate-300">{cleanLegalCommentary(question.gabarito_comentado)}</p><LegalReferenceNote question={question} /></div></details>; })}</div></Card>
  </div>;

  return <div className={`animate-float-in mx-auto max-w-6xl space-y-5 ${focusMode ? 'max-w-4xl' : ''}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><FileQuestion className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-white">Simulado de IA em andamento</p><p className="text-[10px] text-slate-500">Item {currentIndex + 1} de {activeQuestions.length} · {answeredCount} respondidos</p></div></div><div className="flex items-center gap-2">{!timerHidden && <span className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm tabular-nums ${secondsLeft < 120 ? 'border-rose-400/20 bg-rose-400/[0.05] text-rose-200' : 'border-line bg-white/[0.025] text-slate-200'}`}><Clock3 className="h-4 w-4" />{displayTime}</span>}<Button variant="destructive" size="sm" onClick={() => void finishExam()} disabled={finishing || Boolean(savingAnswerId)}>{finishing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{finishing ? 'Salvando…' : 'Finalizar'}</Button></div></div>
    <Progress value={(currentIndex + 1) / activeQuestions.length * 100} className="h-1.5" />
    {sessionError && <Alert className="border-amber-300/15 bg-amber-300/[0.035]"><AlertTitle className="text-amber-100">Resultado ainda não sincronizado</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3">{sessionError}<Button size="sm" variant="secondary" onClick={() => void finishExam()} disabled={finishing || Boolean(savingAnswerId)}><RotateCcw className="h-3.5 w-3.5" />Tentar salvar novamente</Button></AlertDescription></Alert>}
    <div className={`grid gap-4 ${focusMode ? '' : 'lg:grid-cols-[1fr_260px]'}`}>
      <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-5 py-3"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={currentQuestion.subject} /><QuestionSourceBadge source={currentQuestion.source} /></div><span className="text-[10px] text-slate-500">Item {currentIndex + 1}</span></div><div className="p-5 md:p-7"><h2 className="whitespace-pre-line text-base font-medium leading-7 text-slate-100 md:text-lg">{currentQuestion.prompt}</h2><div className="mt-5 space-y-2">{currentQuestion.options.map((option, optionIndex) => { const details = questionOptionDetails(currentQuestion.type, option, optionIndex); const value = details.value; return <button key={`${value}-${option}`} onClick={() => void choose(value)} disabled={finishing || Boolean(savingAnswerId)} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm leading-6 transition ${selectedAnswer === value ? 'border-cyan-300/25 bg-cyan-300/[0.05] text-slate-100' : 'border-white/[0.06] text-slate-400 hover:bg-white/[0.025] hover:text-slate-200'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-[10px] font-bold ${selectedAnswer === value ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.08] text-slate-500'}`}>{details.label}</span>{details.text}</button>; })}</div><div className="mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4"><Button variant="ghost" size="sm" onClick={() => moveTo(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0 || finishing || Boolean(savingAnswerId)}><ArrowLeft className="h-3.5 w-3.5" />Anterior</Button><span role="status" className="text-[10px] text-slate-600">{savingAnswerId === currentQuestion.id ? 'Salvando resposta…' : selectedAnswer ? (currentQuestion.type === 'certo_errado' ? `${questionAnswerDisplay(currentQuestion.type, selectedAnswer)} marcada` : `Alternativa ${selectedAnswer} marcada`) : currentQuestion.type === 'certo_errado' ? 'Marque Certo ou Errado' : 'Selecione uma alternativa'}</span><Button size="sm" onClick={() => currentIndex < activeQuestions.length - 1 ? moveTo(currentIndex + 1) : void finishExam()} disabled={finishing || Boolean(savingAnswerId)}>{currentIndex === activeQuestions.length - 1 ? 'Concluir' : 'Próximo'}<ArrowRight className="h-3.5 w-3.5" /></Button></div></div></Card>
      {!focusMode && <Card className="h-fit p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-200">Navegação</p><p className="mt-1 text-[10px] text-slate-500">Acesse um item</p></div><Badge variant="secondary">{answeredCount}/{activeQuestions.length}</Badge></div><div className="mt-4 grid grid-cols-5 gap-2">{activeQuestions.map((question, index) => <button key={question.id} onClick={() => moveTo(index)} disabled={finishing || Boolean(savingAnswerId)} aria-label={`Ir para item ${index + 1}`} className={`grid h-9 place-items-center rounded-lg border text-xs font-semibold ${currentIndex === index ? 'border-mint/25 bg-mint/10 text-mint' : answers[question.id] ? 'border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200' : 'border-white/[0.06] text-slate-500 hover:bg-white/[0.04]'}`}>{index + 1}</button>)}</div></Card>}
    </div>
    <div className="flex justify-end text-[10px] text-slate-600"><button onClick={() => { if (!savingAnswerId && !finishing && window.confirm('Deseja sair do simulado sem concluir a sessão?')) restart(); }} disabled={Boolean(savingAnswerId) || finishing} className="flex items-center gap-1 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft className="h-3 w-3" />Sair do simulado</button></div>
  </div>;
}

function allocateQuestionCounts(subjectNames: string[], count: number, studyRoleId: StudyRoleId) {
  const weighted = subjectNames.map((name) => ({
    subject: name,
    weight: Math.max(0, getRoleSubject(studyRoleId, name)?.question_count ?? 0),
  })).filter((item) => item.weight > 0);
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return [];

  const allocations = weighted.map((item) => {
    const exact = count * item.weight / totalWeight;
    return { subject: item.subject, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = count - allocations.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...allocations].sort((left, right) => right.remainder - left.remainder)) {
    if (remaining <= 0) break;
    item.count += 1;
    remaining -= 1;
  }
  return allocations.filter((item) => item.count > 0).map(({ subject: allocatedSubject, count: allocatedCount }) => ({ subject: allocatedSubject, count: allocatedCount }));
}

function shuffleQuestions(values: PcpaQuestion[]) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function ToggleOption({ icon: Icon, title, description, checked, onChange }: { icon: typeof Clock3; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <button onClick={onChange} aria-pressed={checked} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${checked ? 'border-cyan-300/20 bg-cyan-300/[0.045]' : 'border-white/[0.06] hover:bg-white/[0.025]'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${checked ? 'bg-cyan-300/10 text-cyan-200' : 'bg-white/[0.04] text-slate-500'}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-200">{title}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span></span><span className={`mt-1 h-4 w-7 shrink-0 rounded-full p-0.5 transition ${checked ? 'bg-mint/60' : 'bg-slate-700'}`}><span className={`block h-3 w-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-3' : ''}`} /></span></button>;
}

function ResultStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <Card className="p-4"><p className="text-[10px] text-slate-500">{label}</p><p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p></Card>;
}
