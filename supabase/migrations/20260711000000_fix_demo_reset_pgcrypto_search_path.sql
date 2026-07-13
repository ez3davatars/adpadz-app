-- The reset RPC uses pgcrypto.digest() for deterministic public slugs and
-- analytics identifiers. Supabase installs pgcrypto in the trusted extensions
-- schema, which was intentionally omitted from the original SECURITY DEFINER
-- search path.
--
-- Keep pg_catalog and public first while adding only the platform-managed
-- extensions schema required by this function.
ALTER FUNCTION public.reset_demo_workspace()
  SET search_path = pg_catalog, public, extensions;
