-- pgcrypto is not guaranteed to be visible inside a hardened SECURITY DEFINER
-- function. The two hashes below are only deterministic fixture identifiers,
-- so use PostgreSQL's built-in md5(text) instead.
--
-- Rebuild the already-deployed function from its catalog definition, changing
-- only those two expressions. Fresh databases receive the corrected source in
-- 20260710237000_create_resettable_demo_account.sql.
DO $$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef('public.reset_demo_workspace()'::regprocedure)
  INTO function_definition;

  function_definition := replace(
    function_definition,
    'encode(digest(actor_id::text || '':adpadz-river-city-demo'', ''sha256''), ''hex'')',
    'md5(actor_id::text || '':adpadz-river-city-demo'')'
  );
  function_definition := replace(
    function_definition,
    'encode(digest(actor_id::text || '':river-city:'' || event_index::text, ''sha256''), ''hex'')',
    'md5(actor_id::text || '':river-city:'' || event_index::text)'
  );

  IF position('digest(' IN function_definition) > 0 THEN
    RAISE EXCEPTION 'Could not replace pgcrypto digest calls in reset_demo_workspace';
  END IF;

  EXECUTE function_definition;
END;
$$;

ALTER FUNCTION public.reset_demo_workspace()
  SET search_path = pg_catalog, public;
