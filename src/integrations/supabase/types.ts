import type { SubjectName } from '@/lib/constants/subjects';

export type QuestionSource = 'concurso_real' | 'ai_generated' | 'manual';
export type QuestionDifficulty = 'facil' | 'intermediaria' | 'dificil';

export interface QuestionMetadata {
  concurso?: string;
  banca?: string;
  ano?: number;
  cargo?: string;
  url_fonte?: string;
  nome_fonte?: string;
  data_aplicacao?: string;
  gabarito_oficial?: string;
  numero_questao?: string;
  caderno?: string;
}

export interface PcpaQuestion {
  id: string;
  subject: SubjectName | string;
  topic: string;
  type: string;
  difficulty: QuestionDifficulty | string;
  prompt: string;
  options: string[];
  answer: string;
  gabarito_comentado: string;
  ponto_de_atencao: string | null;
  flashcard_summary: string | null;
  source: QuestionSource;
  metadata: QuestionMetadata | Record<string, never> | null;
  needs_verification: boolean;
  created_at: string;
  times_answered?: number;
  times_correct?: number;
  difficulty_rating?: number | null;
}

export interface PcpaAttempt {
  id: string;
  user_id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_spent_seconds: number;
  confidence_level: number | null;
  created_at: string;
}

export interface WrongAnswerRecord {
  id: string;
  question_id: string;
  wrong_answer: string;
  attempted_at: string;
  reviewed: boolean;
  mastered: boolean;
  review_count: number;
  last_reviewed_at?: string | null;
  question: PcpaQuestion;
}
