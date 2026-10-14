import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { isUuid } from '@/lib/utils';
import { saveDemoWrongAnswer } from '@/lib/local-storage';

interface TrackWrongAnswerInput {
  question: PcpaQuestion;
  attemptId?: string | null;
  wrongAnswer: string;
  isCorrect: boolean;
}

export function useWrongAnswerTracker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ question, attemptId, wrongAnswer, isCorrect }: TrackWrongAnswerInput) => {
      if (isCorrect) return null;

      if (!isSupabaseConfigured || !isUuid(question.id)) {
        saveDemoWrongAnswer(question, wrongAnswer);
        return question.id;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        saveDemoWrongAnswer(question, wrongAnswer);
        return question.id;
      }

      const values = {
        user_id: user.id,
        question_id: question.id,
        attempt_id: attemptId && isUuid(attemptId) ? attemptId : null,
        wrong_answer: wrongAnswer,
        attempted_at: new Date().toISOString(),
        reviewed: false,
        mastered: false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('pcpa_wrong_answers').upsert(values, { onConflict: 'user_id,question_id' });
      if (error) throw error;
      return question.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wrong-answers'] });
    },
    onError: (error) => {
      toast.error('Não foi possível salvar no caderno de erros', { description: error.message });
    },
  });
}
