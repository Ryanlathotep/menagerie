GRANT EXECUTE ON FUNCTION public.is_original_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO authenticated;