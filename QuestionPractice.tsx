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
import { QuestionProvenance } from '@/components/study/QuestionProvenance';
import { QuestionSourceBadge } from '@/components/study/QuestionSourceBadge';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion, QuestionDifficulty } from '@/integrations/supabase/types';
import { PCPA_SUBJECTS, type SubjectName } from '@/lib/constants/subjects';
import { recordAttempt } from '@/lib/attempts';
import { saveDemoAttempt } from '@/lib/local-storage';
import { answerLetter, questionAnswerDisplay, questionExplanationLabel, questionOptionDetails } from '@/lib/utils';
import { filterVerifiedRealQuestions } from '@/lib/question-provenance';
import { useWrongAnswerTracker } from '@/hooks/useWrongAnswerTracker';

const DIFFICULTIES: { value: QuestionDifficulty; label: string }[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'intermediaria', label: 'Intermediária' },
  { value: 'dificil', label: 'Difícil' },
];

type PracticeMode = 'real' | 'ai';
type AIGeneratedFormat = 'mista' | 'multipla_escolha' | 'certo_errado';

const SEARCH_STAGES = [
  'Consultando o acervo local versionado…',
  'Verificando se o acervo já cobre a matéria e o tópico…',
  'Buscando novas questões em fontes oficiais, se necessário…',
  'Conferindo permissão de reprodução, origem e gabarito…',
];

const AI_STAGES = [
  'Preparando uma prática autoral por IA…',
  'Criando itens novos a partir da matéria e do tópico…',
  'Validando formato e gabarito didático…',
];

interface CatalogReference {
  id: string;
  police_civil: string;
  uf: string;
  contest: string;
  bank: string | null;
  cargo: string | null;
  notice_year: number | null;
  application_year: number | null;
  application_date: string | null;
  application_date_evidence_url: string | null;
  caderno: string | null;
  question_url: string | null;
  answer_url: string | null;
  candidate_answer_url: string | null;
  official_contest_url: string | null;
  reproduction_permission: 'explicit' | 'not_verified';
  catalog_status: string;
  verification_note: string;
  license_terms: string | null;
  license_evidence_url: string | null;
}

interface SearchSummary {
  mode?: PracticeMode;
  ai_generated_questions?: number;
  real_questions?: number;
  search_available?: boolean;
  sources_consulted?: string[];
  local_bank_questions?: number;
  existing_database_questions?: number;
  web_questions?: number;
  web_searched?: boolean;
  catalog_version?: string;
  catalog_references?: CatalogReference[];
  message?: string;
}

function isAIGeneratedQuestion(value: unknown, subject: string, difficulty: string): value is PcpaQuestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const question = value as Partial<PcpaQuestion>;
  if (
    question.source !== 'ai_generated' ||
    typeof question.id !== 'string' || !question.id.startsWith('ai-') ||
    question.subject !== subject ||
    question.difficulty !== difficulty ||
    typeof question.topic !== 'string' ||
    typeof question.prompt !== 'string' || question.prompt.trim().length < 30 ||
    typeof question.answer !== 'string' ||
    typeof question.gabarito_comentado !== 'string' || !question.gabarito_comentado.trim() ||
    !(typeof question.ponto_de_atencao === 'string' || question.ponto_de_atencao === null) ||
    !(typeof question.flashcard_summary === 'string' || question.flashcard_summary === null) ||
    typeof question.created_at !== 'string' ||
    !Array.isArray(question.options) || !question.options.every((option) => typeof option === 'string') ||
    typeof question.needs_verification !== 'boolean' ||
    !question.metadata || typeof question.metadata !== 'object' ||
    Object.keys(question.metadata).length !== 0
  ) return false;
  if (question.type === 'certo_errado') {
    return question.options.length === 2 &&
      question.options[0]?.trim() === 'Certo' && question.options[1]?.trim() === 'Errado' &&
      ['C', 'E'].includes(answerLetter(question.answer));
  }
  return question.type === 'multipla_escolha' && question.options.length === 5 &&
    ['A', 'B', 'C', 'D', 'E'].includes(answerLetter(question.answer));
}

