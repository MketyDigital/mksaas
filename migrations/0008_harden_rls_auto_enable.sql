-- The RLS auto-enable event trigger is an internal database safeguard, not a
-- Data API RPC. PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default, which made this SECURITY DEFINER function callable by anon and
-- authenticated roles through Supabase's exposed public schema.
--
-- Self-hosted PostgreSQL does not necessarily define this Supabase-specific
-- helper (or the anon/authenticated roles). Harden it when present without
-- making the portable Mkety content migration depend on Supabase objects.
-- Event-trigger execution does not require client roles to hold EXECUTE on the
-- underlying function, so these revokes preserve the DDL safeguard itself.

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
    END IF;
  END IF;
END
$$;
