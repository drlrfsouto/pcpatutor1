import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CircleHelp,
  Clock3,
  RotateCcw,
  Sparkles,
  Zap,
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
import { filterVerifiedRealQuestions } from '@/lib/question-provenance';
import { getFlashcardProgress, saveFlashcardProgress, type FlashcardProgress } from '@/lib/local-storage';
import { answerLetter, questionAnswerDisplay, questionExplanationLabel, questionOptionDetails } from '@/lib/utils';

interface FlashcardSessionProps { userId?: string }
type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADE_CONFIG: { grade: Grade; label: string; hint: string; quality: number; className: string }[] = [
  { grade: 'again', label: 'Errei', hint: 'Rever em 1 dia', quality: 1, className: 'border-rose-400/20 bg-rose-400/[0.05] text-rose-200 hover:bg-rose-400/10' },
  { grade: 'hard', label: 'Difícil', hint: 'Rever em breve', quality: 3, className: 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100 hover:bg-amber-300/10' },
  { grade: 'good', label: 'Lembrei', hint: 'Intervalo normal', quality: 4, className: 'border-cyan-300/20 bg-cyan-300/[0.05] text-cyan-100 hover:bg-cyan-300/10' },
  { grade: 'easy', label: 'Fácil', hint: 'Aumentar intervalo', quality: 5, className: 'border-mint/20 bg-mint/[0.05] text-mint hover:bg-mint/10' },
];

export function FlashcardSession({ userId }: FlashcardSessionProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['flashcard-questions'],
    queryFn: async (): Promise<PcpaQuestion[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('pcpa_questions').select('*').eq('source', 'concurso_real').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return filterVerifiedRealQuestions((data ?? []) as unknown as PcpaQuestion[]);
    },
  });
  const stateQuery = useQuery({
    queryKey: ['flashcard-states', userId ?? 'local'],
    queryFn: async (): Promise<Record<string, FlashcardProgress>> => {
      if (!isSupabaseConfigured || !userId) return getFlashcardProgress();
      const { data, error } = await supabase.from('pcpa_flashcard_state').select('question_id,repetitions,ease_factor,interval_days,next_review_date').eq('user_id', userId);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.question_id, {
        question_id: row.question_id,
        repetitions: row.repetitions,
        ease_factor: row.ease_factor,
        interval_days: row.interval_days,
        next_review_date: row.next_review_date ?? new Date(0).toISOString(),
      }]));
    },
  });
  const candidateQuestions = useMemo(() => {
    const questions = query.data ?? [];
    const progressByQuestion = stateQuery.data ?? getFlashcardProgress();
    const due = questions.filter((question) => !progressByQuestion[question.id] || new Date(progressByQuestion[question.id].next_review_date) <= new Date());
    return due.length ? due : questions;
  }, [query.data, stateQuery.data]);
  const canInitializeDeck = !isSupabaseConfigured || !userId || stateQuery.isSuccess || stateQuery.isError;
  const [sessionDeck, setSessionDeck] = useState<PcpaQuestion[]>([]);
  useEffect(() => {
    if (canInitializeDeck && candidateQuestions.length && sessionDeck.length === 0) setSessionDeck(candidateQuestions);
  }, [candidateQuestions, canInitializeDeck, sessionDeck.length]);
  const dueQuestions = sessionDeck.length ? sessionDeck : candidateQuestions;
  const card = dueQuestions[index];
  const answerOption = card ? card.options.map((option, optionIndex) => questionOptionDetails(card.type, option, optionIndex)).find((option) => option.value === answerLetter(card.answer))?.text : undefined;

  async function rateCard(quality: number) {
    if (!card) return;
    const allProgress = stateQuery.data ?? getFlashcardProgress();
    const previous = allProgress[card.id] ?? { question_id: card.id, repetitions: 0, ease_factor: 2.5, interval_days: 0, next_review_date: new Date().toISOString() };
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
    const progress = { question_id: card.id, repetitions, ease_factor: easeFactor, interval_days: intervalDays, next_review_date: next.toISOString() };
    saveFlashcardProgress(progress);
    queryClient.setQueryData<Record<string, FlashcardProgress>>(['flashcard-states', userId ?? 'local'], (previousState) => ({ ...(previousState ?? {}), [card.id]: progress }));

    if (isSupabaseConfigured && userId && /^[0-9a-f-]{36}$/i.test(card.id)) {
      const { error } = await supabase.from('pcpa_flashcard_state').upsert({
        user_id: userId,
        question_id: card.id,
        ease_factor: easeFactor,
        repetitions,
        interval_days: intervalDays,
        next_review_date: next.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,question_id' });
      if (error) toast.warning('Revisão salva neste dispositivo', { description: 'A sincronização está temporariamente indisponível.' });
    }
    setReviewed((value) => value + 1);
    setFlipped(false);
    if (index + 1 >= dueQuestions.length) setCompleted(true);
    else setIndex((value) => value + 1);
    await queryClient.invalidateQueries({ queryKey: ['study-stats'] });
  }

  function resetSession() {
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
    setCompleted(false);
  }

  if (query.isLoading || (isSupabaseConfigured && Boolean(userId) && stateQuery.isLoading)) return <Card className="grid min-h-72 place-items-center p-10"><BrainCircuit className="h-6 w-6 animate-pulse text-violet-300" /><p className="mt-3 text-sm text-slate-400">Preparando seus flashcards…</p></Card>;
  if (query.isError) return <Card className="p-8 text-center text-sm text-rose-200">Não foi possível carregar seus flashcards agora. Tente novamente em instantes.</Card>;
  if (!card || !dueQuestions.length) return <Card className="grid min-h-72 place-items-center p-8 text-center"><div><BrainCircuit className="mx-auto h-8 w-8 text-violet-300" /><h2 className="mt-4 text-lg font-semibold text-white">Seu baralho oficial está vazio</h2><p className="mt-2 text-sm text-slate-500">Busque questões reais no Banco de questões. Os flashcards só usam itens com origem oficial verificada.</p></div></Card>;

  return (
    <div className="animate-float-in mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-300"><BrainCircuit className="h-3.5 w-3.5" /> Repetição espaçada</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Flashcards</h1><p className="mt-2 text-sm leading-6 text-slate-400">Recupere a informação da memória antes de virar o cartão. O intervalo se adapta à sua resposta.</p></div><Badge variant="secondary" className="gap-1.5"><Clock3 className="h-3.5 w-3.5 text-cyan-200" />SM-2 adaptativo</Badge></div>
      <Card className="p-4 md:p-5"><div className="flex items-center justify-between text-xs text-slate-400"><span>Cartão {Math.min(index + 1, dueQuestions.length)} de {dueQuestions.length}</span><span>{reviewed} revisados nesta sessão</span></div><Progress value={Math.min(index + (completed ? 1 : 0), dueQuestions.length) / dueQuestions.length * 100} className="mt-3 h-1.5" /></Card>

      {completed ? <Card className="grid min-h-[430px] place-items-center overflow-hidden p-8 text-center"><div className="max-w-md"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint/10 text-mint"><Check className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-semibold text-white">Revisão concluída!</h2><p className="mt-2 text-sm leading-6 text-slate-400">Você revisou {reviewed} {reviewed === 1 ? 'cartão' : 'cartões'} nesta sessão. Sua constância fortalece a memória de longo prazo.</p><div className="mt-6 flex justify-center gap-3"><Button onClick={resetSession}><RotateCcw className="h-4 w-4" />Recomeçar</Button><Button variant="secondary" onClick={() => toast.success('Boa sessão de revisão!')}>Concluir</Button></div></div></Card> : <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-5 py-3"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={card.subject} /><QuestionSourceBadge source={card.source} metadata={card.metadata} /></div><span className="text-[10px] text-slate-500">{card.topic}</span></div>
        <QuestionProvenance question={card} showOfficialAnswer={flipped} className="mx-4 mt-4 md:mx-6" />
        <button onClick={() => setFlipped((value) => !value)} className="group flex min-h-[350px] w-full flex-col items-center justify-center px-6 py-10 text-center transition-colors hover:bg-white/[0.012] md:min-h-[390px] md:px-12">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{flipped ? <><Sparkles className="h-3 w-3 text-mint" /> Resposta</> : <><CircleHelp className="h-3 w-3 text-violet-300" /> Lembre antes de virar</>}</span>
          {!flipped ? <><h2 className="max-w-2xl text-xl font-medium leading-8 text-white md:text-2xl">{card.flashcard_summary || card.prompt}</h2><p className="mt-5 text-xs text-slate-500">Clique para revelar a resposta</p></> : <div className="max-w-2xl animate-float-in"><p className="text-lg font-semibold text-mint">{answerOption || questionAnswerDisplay(card.type, card.answer)}</p><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{questionExplanationLabel(card.metadata)}</p><p className="mt-1 text-sm leading-7 text-slate-300">{card.gabarito_comentado}</p>{card.needs_verification && <p className="mt-4 text-xs text-amber-200">⚠️ Verificar Lei Seca em fonte oficial atualizada.</p>}</div>}
          <span className="mt-8 inline-flex items-center gap-1.5 text-xs text-violet-200/70 group-hover:text-violet-100">{flipped ? 'Voltar ao enunciado' : 'Ver resposta'} <ArrowRight className="h-3.5 w-3.5" /></span>
        </button>
        <div className="border-t border-white/[0.055] p-4 md:px-6">{!flipped ? <Button variant="secondary" className="w-full" onClick={() => setFlipped(true)}><RotateCcw className="h-4 w-4" />Revelar resposta</Button> : <div><p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Como foi a lembrança?</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{GRADE_CONFIG.map((item) => <button key={item.grade} onClick={() => void rateCard(item.quality)} className={`rounded-xl border px-3 py-3 text-left transition ${item.className}`}><span className="block text-xs font-semibold">{item.label}</span><span className="mt-1 block text-[9px] opacity-65">{item.hint}</span></button>)}</div></div>}</div>
      </Card>}

      {!completed && <div className="flex items-center justify-between"><button onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false); }} disabled={index === 0} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" />Anterior</button><div className="flex items-center gap-1.5 text-[10px] text-slate-600"><Zap className="h-3 w-3 text-amber-200" />O algoritmo ajusta a próxima revisão</div><button onClick={() => { setIndex((value) => Math.min(dueQuestions.length - 1, value + 1)); setFlipped(false); }} disabled={index >= dueQuestions.length - 1} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 disabled:opacity-30">Próximo<ArrowRight className="h-3.5 w-3.5" /></button></div>}
    </div>
  );
}
