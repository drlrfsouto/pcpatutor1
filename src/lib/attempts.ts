import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { answerLetter, isUuid } from '@/lib/utils';
import { saveDemoAttempt } from '@/lib/local-storage';
import type { StudyRoleId } from '@/lib/constants/subjects';

export async function recordAttempt(question: PcpaQuestion, selectedAnswer: string, seconds: number, studyRoleId: StudyRoleId) {
  const normalizedAnswer = answerLetter(selectedAnswer);
  const isCorrect = normalizedAnswer === answerLetter(question.answer);
  if (question.source !== 'concurso_real') {
    return { id: question.id, isCorrect, persisted: 'none' as const };
  }
  if (!isSupabaseConfigured || !isUuid(question.id)) {
    const saved = saveDemoAttempt(question, selectedAnswer, seconds, studyRoleId);
    return { id: saved.id, isCorrect, persisted: 'local' as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    const saved = saveDemoAttempt(question, selectedAnswer, seconds, studyRoleId);
    return { id: saved.id, isCorrect, persisted: 'local' as const };
  }

  const { data, error } = await supabase.from('pcpa_attempts').insert({
    user_id: user.id,
    question_id: question.id,
    study_role_id: studyRoleId,
    selected_answer: normalizedAnswer,
    is_correct: isCorrect,
    time_spent_seconds: Math.max(0, Math.floor(seconds)),
  }).select('id').single();
  if (error) throw error;
  return { id: data.id as string, isCorrect, persisted: 'supabase' as const };
}
