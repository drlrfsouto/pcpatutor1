import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { getDemoAttempts, getDemoWrongAnswers } from '@/lib/local-storage';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { isVerifiedRealQuestion } from '@/lib/question-provenance';
import { getSubjectsForRole, isSubjectInRole, type StudyRoleId } from '@/lib/constants/subjects';

export interface StudyAttemptSummary {
  id: string;
  study_role_id?: StudyRoleId | null;
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

const EMPTY_STATS: StudyStats = {
  attempts: [],
  currentStreak: 0,
  longestStreak: 0,
  totalStudyDays: 0,
  wrongAnswerCount: 0,
};

export function useStudyStats(userId?: string, studyRoleId?: StudyRoleId) {
  const roleSubjectNames = studyRoleId ? getSubjectsForRole(studyRoleId).map((subject) => subject.name) : null;

  return useQuery({
    queryKey: ['study-stats', userId ?? 'local', studyRoleId ?? 'all'],
    queryFn: async (): Promise<StudyStats> => {
      if (studyRoleId && !roleSubjectNames?.length) return EMPTY_STATS;

      if (isSupabaseConfigured && userId) {
        const attemptsPromise = roleSubjectNames
          ? supabase.from('pcpa_attempts')
            .select('id,study_role_id,question_id,is_correct,created_at,question:pcpa_questions!inner(subject,source)')
            .eq('user_id', userId)
            .or(`study_role_id.is.null,study_role_id.eq.${studyRoleId}`)
            .eq('question.source', 'concurso_real')
            .in('question.subject', roleSubjectNames)
            .order('created_at', { ascending: false })
            .limit(500)
          : supabase.from('pcpa_attempts')
            .select('id,study_role_id,question_id,is_correct,created_at,question:pcpa_questions!inner(subject,source)')
            .eq('user_id', userId)
            .eq('question.source', 'concurso_real')
            .order('created_at', { ascending: false })
            .limit(500);
        const wrongPromise = roleSubjectNames
          ? supabase.from('pcpa_wrong_answers')
            .select('id,question:pcpa_questions!inner(id,source,subject)', { count: 'exact', head: true })
            .eq('user_id', userId)
            .or(`study_role_id.is.null,study_role_id.eq.${studyRoleId}`)
            .eq('mastered', false)
            .eq('question.source', 'concurso_real')
            .in('question.subject', roleSubjectNames)
          : supabase.from('pcpa_wrong_answers')
            .select('id,question:pcpa_questions!inner(id,source)', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('mastered', false)
            .eq('question.source', 'concurso_real');

        const [{ data: attempts, error: attemptsError }, { count, error: wrongError }] = await Promise.all([attemptsPromise, wrongPromise]);
        if (attemptsError) throw attemptsError;
        if (wrongError) throw wrongError;
        const filteredAttempts = ((attempts ?? []) as unknown as StudyAttemptSummary[])
          .filter((attempt) => !studyRoleId || !attempt.study_role_id || attempt.study_role_id === studyRoleId);
        const streaks = getStreakSummary(filteredAttempts.map((attempt) => attempt.created_at));
        return {
          attempts: filteredAttempts,
          currentStreak: streaks.current,
          longestStreak: streaks.longest,
          totalStudyDays: streaks.totalDays,
          wrongAnswerCount: count ?? 0,
        };
      }

      const localAttempts = getDemoAttempts()
        .filter((attempt) => isVerifiedRealQuestion(attempt.question))
        .filter((attempt) => !studyRoleId || isSubjectInRole(studyRoleId, attempt.question.subject))
        .filter((attempt) => !studyRoleId || !attempt.study_role_id || attempt.study_role_id === studyRoleId);
      const streaks = getStreakSummary(localAttempts.map((attempt) => attempt.created_at));
      return {
        attempts: localAttempts.map((attempt) => ({
          id: attempt.id,
          study_role_id: attempt.study_role_id,
          question_id: attempt.question_id,
          is_correct: attempt.is_correct,
          created_at: attempt.created_at,
          question: { subject: attempt.question.subject, source: attempt.question.source },
        })),
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
        totalStudyDays: streaks.totalDays,
        wrongAnswerCount: getDemoWrongAnswers()
          .filter((item) => !item.mastered && isVerifiedRealQuestion(item.question))
          .filter((item) => !studyRoleId || isSubjectInRole(studyRoleId, item.question.subject))
          .filter((item) => !studyRoleId || !item.study_role_id || item.study_role_id === studyRoleId).length,
      };
    },
  });
}

function getStreakSummary(dates: string[]) {
  const dayMs = 86_400_000;
  const uniqueDays = [...new Set(dates.map((value) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }))].sort((a, b) => b - a);
  if (!uniqueDays.length) return { current: 0, longest: 0, totalDays: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    if (uniqueDays[index - 1] - uniqueDays[index] === dayMs) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let current = 0;
  const mostRecentDay = uniqueDays[0];
  if (mostRecentDay === todayKey || mostRecentDay === todayKey - dayMs) {
    current = 1;
    for (let index = 1; index < uniqueDays.length; index += 1) {
      if (uniqueDays[index - 1] - uniqueDays[index] !== dayMs) break;
      current += 1;
    }
  }
  return { current, longest, totalDays: uniqueDays.length };
}
