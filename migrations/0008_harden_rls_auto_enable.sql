-- The RLS auto-enable event trigger is an internal database safeguard, not a
-- Data API RPC. PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default, which made this SECURITY DEFINER function callable by anon and
-- authenticated roles through Supabase's exposed public schema.
--
-- Event-trigger execution does not require client roles to hold EXECUTE on the
-- underlying function, so revoke external invocation while preserving the DDL
-- safeguard itself.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
