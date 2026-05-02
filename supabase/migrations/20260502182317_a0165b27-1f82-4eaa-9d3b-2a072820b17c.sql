REVOKE EXECUTE ON FUNCTION public.grant_admin_by_email(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_admins() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_original_admin(uuid) FROM PUBLIC, anon;