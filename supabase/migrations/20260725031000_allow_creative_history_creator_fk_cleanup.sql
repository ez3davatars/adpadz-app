-- Creative History remains immutable while allowing the auth.users
-- `ON DELETE SET NULL` foreign-key action to preserve a version after its
-- creator account is removed.

CREATE OR REPLACE FUNCTION public.reject_campaign_creative_version_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.created_by IS NOT NULL
     AND NEW.created_by IS NULL
     AND (to_jsonb(NEW) - 'created_by')
       IS NOT DISTINCT FROM (to_jsonb(OLD) - 'created_by')
     AND NOT EXISTS (
       SELECT 1
       FROM auth.users AS creator
       WHERE creator.id = OLD.created_by
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Creative History versions are immutable.';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_campaign_creative_version_update()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.reject_campaign_creative_version_update() IS
  'Rejects Creative History updates except the exact created_by nulling performed after its referenced Auth user is deleted.';

NOTIFY pgrst, 'reload schema';
