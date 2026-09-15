-- The RLS auto-enable event trigger is an internal database safeguard, not a
-- Data API RPC. PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default, which made this SECURITY DEFINER function callable by anon and
-- authenticated roles through Supabase's exposed public schema.
--
-- The helper and Supabase client roles are optional outside Supabase. Harden
-- them when present, but keep this migration portable to the private Mkety
-- PostgreSQL runtime where those objects may not exist.

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';

    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
    END IF;
  END IF;
END
$$;