function filterAIGeneratedQuestions(values: unknown[], subject: string, difficulty: string) {
  return values.filter((value): value is PcpaQuestion => isAIGeneratedQuestion(value, subject, difficulty));
}

interface QuestionPracticeProps {
  initialSubject?: SubjectName;
  userId?: string;
  onAskTutor: (question: PcpaQuestion) => void;
}

export function QuestionPractice({ initialSubject, userId, onAskTutor }: QuestionPracticeProps) {
  const [subject, setSubject] = useState<string>(initialSubject ?? '');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('real');
  const [aiQuestionFormat, setAIQuestionFormat] = useState<AIGeneratedFormat>('mista');
  const [aiQuestions, setAIQuestions] = useState<PcpaQuestion[]>([]);
  const [difficulty, setDifficulty] = useState<string>('');
  const [topic, setTopic] = useState('geral');
  const [questionCount, setQuestionCount] = useState(5);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [searchStageIndex, setSearchStageIndex] = useState(0);
  const [searchSummary, setSearchSummary] = useState<SearchSummary | null>(null);
  const queryClient = useQueryClient();
  const tracker = useWrongAnswerTracker();
  const lastInitialSubject = useRef(initialSubject);
  const progressStages = practiceMode === 'ai' ? AI_STAGES : SEARCH_STAGES;

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
    if (!generating) {
      setSearchStageIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSearchStageIndex((current) => (current + 1) % progressStages.length);
    }, 2300);
    return () => window.clearInterval(timer);
  }, [generating, progressStages.length]);

  const questionsQuery = useQuery({
    enabled: practiceMode === 'real' && isSupabaseConfigured,
    queryKey: ['questions', subject, difficulty],
    queryFn: async (): Promise<PcpaQuestion[]> => {
      if (!isSupabaseConfigured) return [];
      let query = supabase.from('pcpa_questions').select('*').eq('source', 'concurso_real').order('created_at', { ascending: false }).limit(100);
      if (subject) query = query.eq('subject', subject);
      if (difficulty) query = query.eq('difficulty', difficulty);
      const { data, error } = await query;
      if (error) throw error;
      return filterVerifiedRealQuestions((data ?? []) as unknown as PcpaQuestion[]);
    },
  });
  const questions = practiceMode === 'ai' ? aiQuestions : questionsQuery.data ?? [];
  const question = questions.length ? questions[questionIndex % questions.length] : undefined;
  const correct = question ? answerLetter(question.answer) === answerLetter(selectedAnswer) : false;

  useEffect(() => {
    setQuestionIndex(0);
    setHasAnswered(false);
    setSelectedAnswer('');
    setAIQuestions([]);
    setSearchSummary(null);
    setQuestionStartedAt(Date.now());
  }, [subject, difficulty, practiceMode]);

  const answerOptions = useMemo(() => question
    ? question.options.map((option, index) => ({ ...questionOptionDetails(question.type, option, index), original: option }))
    : [], [question]);

  function clearAIGeneratedSession() {
    if (practiceMode !== 'ai') return;
    setAIQuestions([]);
    setSearchSummary(null);
    setQuestionIndex(0);
    setHasAnswered(false);
    setSelectedAnswer('');
  }

  async function generateQuestions() {
    if (!isSupabaseConfigured) {
      toast.error('Prática indisponível', { description: 'Conecte o Supabase para usar as funções protegidas do aplicativo.' });
      return;
    }
    if (!userId) {
      toast.error('Entre na sua conta', { description: 'A geração de questões exige uma conta aprovada.' });
      return;
    }
    if (!subject) {
      toast.error('Escolha uma matéria', { description: 'Selecione uma das 11 matérias oficiais do PCPA.' });
      return;
    }
    setGenerating(true);
    setSearchStageIndex(0);
    setSearchSummary(null);
    try {
      if (practiceMode === 'ai') {
        const { data, error } = await supabase.functions.invoke('pcpa-gerar-questoes-autorais', {
          body: {
            subject,
            topic: topic.trim() || 'geral',
            difficulty: difficulty || 'intermediaria',
            count: questionCount,
            format: aiQuestionFormat,
          },
        });
        if (error) throw error;
        const result = data as { success?: boolean; error?: string; questions?: unknown[]; message?: string };
        if (!result?.success) throw new Error(result?.error || 'A geração autoral não foi concluída.');
        const generatedQuestions = filterAIGeneratedQuestions(
          Array.isArray(result.questions) ? result.questions : [],
          subject,
          difficulty || 'intermediaria',
        ).slice(0, questionCount);
        setAIQuestions(generatedQuestions);
        setSearchSummary({
          mode: 'ai',
          ai_generated_questions: generatedQuestions.length,
          message: result.message || `${generatedQuestions.length} item(ns) autoral(is) por IA. Não são questões reais e não entram no banco oficial.`,
        });
        setQuestionIndex(0);
        setHasAnswered(false);
        setSelectedAnswer('');
        if (generatedQuestions.length) {
          toast.success(`${generatedQuestions.length} questão(ões) autoral(is) de IA gerada(s).`);
        } else {
          toast.info('A IA não retornou itens novos em formato validável. O banco real permaneceu inalterado.');
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke('pcpa-gerar-questoes', {
        body: { subject, topic: topic.trim() || 'geral', difficulty: difficulty || 'intermediaria', count: questionCount },
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string; questions?: PcpaQuestion[]; search_summary?: SearchSummary; message?: string };
      if (!result?.success) throw new Error(result?.error || 'A busca não encontrou questões oficiais verificáveis.');

      // Nunca usamos itens de IA como se fossem questões reais, inclusive se
      // uma versão antiga da Edge Function ainda os retornasse como fallback.
      const verifiedQuestions = filterVerifiedRealQuestions(Array.isArray(result.questions) ? result.questions : []);
      const searchAvailable = typeof result.search_summary?.search_available === 'boolean'
        ? result.search_summary.search_available
        : verifiedQuestions.length > 0;
      setSearchSummary({
        ...result.search_summary,
        mode: 'real',
        real_questions: verifiedQuestions.length,
        search_available: searchAvailable,
        message: result.message,
      });
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      setQuestionIndex(0);
      setHasAnswered(false);
      setSelectedAnswer('');
      if (verifiedQuestions.length > 0) {
        toast.success(`${verifiedQuestions.length} questão(ões) real(is) com procedência oficial verificadas.`);
      } else if (searchAvailable) {
        toast.info('As fontes consultadas não permitiram confirmar enunciado, alternativas e gabarito oficial. Nenhuma questão artificial foi incluída.');
      } else {
        toast.info('A busca em fontes oficiais está indisponível ou sem configuração. Nenhuma questão artificial foi incluída.');
      }
    } catch {
      toast.error(practiceMode === 'ai' ? 'A geração autoral não pôde ser concluída' : 'A busca não pôde ser concluída', {
        description: practiceMode === 'ai'
          ? 'Tente novamente. Questões autorais não serão misturadas ao banco real nem salvas como oficiais.'
          : 'Tente novamente em instantes. Nenhuma questão criada por IA será usada como substituta.',
      });
    } finally {
      setGenerating(false);
    }
  }

  async function submitAnswer() {
    if (!question || !selectedAnswer || hasAnswered || submitting) return;
    if (practiceMode === 'ai') {
      setHasAnswered(true);
      return;
    }
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

  const isQuestionLoading = practiceMode === 'real' && questionsQuery.isLoading;

  return (
    <div className="animate-float-in mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-mint"><Target className="h-3.5 w-3.5" /> Prática direcionada</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{practiceMode === 'ai' ? 'Prática autoral por IA' : 'Banco de questões'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{practiceMode === 'ai' ? 'Itens novos para estudo, identificados como gerados por IA; não são questões reais e não entram no banco oficial.' : 'Pratique por matéria, entenda cada alternativa e transforme seus erros em revisão inteligente.'}</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.025] px-3 py-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${!isSupabaseConfigured ? 'bg-amber-300' : practiceMode === 'ai' ? 'bg-violet-300' : 'bg-mint'}`} />{!isSupabaseConfigured ? 'Supabase desconectado' : practiceMode === 'ai' ? 'Modo IA separado — não são questões reais' : 'Oficiais com licença verificada'}</div>
      </div>

      <Card>
        <div className="flex items-start gap-3 border-b border-white/[0.055] p-5 md:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Search className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-100">Monte sua sessão</h2><p className="mt-1 text-xs text-slate-500">{practiceMode === 'real' ? 'Consultamos primeiro o acervo local versionado; a busca web só preenche lacunas. Texto integral só entra com permissão explícita e origem/gabarito verificáveis.' : 'A função envia somente matéria e tópico geral, sem texto de prova, e instrui a IA a criar itens originais sem adaptar questões específicas. Eles são identificados como não reais e não entram no banco oficial.'}</p></div>
          <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex"><ShieldCheck className={`h-3 w-3 ${practiceMode === 'ai' ? 'text-violet-200' : 'text-emerald-200'}`} />{practiceMode === 'ai' ? 'Prática autoral separada' : 'Acervo + fontes oficiais'}</Badge>
        </div>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Matéria</span><select className="field-select" value={subject} disabled={generating} onChange={(event) => setSubject(event.target.value)}><option value="">Todas as matérias</option>{PCPA_SUBJECTS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Modo</span><select className="field-select" value={practiceMode} disabled={generating} onChange={(event) => { setPracticeMode(event.target.value as PracticeMode); setSearchSummary(null); setQuestionIndex(0); setHasAnswered(false); setSelectedAnswer(''); }}><option value="real">Questões reais verificadas</option><option value="ai">Prática autoral com IA — não real</option></select></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Tópico geral</span><input className="field-input" value={topic} disabled={generating} onChange={(event) => { setTopic(event.target.value); clearAIGeneratedSession(); }} placeholder="Ex.: segurança pública" /></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Dificuldade</span><select className="field-select" value={difficulty} disabled={generating} onChange={(event) => setDifficulty(event.target.value)}><option value="">Todas</option>{DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {practiceMode === 'ai' && <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Formato dos itens</span><select className="field-select" value={aiQuestionFormat} disabled={generating} onChange={(event) => { setAIQuestionFormat(event.target.value as AIGeneratedFormat); clearAIGeneratedSession(); }}><option value="mista">Misto</option><option value="multipla_escolha">Múltipla escolha</option><option value="certo_errado">Certo ou Errado</option></select></label>}
          <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Questões</span><select className="field-select" value={questionCount} disabled={generating} onChange={(event) => { setQuestionCount(Number(event.target.value)); clearAIGeneratedSession(); }}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select></label>
          <Button onClick={generateQuestions} disabled={generating || !isSupabaseConfigured || !userId || !subject} className="w-full xl:min-w-40">{generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{generating ? practiceMode === 'ai' ? 'Gerando itens autorais…' : 'Consultando o acervo…' : practiceMode === 'ai' ? 'Gerar prática autoral' : 'Consultar acervo e buscar'}</Button>
          {!isSupabaseConfigured && <p className="text-[10px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-3">Conecte o Supabase para usar a busca oficial ou a prática autoral protegida.</p>}
          {isSupabaseConfigured && !userId && <p className="text-[10px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-3">Entre com uma conta aprovada para consultar o acervo ou gerar prática autoral. A geração por IA não salva itens no banco oficial.</p>}
        </CardContent>
      </Card>

      {generating && <div role="status" aria-live="polite" aria-atomic="true" className="animate-float-in overflow-hidden rounded-2xl border border-cyan-300/15 bg-gradient-to-r from-cyan-300/[0.06] via-emerald-300/[0.035] to-cyan-300/[0.06] p-4 shadow-[0_12px_50px_rgba(34,211,238,0.045)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-200"><span className="absolute inset-0 rounded-xl bg-cyan-300/10 animate-pulse" /><LoaderCircle className="relative h-5 w-5 animate-spin" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cyan-100">{progressStages[searchStageIndex]}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{practiceMode === 'ai' ? 'A função envia apenas a matéria e o tópico geral, sem textos de prova, e instrui a IA a criar itens originais. Eles ficam neste modo separado e não são salvos no banco oficial.' : 'Primeiro conferimos o acervo versionado. Só pesquisamos a web se faltarem itens; texto não licenciado fica apenas como metadado e link oficial.'}</p>
          </div>
          <span className="hidden items-end gap-1 pt-2 sm:flex" aria-hidden="true"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-.3s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-.15s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200" /></span>
        </div>
      </div>}

      {searchSummary && <>
        <Alert className={searchSummary.mode === 'ai' ? 'border-violet-300/20 bg-violet-300/[0.045]' : searchSummary.real_questions ? 'border-mint/20 bg-mint/[0.045]' : 'border-amber-300/20 bg-amber-300/[0.045]'}>
          <ShieldCheck className={`h-4 w-4 ${searchSummary.mode === 'ai' ? 'text-violet-200' : searchSummary.real_questions ? 'text-mint' : 'text-amber-200'}`} />
          <AlertTitle className={searchSummary.mode === 'ai' ? 'text-violet-100' : searchSummary.real_questions ? 'text-mint' : 'text-amber-100'}>{searchSummary.mode === 'ai' ? 'Modo IA separado — itens autorais, não são questões reais' : searchSummary.real_questions ? searchSummary.web_searched ? 'Acervo local + pesquisa oficial' : 'Acervo local consultado' : 'Nenhuma questão reproduzível encontrada'}</AlertTitle>
          <AlertDescription>
            {searchSummary.mode === 'ai'
              ? `${searchSummary.ai_generated_questions ?? 0} questão(ões) criada(s) para esta sessão. Conteúdo gerado por IA, não é uma questão real nem foi validado como item de prova; não é adicionado ao banco oficial e não altera seu histórico de questões reais.`
              : searchSummary.message || (searchSummary.search_available ? 'As fontes consultadas não comprovaram permissão de reprodução, enunciado e gabarito suficientes.' : 'A busca web está indisponível. Nenhuma questão artificial foi acrescentada.')}
            {searchSummary.mode !== 'ai' && Boolean(searchSummary.real_questions) && <span className="mt-1 block text-[11px] text-slate-400">{searchSummary.local_bank_questions ?? 0} do arquivo versionado · {searchSummary.existing_database_questions ?? 0} já no banco · {searchSummary.web_questions ?? 0} novas da web · catálogo {searchSummary.catalog_version || 'versionado'}</span>}
          </AlertDescription>
        </Alert>
        {Boolean(searchSummary.catalog_references?.length) && <details className="group rounded-2xl border border-white/[0.07] bg-white/[0.015]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-slate-300"><span>Fontes oficiais já catalogadas ({searchSummary.catalog_references?.length})</span><ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" /></summary>
          <div className="grid gap-2 border-t border-white/[0.05] p-3 md:grid-cols-2">
            {searchSummary.catalog_references?.map((reference) => <article key={reference.id} className="rounded-xl border border-white/[0.05] bg-slate-950/30 p-3">
              <p className="text-xs font-semibold text-slate-200">{reference.police_civil} · {reference.application_year ? `prova ${reference.application_year}` : reference.notice_year ? `edital ${reference.notice_year}` : 'ano não confirmado'}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">{reference.contest}{reference.cargo ? ` · ${reference.cargo}` : ''}{reference.bank ? ` · ${reference.bank}` : ''}</p>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">{reference.reproduction_permission === 'explicit' ? `Permissão expressa: ${reference.license_terms}` : 'Somente metadados e links oficiais; o texto integral não foi copiado.'}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                {reference.question_url && <a href={reference.question_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">Prova/caderno <ExternalLink className="h-3 w-3" /></a>}
                {reference.answer_url && <a href={reference.answer_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">Gabarito oficial <ExternalLink className="h-3 w-3" /></a>}
                {reference.candidate_answer_url && <a href={reference.candidate_answer_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-200 hover:underline">Documento candidato; pareamento pendente <ExternalLink className="h-3 w-3" /></a>}
                {reference.official_contest_url && <a href={reference.official_contest_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">Página do concurso <ExternalLink className="h-3 w-3" /></a>}
                {reference.application_date_evidence_url && <a href={reference.application_date_evidence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">Evidência da data <ExternalLink className="h-3 w-3" /></a>}
                {reference.license_evidence_url && <a href={reference.license_evidence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-200 hover:underline">Evidência da permissão <ExternalLink className="h-3 w-3" /></a>}
              </div>
              <p className="mt-2 border-t border-white/[0.04] pt-2 text-[10px] leading-4 text-slate-600">{reference.verification_note}</p>
            </article>)}
          </div>
        </details>}
      </>}

      {practiceMode === 'real' && questionsQuery.isError && <Alert className="border-rose-400/20 bg-rose-400/[0.06]"><AlertTriangle className="h-4 w-4 text-rose-300" /><AlertTitle className="text-rose-200">Não foi possível carregar as questões</AlertTitle><AlertDescription>Não foi possível atualizar sua lista agora. Tente novamente em instantes.<button onClick={() => questionsQuery.refetch()} className="ml-2 font-semibold text-rose-200 underline">Tentar novamente</button></AlertDescription></Alert>}

      {isQuestionLoading || generating ? <Card className="p-10 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-mint" /><p className="mt-3 text-sm text-slate-400">{generating ? practiceMode === 'ai' ? 'Gerando questões autorais…' : 'Consultando o acervo e validando fontes…' : 'Carregando seu banco de questões oficiais…'}</p></Card> : question ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={question.subject} /><QuestionSourceBadge source={question.source} metadata={question.metadata} />{question.topic && <Badge variant="secondary">{question.topic}</Badge>}</div><span className="text-xs tabular-nums text-slate-500">Questão {questionIndex + 1} de {questions.length}</span></div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-3 md:px-7"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="font-semibold text-slate-300">{question.difficulty === 'facil' ? 'Fácil' : question.difficulty === 'dificil' ? 'Difícil' : 'Intermediária'}</span><span className="h-1 w-1 rounded-full bg-slate-600" />{question.type === 'multipla_escolha' ? 'Múltipla escolha' : question.type === 'certo_errado' ? 'Certo ou Errado' : question.type}</div><div className="flex items-center gap-2"><span className="rounded-lg bg-white/[0.035] px-2 py-1 text-[10px] text-slate-500">{question.type === 'certo_errado' ? 'Julgamento C/E' : 'Resposta única'}</span><button onClick={() => { setHasAnswered(false); setSelectedAnswer(''); }} title="Limpar resposta" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button></div></div>
            <CardContent className="p-5 md:p-7">
              {question.needs_verification && <Alert className="mb-5 border-amber-400/20 bg-amber-400/[0.055] p-3"><AlertTriangle className="h-4 w-4 text-amber-300" /><AlertDescription className="text-xs text-amber-100/80"><strong className="text-amber-200">⚠️ Verificar Lei Seca.</strong> Confirme os dispositivos citados no texto legal atualizado em fonte oficial antes de memorizar.</AlertDescription></Alert>}
              <h2 className="max-w-3xl whitespace-pre-line text-base font-medium leading-7 text-slate-100 md:text-lg md:leading-8">{question.prompt}</h2>
              <QuestionProvenance question={question} showOfficialAnswer={hasAnswered} className="mt-5" />
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
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4"><Button size="sm" onClick={nextQuestion}><ArrowRight className="h-3.5 w-3.5" />Próxima questão</Button><Button size="sm" variant="secondary" onClick={() => onAskTutor(question)}><CircleHelp className="h-3.5 w-3.5" />Perguntar ao tutor</Button>{question.metadata && 'url_fonte' in question.metadata && question.metadata.url_fonte && <a href={question.metadata.url_fonte} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline">Fonte original <ExternalLink className="h-3 w-3" /></a>}</div>
              </div>}

              {!hasAnswered && <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{practiceMode === 'ai' ? 'Selecione sua resposta; esta tentativa não será registrada no banco de questões reais.' : question.type === 'certo_errado' ? 'Marque Certo ou Errado para registrar sua resposta.' : 'Selecione uma alternativa para registrar sua resposta.'}</p><Button onClick={submitAnswer} disabled={!selectedAnswer || submitting} className="min-w-36">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{practiceMode === 'ai' ? 'Conferir resposta' : 'Confirmar resposta'}</Button></div>}
            </CardContent>
          </Card>
          <div className="flex items-center justify-between gap-3"><button onClick={() => { setQuestionIndex((index) => (index - 1 + questions.length) % questions.length); setSelectedAnswer(''); setHasAnswered(false); setQuestionStartedAt(Date.now()); }} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200"><ArrowLeft className="h-3.5 w-3.5" /> Anterior</button><div className="flex-1 px-6"><Progress value={((questionIndex + (hasAnswered ? 1 : 0)) / Math.max(questions.length, 1)) * 100} className="h-1" /></div><button onClick={nextQuestion} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200">Pular <ArrowRight className="h-3.5 w-3.5" /></button></div>
        </div>
      ) : (
        <Card className="grid min-h-72 place-items-center p-8 text-center">
          <div className="max-w-md"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-slate-400"><Search className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-semibold text-white">{practiceMode === 'ai' ? 'Nenhuma questão autoral gerada nesta sessão' : 'Nenhuma questão real nesta seleção'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{practiceMode === 'ai' ? isSupabaseConfigured ? 'Escolha uma matéria e gere uma prática autoral. Os itens serão identificados como IA, não serão questões reais e não entrarão no banco oficial.' : 'Conecte o Supabase para gerar itens autorais neste modo separado. O banco de questões reais continua sem conteúdo artificial.' : isSupabaseConfigured ? 'Escolha uma matéria e consulte o acervo. Se faltar conteúdo, pesquisamos fontes oficiais; itens sem permissão de reprodução não são transcritos nem substituídos por questões inventadas.' : 'A pesquisa de fontes oficiais não está conectada. Para manter este banco 100% real, não exibimos questões de demonstração.'}</p>{isSupabaseConfigured && <Button className="mt-5" onClick={generateQuestions} disabled={!userId || !subject || generating}><Search className="h-4 w-4" />{practiceMode === 'ai' ? 'Gerar prática autoral' : 'Buscar questões oficiais'}</Button>}</div>
        </Card>
      )}

      {question && questions.length > 1 && <div className="flex items-center justify-between text-xs text-slate-500"><span>Questões disponíveis nesta seleção</span><button onClick={() => { setQuestionIndex(0); setSelectedAnswer(''); setHasAnswered(false); }} className="flex items-center gap-1 font-medium text-slate-400 hover:text-mint"><ChevronDown className="h-3.5 w-3.5" />Reiniciar sessão</button></div>}
    </div>
  );
}
