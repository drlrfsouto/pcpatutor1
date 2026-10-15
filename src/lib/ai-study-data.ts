import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import type { StudyRoleId } from '@/lib/constants/subjects';

export type AIGenerationActivity = 'practice' | 'flashcards' | 'simulado' | 'tutor';
export type AIQuestionFormat = 'mista' | 'multipla_escolha' | 'certo_errado';
export type AIDifficulty = 'facil' | 'intermediaria' | 'dificil';

export interface BeginAIGenerationInput {
  role: StudyRoleId;
  activity: AIGenerationActivity;
  subject: string;
  topic: string;
  difficulty: AIDifficulty;
  format: AIQuestionFormat;
  count: number;
  simuladoId?: string;
}

export interface AIGenerationHistoryItem {
  id: string;
  activity: AIGenerationActivity;
  subject: string;
  topic: string;
  difficulty: AIDifficulty;
  format: AIQuestionFormat;
  requested_count: number;
  returned_count: number;
  status: 'pending' | 'succeeded' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export interface AITutorConversationRecord {
  id: string;
  study_role_id: StudyRoleId;
  title: string;
  context_subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface AITutorMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generation_id: string | null;
  created_at: string;
}

export interface AIWrongAnswerRecord {
  id: string;
  question_id: string;
  study_role_id: StudyRoleId;
  last_attempt_id: string | null;
  wrong_answer: string;
  attempted_at: string;
  reviewed: boolean;
  mastered: boolean;
  review_count: number;
  last_reviewed_at: string | null;
  question: PcpaQuestion;
}

export interface AIFlashcardProgress {
  question_id: string;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  next_review_date: string;
}

export interface AISimuladoInput {
  role: StudyRoleId;
  subject: string;
  requestedQuestions: number;
  timerHidden: boolean;
  focusMode: boolean;
  timerSeconds: number;
}

export interface AISimuladoHistoryItem {
  id: string;
  study_role_id: StudyRoleId;
  subject: string | null;
  status: 'generating' | 'running' | 'completed' | 'failed';
  requested_questions: number;
  generated_questions: number;
  answered_count: number;
  correct_answers: number;
  question_ids: string[];
  answers: Record<string, string>;
  timer_hidden: boolean;
  focus_mode: boolean;
  timer_seconds: number;
  duration_seconds: number;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface AISimuladoUpdate {
  status?: 'generating' | 'running' | 'completed' | 'failed';
  started_at?: string;
  generated_questions?: number;
  answered_count?: number;
  correct_answers?: number;
  question_ids?: string[];
  answers?: Record<string, string>;
  duration_seconds?: number;
  finished_at?: string | null;
}

export interface AISimuladoAttemptInput {
  question: PcpaQuestion;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

function raiseDatabaseError(error: unknown, fallback: string): never {
  // Keep database details out of the interface; they can contain schema/project information.
  console.error(fallback, error);
  throw new Error(fallback);
}

export async function requireStudyUserId(): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Conecte o Supabase para acessar seus dados de estudo.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Entre em uma conta aprovada para salvar seu progresso.');
  return data.user.id;
}

export async function beginAIGeneration(input: BeginAIGenerationInput) {
  const userId = await requireStudyUserId();
  const id = crypto.randomUUID();
  const row = {
    id,
    user_id: userId,
    study_role_id: input.role,
    activity: input.activity,
    subject: input.subject,
    topic: input.topic,
    difficulty: input.difficulty,
    format: input.format,
    requested_count: input.count,
    returned_count: 0,
    status: 'pending',
    simulado_id: input.simuladoId ?? null,
  };
  const { error } = await supabase.from('pcpa_ai_generations').insert(row);
  if (error) raiseDatabaseError(error, 'Não foi possível registrar esta geração de IA.');
  return { id, userId };
}

export async function completeAIGeneration(
  generationId: string,
  userId: string,
  role: StudyRoleId,
  questions: PcpaQuestion[],
) {
  if (questions.length) {
    const rows = questions.map((question) => ({
      id: question.id,
      user_id: userId,
      generation_id: generationId,
      study_role_id: role,
      subject: question.subject,
      topic: question.topic,
      type: question.type,
      difficulty: question.difficulty,
      prompt: question.prompt,
      options: question.options,
      answer: question.answer,
      gabarito_comentado: question.gabarito_comentado,
      ponto_de_atencao: question.ponto_de_atencao,
      flashcard_summary: question.flashcard_summary,
      needs_verification: question.needs_verification,
      created_at: question.created_at,
    }));
    const { error: questionsError } = await supabase.from('pcpa_ai_questions').insert(rows);
    if (questionsError) {
      await markAIGenerationFailed(generationId, userId);
      raiseDatabaseError(questionsError, 'As questões foram geradas, mas não puderam ser salvas. Tente novamente.');
    }
  }

  const { error } = await supabase
    .from('pcpa_ai_generations')
    .update({ returned_count: questions.length, status: 'succeeded', completed_at: new Date().toISOString() })
    .eq('id', generationId)
    .eq('user_id', userId);
  if (error) {
    await markAIGenerationFailed(generationId, userId);
    raiseDatabaseError(error, 'A geração foi concluída, mas o registro não pôde ser atualizado.');
  }
}

export async function markAIGenerationFailed(generationId: string, userId: string, diagnosticCode = 'generation_failed') {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('pcpa_ai_generations')
    .update({ status: 'failed', diagnostic_code: diagnosticCode.slice(0, 80), completed_at: new Date().toISOString() })
    .eq('id', generationId)
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (error) console.error('Não foi possível atualizar o status da geração de IA.', error);
}

export function mapAIQuestionRow(row: Record<string, unknown>): PcpaQuestion {
  return {
    id: String(row.id ?? ''),
    subject: String(row.subject ?? ''),
    topic: String(row.topic ?? 'geral'),
    type: String(row.type ?? ''),
    difficulty: String(row.difficulty ?? 'intermediaria'),
    prompt: String(row.prompt ?? ''),
    options: Array.isArray(row.options) ? row.options.map((option) => String(option)) : [],
    answer: String(row.answer ?? ''),
    gabarito_comentado: String(row.gabarito_comentado ?? ''),
    ponto_de_atencao: typeof row.ponto_de_atencao === 'string' ? row.ponto_de_atencao : null,
    flashcard_summary: typeof row.flashcard_summary === 'string' ? row.flashcard_summary : null,
    source: 'ai_generated',
    metadata: {},
    needs_verification: row.needs_verification === true,
    created_at: String(row.created_at ?? new Date().toISOString()),
    ai_generation_id: String(row.generation_id ?? ''),
  };
}

export async function loadAIGenerationHistory(
  role: StudyRoleId,
  activity: AIGenerationActivity,
  subject?: string,
  limit = 20,
): Promise<AIGenerationHistoryItem[]> {
  const userId = await requireStudyUserId();
  let query = supabase
    .from('pcpa_ai_generations')
    .select('id, activity, subject, topic, difficulty, format, requested_count, returned_count, status, created_at, completed_at')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .eq('activity', activity)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (subject) query = query.eq('subject', subject);
  const { data, error } = await query;
  if (error) raiseDatabaseError(error, 'Não foi possível carregar o histórico de gerações.');
  return (data ?? []) as unknown as AIGenerationHistoryItem[];
}

export async function loadAIQuestionsForGeneration(generationId: string): Promise<PcpaQuestion[]> {
  const userId = await requireStudyUserId();
  const { data, error } = await supabase
    .from('pcpa_ai_questions')
    .select('*')
    .eq('user_id', userId)
    .eq('generation_id', generationId)
    .order('created_at', { ascending: true });
  if (error) raiseDatabaseError(error, 'Não foi possível reabrir este conjunto de questões.');
  return (data ?? []).map((row) => mapAIQuestionRow(row as Record<string, unknown>));
}

export async function loadAIGeneratedQuestions(
  role: StudyRoleId,
  activity: AIGenerationActivity,
  subject?: string,
  limit = 500,
): Promise<PcpaQuestion[]> {
  const userId = await requireStudyUserId();
  let generationsQuery = supabase
    .from('pcpa_ai_generations')
    .select('id')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .eq('activity', activity)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (subject) generationsQuery = generationsQuery.eq('subject', subject);
  const { data: generationRows, error: generationError } = await generationsQuery;
  if (generationError) raiseDatabaseError(generationError, 'Não foi possível carregar seus materiais de IA.');
  const generationIds = (generationRows ?? []).map((row) => String(row.id));
  if (!generationIds.length) return [];

  const { data, error } = await supabase
    .from('pcpa_ai_questions')
    .select('*')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .in('generation_id', generationIds)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(2000, limit)));
  if (error) raiseDatabaseError(error, 'Não foi possível carregar seus materiais de IA.');
  return (data ?? []).map((row) => mapAIQuestionRow(row as Record<string, unknown>));
}

