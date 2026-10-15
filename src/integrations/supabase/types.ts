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
  url_gabarito?: string;
  nome_fonte_gabarito?: string;
  data_aplicacao?: string;
  application_date_evidence_url?: string;
  gabarito_oficial?: string;
  numero_questao?: string;
  caderno?: string;
  source_id?: string;
  gabarito_source_id?: string;
  reproduction_permission?: 'explicit' | 'not_verified';
  license_terms?: string;
  license_evidence_url?: string;
  question_bank_local_id?: string;
  question_bank_version?: string;
  explanation_type?: 'official' | 'ai_assisted';
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
  /** Generation record ID for private AI-created items; never set for official questions. */
  ai_generation_id?: string;
  question_fingerprint?: string | null;
  times_answered?: number;
  times_correct?: number;
  difficulty_rating?: number | null;
}

export interface PcpaAttempt {
  id: string;
  user_id: string;
  study_role_id?: 'delegado' | 'investigador' | 'escrivao' | 'papiloscopista' | null;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_spent_seconds: number;
  confidence_level: number | null;
  created_at: string;
}

export interface WrongAnswerRecord {
  id: string;
  study_role_id?: 'delegado' | 'investigador' | 'escrivao' | 'papiloscopista' | null;
  question_id: string;
  wrong_answer: string;
  attempted_at: string;
  reviewed: boolean;
  mastered: boolean;
  review_count: number;
  last_reviewed_at?: string | null;
  question: PcpaQuestion;
}
