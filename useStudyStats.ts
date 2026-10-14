import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { getDemoAttempts, getDemoWrongAnswers } from '@/lib/local-storage';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { isVerifiedRealQuestion } from '@/lib/question-provenance';

export interface StudyAttemptSummary {
  id: string;
  question_id: string;
  is_correct: boolean;
  created_at: string;
  question?: Pick<PcpaQuestion, 'subject' | 'source'> | null;
}

export interface StudyStats {
  attempts: StudyAttemptSummary[];
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  wrongAnswerCount: number;
}

export function useStudyStats(userId?: string) {
  return useQuery({
    queryKey: ['study-stats', userId ?? 'local'],
    queryFn: async (): Promise<StudyStats> => {
      if (isSupabaseConfigured && userId) {
        const [{ data: attempts, error: attemptsError }, { data: streak, error: streakError }, { count, error: wrongError }] = await Promise.all([
          supabase.from('pcpa_attempts').select('id,question_id,is_correct,created_at,question:pcpa_questions!inner(subject,source)').eq('user_id', userId).eq('question.source', 'concurso_real').order('created_at', { ascending: false }).limit(500),
          supabase.from('pcpa_study_streaks').select('current_streak,longest_streak,total_study_days').eq('user_id', userId).maybeSingle(),
          supabase.from('pcpa_wrong_answers').select('id,question:pcpa_questions!inner(id,source)', { count: 'exact', head: true }).eq('user_id', userId).eq('mastered', false).eq('question.source', 'concurso_real'),
        ]);
        if (attemptsError) throw attemptsError;
        if (streakError) throw streakError;
        if (wrongError) throw wrongError;
        return {
          attempts: (attempts ?? []) as unknown as StudyAttemptSummary[],
          currentStreak: streak?.current_streak ?? 0,
          longestStreak: streak?.longest_streak ?? 0,
          totalStudyDays: streak?.total_study_days ?? 0,
          wrongAnswerCount: count ?? 0,
        };
      }

      const localAttempts = getDemoAttempts().filter((attempt) => isVerifiedRealQuestion(attempt.question));
      return {
        attempts: localAttempts.map((attempt) => ({
          id: attempt.id,
          question_id: attempt.question_id,
          is_correct: attempt.is_correct,
          created_at: attempt.created_at,
          question: { subject: attempt.question.subject, source: attempt.question.source },
        })),
        currentStreak: getLocalStreak(localAttempts.map((attempt) => attempt.created_at)),
        longestStreak: 0,
        totalStudyDays: new Set(localAttempts.map((attempt) => new Date(attempt.created_at).toDateString())).size,
        wrongAnswerCount: getDemoWrongAnswers().filter((item) => !item.mastered && isVerifiedRealQuestion(item.question)).length,
      };
    },
  });
}

function getLocalStreak(dates: string[]) {
  if (dates.length === 0) return 0;
  const uniqueDays = [...new Set(dates.map((value) => {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }))].sort((a, b) => b - a);
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const day = 86_400_000;
  if (uniqueDays[0] < todayKey - day) return 0;
  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    if (uniqueDays[i - 1] - uniqueDays[i] !== day) break;
    streak += 1;
  }
  return streak;
}