export async function createAITutorConversation(input: { role: StudyRoleId; title: string; contextSubject?: string | null }) {
  const userId = await requireStudyUserId();
  const id = crypto.randomUUID();
  const { error } = await supabase.from('pcpa_ai_tutor_conversations').insert({
    id,
    user_id: userId,
    study_role_id: input.role,
    title: input.title.trim().slice(0, 120) || 'Nova conversa',
    context_subject: input.contextSubject || null,
  });
  if (error) raiseDatabaseError(error, 'Não foi possível criar a conversa do Tutor.');
  return id;
}

export async function loadAITutorConversations(role: StudyRoleId, limit = 30): Promise<AITutorConversationRecord[]> {
  const userId = await requireStudyUserId();
  const { data, error } = await supabase
    .from('pcpa_ai_tutor_conversations')
    .select('id, study_role_id, title, context_subject, created_at, updated_at')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .order('updated_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) raiseDatabaseError(error, 'Não foi possível carregar o histórico do Tutor.');
  return (data ?? []) as unknown as AITutorConversationRecord[];
}

export async function loadAITutorMessages(conversationId: string, role: StudyRoleId): Promise<AITutorMessageRecord[]> {
  const userId = await requireStudyUserId();
  const { data, error } = await supabase
    .from('pcpa_ai_tutor_messages')
    .select('id, role, content, generation_id, created_at')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) raiseDatabaseError(error, 'Não foi possível abrir esta conversa do Tutor.');
  return (data ?? []) as unknown as AITutorMessageRecord[];
}

