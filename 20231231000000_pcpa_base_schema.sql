-- Base schema for Tutor PCPA. The enhancement migration that follows adds
-- source metadata, official subject constraints, gamification and review tooling.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.pcpa_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'geral',
  type TEXT NOT NULL DEFAULT 'multipla_escolha',
  difficulty TEXT NOT NULL DEFAULT 'intermediaria',
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer TEXT NOT NULL,
  gabarito_comentado TEXT NOT NULL,
  ponto_de_atencao TEXT NOT NULL DEFAULT '',
  flashcard_summary TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  needs_verification BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pcpa_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.pcpa_questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pcpa_simulados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT,
  question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  timer_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  focus_mode BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pcpa_flashcard_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.pcpa_questions(id) ON DELETE CASCADE,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pcpa_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_flashcard_state ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.pcpa_questions TO anon, authenticated;
GRANT ALL ON public.pcpa_questions TO service_role;
GRANT SELECT, INSERT ON public.pcpa_attempts TO authenticated;
GRANT ALL ON public.pcpa_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_simulados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_flashcard_state TO authenticated;

DROP POLICY IF EXISTS "Questions are readable by everyone" ON public.pcpa_questions;
CREATE POLICY "Questions are readable by everyone"
  ON public.pcpa_questions FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Users view own attempts" ON public.pcpa_attempts;
CREATE POLICY "Users view own attempts"
  ON public.pcpa_attempts FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own attempts" ON public.pcpa_attempts;
CREATE POLICY "Users insert own attempts"
  ON public.pcpa_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users view own simulados"
  ON public.pcpa_simulados FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users insert own simulados"
  ON public.pcpa_simulados FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users update own simulados"
  ON public.pcpa_simulados FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users delete own simulados"
  ON public.pcpa_simulados FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users view own flashcard state"
  ON public.pcpa_flashcard_state FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users insert own flashcard state"
  ON public.pcpa_flashcard_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users update own flashcard state"
  ON public.pcpa_flashcard_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users delete own flashcard state"
  ON public.pcpa_flashcard_state FOR DELETE
  USING (auth.uid() = user_id);
