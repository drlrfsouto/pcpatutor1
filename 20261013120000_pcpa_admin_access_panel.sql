-- Secure admin authorization for the PCPA access-request panel.
-- Admin membership is managed only by project owners through the Supabase Dashboard.

CREATE TABLE IF NOT EXISTS public.pcpa_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.pcpa_admins IS
'Administradores do Tutor PCPA. A lista é consultada somente pela Edge Function administrativa com service role.';

ALTER TABLE public.pcpa_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pcpa_admins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pcpa_admins TO service_role;
GRANT SELECT, UPDATE ON TABLE public.pcpa_access_requests TO service_role;
