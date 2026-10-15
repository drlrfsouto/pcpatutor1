import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import type { StudyRoleId } from '@/lib/constants/subjects';
import { answerLetter } from '@/lib/utils';

export interface GenerateAIQuestionsInput {
  role: StudyRoleId;
  subject: string;
  topic?: string;
  difficulty?: string;
  count: number;
  format?: 'mista' | 'multipla_escolha' | 'certo_errado';
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

export function filterAIGeneratedQuestions(values: unknown[], subject: string, difficulty: string, selectedTopic = 'geral') {
  return values
    .filter((value): value is PcpaQuestion => isAIGeneratedQuestion(value, subject, difficulty))
    .filter((question) => selectedTopic === 'geral' || question.topic === selectedTopic);
}

export async function generateAIQuestionBatch(input: GenerateAIQuestionsInput): Promise<PcpaQuestion[]> {
  if (!isSupabaseConfigured) throw new Error('Conecte o Supabase para gerar questões com segurança.');
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 20) {
    throw new Error('Cada solicitação de IA deve pedir entre 1 e 20 questões.');
  }

  const topic = input.topic?.trim() || 'geral';
  const difficulty = input.difficulty?.trim() || 'intermediaria';
  const { data, error } = await supabase.functions.invoke('pcpa-gerar-questoes-autorais', {
    body: {
      role: input.role,
      subject: input.subject,
      topic,
      difficulty,
      count: input.count,
      format: input.format || 'mista',
    },
  });
  if (error) throw error;

  const result = data as { success?: boolean; error?: string; questions?: unknown[] };
  if (!result?.success) throw new Error(result?.error || 'A geração autoral não foi concluída.');
  return filterAIGeneratedQuestions(
    Array.isArray(result.questions) ? result.questions : [],
    input.subject,
    difficulty,
    topic,
  ).slice(0, input.count);
}
