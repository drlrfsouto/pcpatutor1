import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';

export interface TutorMessage { role: 'user' | 'assistant'; content: string }

export async function streamTutorReply(
  messages: TutorMessage[],
  questionContext: PcpaQuestion | null,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
) {
  if (!isSupabaseConfigured) throw new Error('O Tutor não está disponível no momento. Tente novamente mais tarde.');
  const { data: { session } } = await supabase.auth.getSession();
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('O Tutor não está disponível no momento. Tente novamente mais tarde.');

  const response = await fetch(`${url}/functions/v1/pcpa-tutor`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session?.access_token ?? anonKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      messages,
      questionContext: questionContext ? {
        subject: questionContext.subject,
        topic: questionContext.topic,
        prompt: questionContext.prompt,
        answer: questionContext.answer,
        gabarito_comentado: questionContext.gabarito_comentado,
      } : null,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(body.error || body.message || `Falha ao conectar ao Tutor (${response.status}).`);
  }
  if (!response.body) throw new Error('A resposta de streaming não está disponível neste navegador.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';
    for (const event of events) {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
      if (!data) continue;
      if (data === '[DONE]') { finished = true; break; }
      try {
        const parsed = JSON.parse(data) as { content?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) onChunk(parsed.content);
      } catch (error) {
        if (error instanceof Error && error.message !== 'Unexpected end of JSON input') throw error;
      }
    }
  }
}
