-- Private, durable storage for AI-created study material and activity.
-- AI items stay separate from the public/official question bank and its statistics.

CREATE TABLE IF NOT EXISTS public.pcpa_ai_simulados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'running', 'completed', 'failed')),
  requested_questions INTEGER NOT NULL CHECK (requested_questions BETWEEN 1 AND 80),
  generated_questions INTEGER NOT NULL DEFAULT 0 CHECK (generated_questions >= 0),
  answered_count INTEGER NOT NULL DEFAULT 0 CHECK (answered_count >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  question_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  timer_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  focus_mode BOOLEAN NOT NULL DEFAULT FALSE,
  timer_seconds INTEGER NOT NULL DEFAULT 1800 CHECK (timer_seconds BETWEEN 900 AND 3600),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, study_role_id)
);

CREATE TABLE IF NOT EXISTS public.pcpa_ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  activity TEXT NOT NULL CHECK (activity IN ('practice', 'flashcards', 'simulado', 'tutor')),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'geral',
  difficulty TEXT NOT NULL DEFAULT 'intermediaria' CHECK (difficulty IN ('facil', 'intermediaria', 'dificil')),
  format TEXT NOT NULL DEFAULT 'mista' CHECK (format IN ('mista', 'multipla_escolha', 'certo_errado')),
  requested_count INTEGER NOT NULL CHECK (requested_count BETWEEN 1 AND 20),
  returned_count INTEGER NOT NULL DEFAULT 0 CHECK (returned_count BETWEEN 0 AND 20),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  diagnostic_code TEXT,
  simulado_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, study_role_id),
  FOREIGN KEY (simulado_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_simulados(id, user_id, study_role_id) ON DELETE CASCADE,
  CHECK ((activity = 'simulado') = (simulado_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.pcpa_ai_tutor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  title TEXT NOT NULL DEFAULT 'Nova conversa' CHECK (length(title) <= 120),
  context_subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, study_role_id)
);

CREATE TABLE IF NOT EXISTS public.pcpa_ai_tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 10000),
  generation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conversation_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_tutor_conversations(id, user_id, study_role_id) ON DELETE CASCADE,
  FOREIGN KEY (generation_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_generations(id, user_id, study_role_id) ON DELETE CASCADE,
  CHECK ((role = 'assistant') = (generation_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.pcpa_ai_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'geral',
  type TEXT NOT NULL CHECK (type IN ('multipla_escolha', 'certo_errado')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('facil', 'intermediaria', 'dificil')),
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) >= 30),
  options JSONB NOT NULL CHECK (
    CASE WHEN JSONB_TYPEOF(options) = 'array' THEN
      ((type = 'multipla_escolha' AND JSONB_ARRAY_LENGTH(options) = 5) OR
       (type = 'certo_errado' AND JSONB_ARRAY_LENGTH(options) = 2))
    ELSE FALSE END
  ),
  answer TEXT NOT NULL,
  gabarito_comentado TEXT NOT NULL,
  ponto_de_atencao TEXT,
  flashcard_summary TEXT,
  needs_verification BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, study_role_id),
  FOREIGN KEY (generation_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_generations(id, user_id, study_role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.pcpa_ai_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  generation_id UUID NOT NULL,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  activity TEXT NOT NULL CHECK (activity IN ('practice', 'simulado')),
  simulado_id UUID,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, study_role_id),
  FOREIGN KEY (question_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_questions(id, user_id, study_role_id) ON DELETE CASCADE,
  FOREIGN KEY (generation_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_generations(id, user_id, study_role_id) ON DELETE CASCADE,
  FOREIGN KEY (simulado_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_simulados(id, user_id, study_role_id) ON DELETE CASCADE,
  CHECK ((activity = 'simulado') = (simulado_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcpa_ai_attempts_session_question
  ON public.pcpa_ai_attempts(user_id, simulado_id, question_id)
  WHERE simulado_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pcpa_ai_wrong_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  last_attempt_id UUID,
  wrong_answer TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  mastered BOOLEAN NOT NULL DEFAULT FALSE,
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id, study_role_id),
  FOREIGN KEY (question_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_questions(id, user_id, study_role_id) ON DELETE CASCADE,
  FOREIGN KEY (last_attempt_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_attempts(id, user_id, study_role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.pcpa_ai_flashcard_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  next_review_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id, study_role_id),
  FOREIGN KEY (question_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_questions(id, user_id, study_role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.pcpa_ai_flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  study_role_id TEXT NOT NULL CHECK (study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista')),
  quality INTEGER NOT NULL CHECK (quality BETWEEN 0 AND 5),
  repetitions INTEGER NOT NULL CHECK (repetitions >= 0),
  ease_factor DOUBLE PRECISION NOT NULL CHECK (ease_factor >= 1.3),
  interval_days INTEGER NOT NULL CHECK (interval_days >= 0),
  next_review_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (question_id, user_id, study_role_id)
    REFERENCES public.pcpa_ai_questions(id, user_id, study_role_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pcpa_ai_generations_user_role_created
  ON public.pcpa_ai_generations(user_id, study_role_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_generations_user_activity_status
  ON public.pcpa_ai_generations(user_id, activity, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_questions_user_role_subject
  ON public.pcpa_ai_questions(user_id, study_role_id, subject, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_attempts_user_role_created
  ON public.pcpa_ai_attempts(user_id, study_role_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_wrong_answers_user_role_mastered
  ON public.pcpa_ai_wrong_answers(user_id, study_role_id, mastered, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_flashcard_state_due
  ON public.pcpa_ai_flashcard_state(user_id, study_role_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_simulados_user_role_created
  ON public.pcpa_ai_simulados(user_id, study_role_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_tutor_conversations_user_role_updated
  ON public.pcpa_ai_tutor_conversations(user_id, study_role_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_ai_tutor_messages_conversation_created
  ON public.pcpa_ai_tutor_messages(user_id, conversation_id, created_at);

ALTER TABLE public.pcpa_ai_simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_wrong_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_flashcard_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcpa_ai_flashcard_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_ai_simulados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_ai_tutor_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_ai_tutor_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_ai_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_ai_questions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.pcpa_ai_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_ai_wrong_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_ai_flashcard_state TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.pcpa_ai_flashcard_reviews TO authenticated;

DROP POLICY IF EXISTS "Approved users manage own AI simulados" ON public.pcpa_ai_simulados;
CREATE POLICY "Approved users manage own AI simulados" ON public.pcpa_ai_simulados
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI tutor conversations" ON public.pcpa_ai_tutor_conversations;
CREATE POLICY "Approved users manage own AI tutor conversations" ON public.pcpa_ai_tutor_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI tutor messages" ON public.pcpa_ai_tutor_messages;
CREATE POLICY "Approved users manage own AI tutor messages" ON public.pcpa_ai_tutor_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI generations" ON public.pcpa_ai_generations;
CREATE POLICY "Approved users manage own AI generations" ON public.pcpa_ai_generations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI questions" ON public.pcpa_ai_questions;
CREATE POLICY "Approved users manage own AI questions" ON public.pcpa_ai_questions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI attempts" ON public.pcpa_ai_attempts;
CREATE POLICY "Approved users manage own AI attempts" ON public.pcpa_ai_attempts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI wrong answers" ON public.pcpa_ai_wrong_answers;
CREATE POLICY "Approved users manage own AI wrong answers" ON public.pcpa_ai_wrong_answers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI flashcard state" ON public.pcpa_ai_flashcard_state;
CREATE POLICY "Approved users manage own AI flashcard state" ON public.pcpa_ai_flashcard_state
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Approved users manage own AI flashcard reviews" ON public.pcpa_ai_flashcard_reviews;
CREATE POLICY "Approved users manage own AI flashcard reviews" ON public.pcpa_ai_flashcard_reviews
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

CREATE OR REPLACE FUNCTION public.record_pcpa_ai_attempt(
  p_attempt_id UUID,
  p_question_id UUID,
  p_generation_id UUID,
  p_study_role_id TEXT,
  p_activity TEXT,
  p_selected_answer TEXT,
  p_time_spent_seconds INTEGER DEFAULT 0,
  p_simulado_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attempt_id UUID;
  v_question_type TEXT;
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
BEGIN
  IF v_user_id IS NULL OR NOT public.pcpa_has_approved_access() THEN
    RAISE EXCEPTION 'Acesso aprovado necessário.' USING ERRCODE = '42501';
  END IF;
  IF p_activity NOT IN ('practice', 'simulado') OR p_time_spent_seconds < 0 THEN
    RAISE EXCEPTION 'Parâmetros de tentativa inválidos.' USING ERRCODE = '22023';
  END IF;
  IF (p_activity = 'simulado') <> (p_simulado_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Sessão de simulado incompatível.' USING ERRCODE = '22023';
  END IF;
  SELECT q.type, q.answer INTO v_question_type, v_correct_answer
  FROM public.pcpa_ai_questions q
  JOIN public.pcpa_ai_generations g ON g.id = q.generation_id AND g.user_id = q.user_id AND g.study_role_id = q.study_role_id
  WHERE q.id = p_question_id AND q.user_id = v_user_id
    AND q.generation_id = p_generation_id AND q.study_role_id = p_study_role_id
    AND g.study_role_id = p_study_role_id AND g.activity = p_activity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Questão de IA não pertence a esta conta e trilha.' USING ERRCODE = '42501';
  END IF;
  IF p_selected_answer IS NULL OR
    (v_question_type = 'multipla_escolha' AND upper(trim(p_selected_answer)) !~ '^[A-E]$') OR
    (v_question_type = 'certo_errado' AND upper(trim(p_selected_answer)) NOT IN ('C', 'E')) THEN
    RAISE EXCEPTION 'Alternativa inválida.' USING ERRCODE = '22023';
  END IF;
  v_is_correct := upper(left(trim(p_selected_answer), 1)) = upper(left(trim(v_correct_answer), 1));
  IF p_simulado_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pcpa_ai_simulados s
    WHERE s.id = p_simulado_id AND s.user_id = v_user_id AND s.study_role_id = p_study_role_id
  ) THEN
    RAISE EXCEPTION 'Simulado não pertence a esta conta e trilha.' USING ERRCODE = '42501';
  END IF;

  IF p_simulado_id IS NOT NULL THEN
    INSERT INTO public.pcpa_ai_attempts (
      id, user_id, question_id, generation_id, study_role_id, activity,
      simulado_id, selected_answer, is_correct, time_spent_seconds
    ) VALUES (
      p_attempt_id, v_user_id, p_question_id, p_generation_id, p_study_role_id, p_activity,
      p_simulado_id, p_selected_answer, v_is_correct, p_time_spent_seconds
    )
    ON CONFLICT (user_id, simulado_id, question_id) WHERE simulado_id IS NOT NULL
    DO UPDATE SET
      selected_answer = EXCLUDED.selected_answer,
      is_correct = EXCLUDED.is_correct,
      time_spent_seconds = EXCLUDED.time_spent_seconds
    RETURNING id INTO v_attempt_id;
  ELSE
    INSERT INTO public.pcpa_ai_attempts (
      id, user_id, question_id, generation_id, study_role_id, activity,
      simulado_id, selected_answer, is_correct, time_spent_seconds
    ) VALUES (
      p_attempt_id, v_user_id, p_question_id, p_generation_id, p_study_role_id, p_activity,
      NULL, p_selected_answer, v_is_correct, p_time_spent_seconds
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_attempt_id;
    IF v_attempt_id IS NULL THEN
      SELECT a.id INTO v_attempt_id
      FROM public.pcpa_ai_attempts a
      WHERE a.id = p_attempt_id AND a.user_id = v_user_id
        AND a.question_id = p_question_id AND a.generation_id = p_generation_id
        AND a.study_role_id = p_study_role_id AND a.activity = p_activity
        AND a.simulado_id IS NULL;
    END IF;
  END IF;
  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'Tentativa não foi armazenada.' USING ERRCODE = '40001';
  END IF;

  IF NOT v_is_correct THEN
    INSERT INTO public.pcpa_ai_wrong_answers (
      user_id, question_id, study_role_id, last_attempt_id, wrong_answer,
      attempted_at, reviewed, mastered, updated_at
    ) VALUES (
      v_user_id, p_question_id, p_study_role_id, v_attempt_id, p_selected_answer,
      NOW(), FALSE, FALSE, NOW()
    )
    ON CONFLICT (user_id, question_id, study_role_id) DO UPDATE SET
      last_attempt_id = EXCLUDED.last_attempt_id,
      wrong_answer = EXCLUDED.wrong_answer,
      attempted_at = EXCLUDED.attempted_at,
      reviewed = FALSE,
      mastered = FALSE,
      updated_at = NOW();
  ELSE
    DELETE FROM public.pcpa_ai_wrong_answers
    WHERE user_id = v_user_id AND question_id = p_question_id
      AND study_role_id = p_study_role_id AND last_attempt_id = v_attempt_id;
  END IF;

  RETURN v_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_pcpa_ai_attempt(UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pcpa_ai_attempt(UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_pcpa_ai_flashcard_review(
  p_review_id UUID,
  p_question_id UUID,
  p_study_role_id TEXT,
  p_quality INTEGER,
  p_repetitions INTEGER,
  p_ease_factor DOUBLE PRECISION,
  p_interval_days INTEGER,
  p_next_review_date TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_review_id UUID;
BEGIN
  IF v_user_id IS NULL OR NOT public.pcpa_has_approved_access() THEN
    RAISE EXCEPTION 'Acesso aprovado necessário.' USING ERRCODE = '42501';
  END IF;
  IF p_quality NOT BETWEEN 0 AND 5 OR p_repetitions < 0 OR p_ease_factor < 1.3 OR p_interval_days < 0 THEN
    RAISE EXCEPTION 'Dados SM-2 inválidos.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.pcpa_ai_questions q
    JOIN public.pcpa_ai_generations g ON g.id = q.generation_id AND g.user_id = q.user_id
    WHERE q.id = p_question_id AND q.user_id = v_user_id
      AND q.study_role_id = p_study_role_id AND g.study_role_id = p_study_role_id AND g.activity = 'flashcards'
  ) THEN
    RAISE EXCEPTION 'Flashcard não pertence a esta conta, trilha ou atividade.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pcpa_ai_flashcard_reviews (
    id, user_id, question_id, study_role_id, quality, repetitions,
    ease_factor, interval_days, next_review_date
  ) VALUES (
    p_review_id, v_user_id, p_question_id, p_study_role_id, p_quality, p_repetitions,
    p_ease_factor, p_interval_days, p_next_review_date
  ) ON CONFLICT (id) DO NOTHING;

  SELECT r.id INTO v_review_id
  FROM public.pcpa_ai_flashcard_reviews r
  WHERE r.id = p_review_id AND r.user_id = v_user_id;
  IF v_review_id IS NULL THEN
    RAISE EXCEPTION 'Revisão não foi armazenada.' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.pcpa_ai_flashcard_state (
    user_id, question_id, study_role_id, ease_factor, repetitions,
    interval_days, next_review_date, updated_at
  ) VALUES (
    v_user_id, p_question_id, p_study_role_id, p_ease_factor, p_repetitions,
    p_interval_days, p_next_review_date, NOW()
  )
  ON CONFLICT (user_id, question_id, study_role_id) DO UPDATE SET
    ease_factor = EXCLUDED.ease_factor,
    repetitions = EXCLUDED.repetitions,
    interval_days = EXCLUDED.interval_days,
    next_review_date = EXCLUDED.next_review_date,
    updated_at = NOW();

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_pcpa_ai_flashcard_review(UUID, UUID, TEXT, INTEGER, INTEGER, DOUBLE PRECISION, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pcpa_ai_flashcard_review(UUID, UUID, TEXT, INTEGER, INTEGER, DOUBLE PRECISION, INTEGER, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_pcpa_ai_simulado_answer(
  p_simulado_id UUID,
  p_question_id UUID,
  p_selected_answer TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_question_ids UUID[];
  v_answers JSONB;
  v_study_role_id TEXT;
BEGIN
  IF v_user_id IS NULL OR NOT public.pcpa_has_approved_access() THEN
    RAISE EXCEPTION 'Acesso aprovado necessário.' USING ERRCODE = '42501';
  END IF;
  IF p_selected_answer IS NULL OR length(trim(p_selected_answer)) = 0 THEN
    RAISE EXCEPTION 'Resposta vazia.' USING ERRCODE = '22023';
  END IF;

  SELECT s.question_ids, s.answers, s.study_role_id
    INTO v_question_ids, v_answers, v_study_role_id
  FROM public.pcpa_ai_simulados s
  WHERE s.id = p_simulado_id AND s.user_id = v_user_id AND s.status = 'running'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado não pertence a esta conta ou não está em andamento.' USING ERRCODE = '42501';
  END IF;
  IF NOT (p_question_id = ANY(v_question_ids)) OR NOT EXISTS (
    SELECT 1 FROM public.pcpa_ai_questions q
    WHERE q.id = p_question_id AND q.user_id = v_user_id
      AND q.study_role_id = v_study_role_id
  ) THEN
    RAISE EXCEPTION 'Questão fora desta sessão.' USING ERRCODE = '42501';
  END IF;

  v_answers := jsonb_set(COALESCE(v_answers, '{}'::jsonb), ARRAY[p_question_id::TEXT], to_jsonb(p_selected_answer), TRUE);
  UPDATE public.pcpa_ai_simulados
  SET answers = v_answers,
      answered_count = jsonb_object_length(v_answers),
      updated_at = NOW()
  WHERE id = p_simulado_id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_pcpa_ai_simulado_answer(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pcpa_ai_simulado_answer(UUID, UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.pcpa_ai_generations IS
'Histórico privado de todas as chamadas de geração por IA, incluindo contagem solicitada, retornada, status e atividade.';
COMMENT ON TABLE public.pcpa_ai_questions IS
'Questões originais geradas por IA, privadas por usuário e separadas do banco oficial de questões.';
COMMENT ON TABLE public.pcpa_ai_attempts IS
'Tentativas do estudante em itens de IA; usadas apenas em métricas de IA, nunca no histórico legado de questões reais.';
COMMENT ON TABLE public.pcpa_ai_wrong_answers IS
'Caderno privado de erros para itens autorais de IA.';
COMMENT ON TABLE public.pcpa_ai_flashcard_reviews IS
'Histórico de avaliações SM-2 de flashcards gerados por IA.';
COMMENT ON TABLE public.pcpa_ai_tutor_conversations IS
'Conversas privadas do Tutor IA por usuário e trilha ativa.';
COMMENT ON TABLE public.pcpa_ai_tutor_messages IS
'Mensagens do Tutor IA armazenadas por usuário; respostas vinculadas ao registro da geração correspondente.';
COMMENT ON TABLE public.pcpa_ai_simulados IS
'Resultados e respostas de simulados formados por questões autorais de IA.';
