-- Helper: is the caller the original/protected admin?
CREATE OR REPLACE FUNCTION public.is_original_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND lower(email) = 'ryany207@gmail.com'
  )
$$;

-- Grant admin role to an existing account by email.
-- Only the original admin can invoke this.
CREATE OR REPLACE FUNCTION public.grant_admin_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  target uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_original_admin(caller) THEN
    RAISE EXCEPTION 'Only the original admin can grant admin access';
  END IF;

  SELECT id INTO target
  FROM auth.users
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF target IS NULL THEN
    RAISE EXCEPTION 'No account found for email %', _email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('user_id', target, 'email', lower(trim(_email)));
END;
$$;

-- Revoke admin from another account.
-- Only the original admin can invoke this, and they cannot revoke themselves.
CREATE OR REPLACE FUNCTION public.revoke_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_original_admin(caller) THEN
    RAISE EXCEPTION 'Only the original admin can revoke admin access';
  END IF;

  IF _user_id = caller THEN
    RAISE EXCEPTION 'You cannot revoke your own admin role';
  END IF;

  IF public.is_original_admin(_user_id) THEN
    RAISE EXCEPTION 'The original admin cannot be revoked';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND role = 'admin'::public.app_role;
END;
$$;

-- List all admins with their email + grant timestamp.
-- Only the original admin can read this list (returns empty otherwise).
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE(user_id uuid, email text, granted_at timestamptz, is_original boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_original_admin(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    u.email::text,
    ur.created_at AS granted_at,
    (lower(u.email) = 'ryany207@gmail.com') AS is_original
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'admin'::public.app_role
  ORDER BY ur.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_admin_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_original_admin(uuid) TO authenticated;