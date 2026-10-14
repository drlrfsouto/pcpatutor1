-- Primeira configuração da área administrativa do Tutor PCPA.
-- Execute uma única vez no SQL Editor do projeto correto, depois de aplicar
-- a migration 20261013120000_pcpa_admin_access_panel.sql.
-- Substitua ADMIN_EMAIL_AQUI pelo e-mail exato que já aparece em Authentication > Users.
-- Esta conta também será aprovada para conseguir abrir a área administrativa.

DO $$
DECLARE
  target_email TEXT := lower(trim('ADMIN_EMAIL_AQUI'));
  target_user_id UUID;
  target_user_email TEXT;
BEGIN
  SELECT id, email
    INTO target_user_id, target_user_email
  FROM auth.users
  WHERE lower(trim(email)) = target_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Não existe usuário em auth.users para o e-mail %; crie/ confirme a conta antes.', target_email;
  END IF;

  INSERT INTO public.pcpa_admins (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.pcpa_access_requests AS existing_request
    (user_id, email, requested_at, approved_at)
  VALUES
    (target_user_id, COALESCE(target_user_email, ''), NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        approved_at = COALESCE(existing_request.approved_at, EXCLUDED.approved_at);

  RAISE NOTICE 'Administrador configurado e acesso aprovado para %.', target_user_email;
END $$;
