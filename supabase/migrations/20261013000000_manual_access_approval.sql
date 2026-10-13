-- Manual approval for new PCPA accounts.
-- Users can read only their own request. Only project administrators should
-- set approved_at from the Supabase Dashboard/SQL Editor.

CREATE TABLE IF NOT EXISTS public.pcpa_access_requests (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

COMMENT ON TABLE public.pcpa_access_requests IS
'Pedidos de acesso ao Tutor PCPA. approved_at NULL significa aguardando aprovação; a aprovação é feita por administrador no painel do projeto.';

CREATE INDEX IF NOT EXISTS idx_pcpa_access_requests_pending
  ON public.pcpa_access_requests(requested_at)
  WHERE approved_at IS NULL;

ALTER TABLE public.pcpa_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pcpa_access_requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.pcpa_access_requests TO authenticated;

DROP POLICY IF EXISTS "Users read own access request" ON public.pcpa_access_requests;
CREATE POLICY "Users read own access request"
  ON public.pcpa_access_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_pcpa_access_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.pcpa_access_requests (user_id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pcpa_access_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_create_pcpa_access_request ON auth.users;
CREATE TRIGGER trigger_create_pcpa_access_request
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pcpa_access_request();

-- Existing accounts also enter the approval queue. The project owner should
-- approve existing trusted accounts after applying this migration.
INSERT INTO public.pcpa_access_requests (user_id, email)
SELECT id, COALESCE(email, '')
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;

CREATE OR REPLACE FUNCTION public.pcpa_has_approved_access()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pcpa_access_requests
    WHERE user_id = auth.uid()
      AND approved_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.pcpa_has_approved_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pcpa_has_approved_access() TO authenticated;

-- Protect each user's saved study data at the database level, not just in the UI.
DROP POLICY IF EXISTS "Users view own attempts" ON public.pcpa_attempts;
CREATE POLICY "Users view own attempts"
  ON public.pcpa_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users insert own attempts" ON public.pcpa_attempts;
CREATE POLICY "Users insert own attempts"
  ON public.pcpa_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Users view own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users view own simulados"
  ON public.pcpa_simulados FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users insert own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users insert own simulados"
  ON public.pcpa_simulados FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users update own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users update own simulados"
  ON public.pcpa_simulados FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users delete own simulados" ON public.pcpa_simulados;
CREATE POLICY "Users delete own simulados"
  ON public.pcpa_simulados FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Users view own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users view own flashcard state"
  ON public.pcpa_flashcard_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users insert own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users insert own flashcard state"
  ON public.pcpa_flashcard_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users update own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users update own flashcard state"
  ON public.pcpa_flashcard_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users delete own flashcard state" ON public.pcpa_flashcard_state;
CREATE POLICY "Users delete own flashcard state"
  ON public.pcpa_flashcard_state FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Users view own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users view own wrong answers"
  ON public.pcpa_wrong_answers FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users insert own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users insert own wrong answers"
  ON public.pcpa_wrong_answers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users update own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users update own wrong answers"
  ON public.pcpa_wrong_answers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users delete own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users delete own wrong answers"
  ON public.pcpa_wrong_answers FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());

DROP POLICY IF EXISTS "Users view own streaks" ON public.pcpa_study_streaks;
CREATE POLICY "Users view own streaks"
  ON public.pcpa_study_streaks FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users insert own streaks" ON public.pcpa_study_streaks;
CREATE POLICY "Users insert own streaks"
  ON public.pcpa_study_streaks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
DROP POLICY IF EXISTS "Users update own streaks" ON public.pcpa_study_streaks;
CREATE POLICY "Users update own streaks"
  ON public.pcpa_study_streaks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.pcpa_has_approved_access())
  WITH CHECK (auth.uid() = user_id AND public.pcpa_has_approved_access());