export async function saveAITutorMessage(input: {
  conversationId: string;
  role: StudyRoleId;
  messageRole: 'user' | 'assistant';
  content: string;
  generationId?: string | null;
  messageId?: string;
}) {
  const userId = await requireStudyUserId();
  const content = input.content.trim().slice(0, input.messageRole === 'user' ? 3000 : 10000);
  if (!content) return null;
  const id = input.messageId ?? crypto.randomUUID();
  const { error } = await supabase.from('pcpa_ai_tutor_messages').upsert({
    id,
    user_id: userId,
    conversation_id: input.conversationId,
    study_role_id: input.role,
    role: input.messageRole,
    content,
    generation_id: input.generationId ?? null,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) raiseDatabaseError(error, 'Não foi possível salvar a mensagem do Tutor.');
  const { error: updateError } = await supabase
    .from('pcpa_ai_tutor_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.conversationId)
    .eq('user_id', userId);
  if (updateError) raiseDatabaseError(updateError, 'A mensagem foi salva, mas o histórico não pôde ser atualizado.');
  return id;
}

export async function recordAIAttempt(input: {
  question: PcpaQuestion;
  role: StudyRoleId;
  activity: 'practice' | 'simulado';
  selectedAnswer: string;
  timeSpentSeconds?: number;
  simuladoId?: string;
  attemptId?: string;
}) {
  if (!input.question.ai_generation_id) throw new Error('Esta questão não tem um registro de geração associado.');
  const attemptId = input.attemptId ?? crypto.randomUUID();
  const { data, error } = await supabase.rpc('record_pcpa_ai_attempt', {
    p_attempt_id: attemptId,
    p_question_id: input.question.id,
    p_generation_id: input.question.ai_generation_id,
    p_study_role_id: input.role,
    p_activity: input.activity,
    p_selected_answer: input.selectedAnswer,
    p_time_spent_seconds: Math.max(0, Math.floor(input.timeSpentSeconds ?? 0)),
    p_simulado_id: input.simuladoId ?? null,
  });
  if (error) raiseDatabaseError(error, 'Não foi possível salvar a tentativa. Tente novamente.');
  return String(data ?? attemptId);
}

export async function loadAIWrongAnswers(role: StudyRoleId): Promise<AIWrongAnswerRecord[]> {
  const userId = await requireStudyUserId();
  const { data, error } = await supabase
    .from('pcpa_ai_wrong_answers')
    .select('*')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .eq('mastered', false)
    .order('attempted_at', { ascending: false });
  if (error) raiseDatabaseError(error, 'Não foi possível carregar o caderno de erros de IA.');
  const records = data ?? [];
  if (!records.length) return [];
  const questionIds = records.map((row) => String(row.question_id));
  const { data: questionRows, error: questionError } = await supabase
    .from('pcpa_ai_questions')
    .select('*')
    .eq('user_id', userId)
    .in('id', questionIds);
  if (questionError) raiseDatabaseError(questionError, 'Não foi possível carregar as questões do caderno de erros.');
  const questionMap = new Map((questionRows ?? []).map((row) => [String(row.id), mapAIQuestionRow(row as Record<string, unknown>)]));
  return records.flatMap((row) => {
    const question = questionMap.get(String(row.question_id));
    if (!question) return [];
    return [{
      id: String(row.id),
      question_id: String(row.question_id),
      study_role_id: role,
      last_attempt_id: row.last_attempt_id ? String(row.last_attempt_id) : null,
      wrong_answer: String(row.wrong_answer ?? ''),
      attempted_at: String(row.attempted_at ?? ''),
      reviewed: row.reviewed === true,
      mastered: row.mastered === true,
      review_count: Number(row.review_count ?? 0),
      last_reviewed_at: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
      question,
    } satisfies AIWrongAnswerRecord];
  });
}

export async function markAIWrongAnswerMastered(id: string, role: StudyRoleId) {
  const userId = await requireStudyUserId();
  const { error } = await supabase
    .from('pcpa_ai_wrong_answers')
    .update({ mastered: true, reviewed: true, review_count: 1, last_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('study_role_id', role);
  if (error) raiseDatabaseError(error, 'Não foi possível atualizar o caderno de erros.');
}

export async function loadAIFlashcardProgress(role: StudyRoleId): Promise<Record<string, AIFlashcardProgress>> {
  const userId = await requireStudyUserId();
  const { data, error } = await supabase
    .from('pcpa_ai_flashcard_state')
    .select('question_id, repetitions, ease_factor, interval_days, next_review_date')
    .eq('user_id', userId)
    .eq('study_role_id', role);
  if (error) raiseDatabaseError(error, 'Não foi possível carregar o progresso dos flashcards.');
  return Object.fromEntries((data ?? []).map((row) => [String(row.question_id), {
    question_id: String(row.question_id),
    repetitions: Number(row.repetitions ?? 0),
    ease_factor: Number(row.ease_factor ?? 2.5),
    interval_days: Number(row.interval_days ?? 0),
    next_review_date: String(row.next_review_date ?? new Date().toISOString()),
  }]));
}

export async function recordAIFlashcardReview(input: {
  questionId: string;
  role: StudyRoleId;
  quality: number;
  progress: AIFlashcardProgress;
  reviewId?: string;
}) {
  const reviewId = input.reviewId ?? crypto.randomUUID();
  const { error } = await supabase.rpc('record_pcpa_ai_flashcard_review', {
    p_review_id: reviewId,
    p_question_id: input.questionId,
    p_study_role_id: input.role,
    p_quality: input.quality,
    p_repetitions: input.progress.repetitions,
    p_ease_factor: input.progress.ease_factor,
    p_interval_days: input.progress.interval_days,
    p_next_review_date: input.progress.next_review_date,
  });
  if (error) raiseDatabaseError(error, 'Não foi possível salvar esta revisão de flashcard.');
  return reviewId;
}

export async function createAISimulado(input: AISimuladoInput) {
  const userId = await requireStudyUserId();
  const id = crypto.randomUUID();
  const { error } = await supabase.from('pcpa_ai_simulados').insert({
    id,
    user_id: userId,
    study_role_id: input.role,
    subject: input.subject,
    requested_questions: input.requestedQuestions,
    timer_hidden: input.timerHidden,
    focus_mode: input.focusMode,
    timer_seconds: input.timerSeconds,
    status: 'generating',
  });
  if (error) raiseDatabaseError(error, 'Não foi possível iniciar o registro do simulado.');
  return id;
}

export async function updateAISimulado(id: string, updates: AISimuladoUpdate) {
  const userId = await requireStudyUserId();
  const { error } = await supabase
    .from('pcpa_ai_simulados')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) raiseDatabaseError(error, 'Não foi possível salvar o progresso do simulado.');
}

export async function loadAISimuladoHistory(role: StudyRoleId, limit = 20): Promise<AISimuladoHistoryItem[]> {
  const userId = await requireStudyUserId();
  const { data, error } = await supabase
    .from('pcpa_ai_simulados')
    .select('id, study_role_id, subject, status, requested_questions, generated_questions, answered_count, correct_answers, question_ids, answers, timer_hidden, focus_mode, timer_seconds, duration_seconds, started_at, finished_at, created_at')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) raiseDatabaseError(error, 'Não foi possível carregar o histórico de simulados.');
  return (data ?? []).map((row) => ({
    ...(row as unknown as AISimuladoHistoryItem),
    question_ids: Array.isArray(row.question_ids) ? row.question_ids.map((id) => String(id)) : [],
    answers: row.answers && typeof row.answers === 'object' ? row.answers as Record<string, string> : {},
  }));
}

export async function loadAIQuestionsByIds(ids: string[], role: StudyRoleId): Promise<PcpaQuestion[]> {
  if (!ids.length) return [];
  const userId = await requireStudyUserId();
  const { data, error } = await supabase
    .from('pcpa_ai_questions')
    .select('*')
    .eq('user_id', userId)
    .eq('study_role_id', role)
    .in('id', ids);
  if (error) raiseDatabaseError(error, 'Não foi possível abrir as questões do simulado salvo.');
  const questionMap = new Map((data ?? []).map((row) => [String(row.id), mapAIQuestionRow(row as Record<string, unknown>)]));
  return ids.flatMap((id) => questionMap.has(id) ? [questionMap.get(id)!] : []);
}

export async function recordAISimuladoAnswer(simuladoId: string, questionId: string, selectedAnswer: string) {
  const { error } = await supabase.rpc('record_pcpa_ai_simulado_answer', {
    p_simulado_id: simuladoId,
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
  });
  if (error) raiseDatabaseError(error, 'Não foi possível salvar a resposta desta sessão.');
}

export async function saveAISimuladoAttempts(input: {
  id: string;
  role: StudyRoleId;
  answers: Record<string, string>;
  questions: PcpaQuestion[];
  startedAt: number;
}) {
  const attempts = input.questions.flatMap((question) => {
    const selectedAnswer = input.answers[question.id];
    if (!selectedAnswer) return [];
    const isCorrect = answerMatches(question, selectedAnswer);
    return [{ question, selectedAnswer, isCorrect }];
  });
  await Promise.all(attempts.map(({ question, selectedAnswer }) => recordAIAttempt({
    question,
    role: input.role,
    activity: 'simulado',
    selectedAnswer,
    timeSpentSeconds: Math.max(0, Math.round((Date.now() - input.startedAt) / Math.max(attempts.length, 1) / 1000)),
    simuladoId: input.id,
  })));
  return {
    answeredCount: attempts.length,
    correctAnswers: attempts.filter((attempt) => attempt.isCorrect).length,
  };
}

function answerMatches(question: PcpaQuestion, selectedAnswer: string) {
  const getLetter = (value: string) => value.trim().match(/^([A-E])/i)?.[1]?.toUpperCase() ?? '';
  return getLetter(question.answer) === getLetter(selectedAnswer);
}
