-- Persist the active track on attempts, error-notebook entries and mock exams
-- so study history stays attributable to a PCPA role. NULL remains valid for
-- legacy rows written before this migration.
ALTER TABLE public.pcpa_attempts
  ADD COLUMN IF NOT EXISTS study_role_id TEXT;
ALTER TABLE public.pcpa_wrong_answers
  ADD COLUMN IF NOT EXISTS study_role_id TEXT;
ALTER TABLE public.pcpa_simulados
  ADD COLUMN IF NOT EXISTS study_role_id TEXT;
ALTER TABLE public.pcpa_flashcard_state
  ADD COLUMN IF NOT EXISTS study_role_id TEXT;

ALTER TABLE public.pcpa_attempts
  DROP CONSTRAINT IF EXISTS pcpa_attempts_study_role_id_check;
ALTER TABLE public.pcpa_attempts
  ADD CONSTRAINT pcpa_attempts_study_role_id_check
  CHECK (study_role_id IS NULL OR study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista'));

ALTER TABLE public.pcpa_wrong_answers
  DROP CONSTRAINT IF EXISTS pcpa_wrong_answers_study_role_id_check;
ALTER TABLE public.pcpa_wrong_answers
  ADD CONSTRAINT pcpa_wrong_answers_study_role_id_check
  CHECK (study_role_id IS NULL OR study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista'));

ALTER TABLE public.pcpa_simulados
  DROP CONSTRAINT IF EXISTS pcpa_simulados_study_role_id_check;
ALTER TABLE public.pcpa_simulados
  ADD CONSTRAINT pcpa_simulados_study_role_id_check
  CHECK (study_role_id IS NULL OR study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista'));

ALTER TABLE public.pcpa_flashcard_state
  DROP CONSTRAINT IF EXISTS pcpa_flashcard_state_study_role_id_check;
ALTER TABLE public.pcpa_flashcard_state
  ADD CONSTRAINT pcpa_flashcard_state_study_role_id_check
  CHECK (study_role_id IS NULL OR study_role_id IN ('delegado', 'investigador', 'escrivao', 'papiloscopista'));

-- New role-tagged records can coexist for the same question; legacy NULL-role
-- rows remain queryable and are handled by the app's subject filter.
DROP INDEX IF EXISTS public.idx_wrong_answers_user_question;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wrong_answers_user_question_role
  ON public.pcpa_wrong_answers(user_id, question_id, study_role_id);
DROP INDEX IF EXISTS public.idx_flashcard_state_user_question;
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcard_state_user_question_role
  ON public.pcpa_flashcard_state(user_id, question_id, study_role_id);

CREATE INDEX IF NOT EXISTS idx_pcpa_attempts_user_role_created
  ON public.pcpa_attempts(user_id, study_role_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcpa_wrong_answers_user_role_mastered
  ON public.pcpa_wrong_answers(user_id, study_role_id, mastered);
CREATE INDEX IF NOT EXISTS idx_pcpa_flashcard_state_user_role_next_review
  ON public.pcpa_flashcard_state(user_id, study_role_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_pcpa_simulados_user_role_finished
  ON public.pcpa_simulados(user_id, study_role_id, finished_at DESC);
