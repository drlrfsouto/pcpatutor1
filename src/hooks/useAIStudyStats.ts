import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { StudyRoleId } from '@/lib/constants/subjects';

export interface AIStudyAttemptSummary {
  id: string;
  question_id: string;
  activity: 'practice' | 'simulado';
  is_correct: boolean;
  created_at: string;
  subject: string;
}

export interface AIStudyStats {
  generationCalls: number;
  tutorReplies: number;
  failedGenerations: number;
  generatedQuestions: number;
  attempts: AIStudyAttemptSummary[];
  correctAttempts: number;
  accuracy: number;
  flashcardReviews: number;
  openWrongAnswers: number;
  completedSimulados: number;
  bySubject: Record<string, { attempts: number; correct: number }>;
}

const EMPTY_AI_STATS: AIStudyStats = {
  generationCalls: 0,
  tutorReplies: 0,
  failedGenerations: 0,
  generatedQuestions: 0,
  attempts: [],
  correctAttempts: 0,
  accuracy: 0,
  flashcardReviews: 0,
  openWrongAnswers: 0,
  completedSimulados: 0,
  bySubject: {},
};

export function useAIStudyStats(userId?: string, studyRoleId?: StudyRoleId) {
  return useQuery({
    queryKey: ['ai-study-stats', userId ?? 'none', studyRoleId ?? 'none'],
    enabled: Boolean(isSupabaseConfigured && userId && studyRoleId),
    queryFn: async (): Promise<AIStudyStats> => {
      if (!isSupabaseConfigured || !userId || !studyRoleId) return EMPTY_AI_STATS;
      const [generationResult, attemptResult, reviewResult, wrongResult, simuladoResult] = await Promise.all([
        supabase.from('pcpa_ai_generations')
          .select('id, activity, returned_count, status')
          .eq('user_id', userId)
          .eq('study_role_id', studyRoleId)
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase.from('pcpa_ai_attempts')
          .select('id, question_id, activity, is_correct, created_at')
          .eq('user_id', userId)
          .eq('study_role_id', studyRoleId)
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase.from('pcpa_ai_flashcard_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('study_role_id', studyRoleId),
        supabase.from('pcpa_ai_wrong_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('study_role_id', studyRoleId)
          .eq('mastered', false),
        supabase.from('pcpa_ai_simulados')
          .select('id, status')
          .eq('user_id', userId)
          .eq('study_role_id', studyRoleId)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);
      if (generationResult.error) throw generationResult.error;
      if (attemptResult.error) throw attemptResult.error;
      if (reviewResult.error) throw reviewResult.error;
      if (wrongResult.error) throw wrongResult.error;
      if (simuladoResult.error) throw simuladoResult.error;

      const rawAttempts = attemptResult.data ?? [];
      const questionIds = [...new Set(rawAttempts.map((attempt) => String(attempt.question_id)))];
      const questionSubjects = new Map<string, string>();
      if (questionIds.length) {
        const { data: questionRows, error: questionError } = await supabase
          .from('pcpa_ai_questions')
          .select('id, subject')
          .eq('user_id', userId)
          .in('id', questionIds);
        if (questionError) throw questionError;
        for (const question of questionRows ?? []) questionSubjects.set(String(question.id), String(question.subject));
      }

      const attempts: AIStudyAttemptSummary[] = rawAttempts.map((attempt) => ({
        id: String(attempt.id),
        question_id: String(attempt.question_id),
        activity: attempt.activity as 'practice' | 'simulado',
        is_correct: attempt.is_correct === true,
        created_at: String(attempt.created_at),
        subject: questionSubjects.get(String(attempt.question_id)) ?? 'Matéria não identificada',
      }));
      const correctAttempts = attempts.filter((attempt) => attempt.is_correct).length;
      const bySubject = attempts.reduce<Record<string, { attempts: number; correct: number }>>((result, attempt) => {
        result[attempt.subject] ??= { attempts: 0, correct: 0 };
        result[attempt.subject].attempts += 1;
        if (attempt.is_correct) result[attempt.subject].correct += 1;
        return result;
      }, {});
      const generations = generationResult.data ?? [];
      const simulados = simuladoResult.data ?? [];
      return {
        generationCalls: generations.length,
        tutorReplies: generations.filter((generation) => generation.activity === 'tutor' && generation.status === 'succeeded').length,
        failedGenerations: generations.filter((generation) => generation.status === 'failed').length,
        generatedQuestions: generations.reduce((sum, generation) => sum + Number(generation.returned_count ?? 0), 0),
        attempts,
        correctAttempts,
        accuracy: attempts.length ? Math.round(correctAttempts / attempts.length * 100) : 0,
        flashcardReviews: reviewResult.count ?? 0,
        openWrongAnswers: wrongResult.count ?? 0,
        completedSimulados: simulados.filter((session) => session.status === 'completed').length,
        bySubject,
      };
    },
    staleTime: 30_000,
  });
}
