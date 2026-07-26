-- Keep immutable history strict even for future privileged write paths, and
-- bind production to the version whose effective Mailer settings match the
-- current canonical campaign output (important when an older version is
-- restored and deduplicated rather than inserted again).

CREATE OR REPLACE FUNCTION public.reject_campaign_creative_version_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Creative History versions are immutable.';
END;
$$;

CREATE TRIGGER campaign_creative_versions_reject_update
  BEFORE UPDATE ON public.campaign_creative_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_campaign_creative_version_update();

CREATE OR REPLACE FUNCTION public.bind_community_mailer_creative_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  bound_version public.campaign_creative_versions%ROWTYPE;
BEGIN
  IF NEW.creative_version_id IS NULL THEN
    SELECT version.*
    INTO bound_version
    FROM public.campaign_creative_versions AS version
    JOIN public.campaign_outputs AS output
      ON output.campaign_id = version.campaign_id
      AND output.output_type = 'interactive_ad'
    WHERE version.campaign_id = NEW.campaign_id
      AND version.affects_print IS TRUE
      AND COALESCE(
        version.settings_snapshot #> ARRAY['overrides', 'mailer'],
        version.settings_snapshot -> 'global'
      ) IS NOT DISTINCT FROM COALESCE(
        output.metadata #> ARRAY[
          'creative_workshop',
          'overrides',
          'mailer'
        ],
        output.metadata #> ARRAY['creative_workshop', 'global'],
        output.metadata -> 'template_settings'
      )
    ORDER BY version.created_at DESC, version.id DESC
    LIMIT 1;

    NEW.creative_version_id := bound_version.id;
  ELSE
    SELECT version.*
    INTO bound_version
    FROM public.campaign_creative_versions AS version
    WHERE version.id = NEW.creative_version_id;
  END IF;

  IF NEW.creative_version_id IS NOT NULL THEN
    IF bound_version.campaign_id IS DISTINCT FROM NEW.campaign_id
       OR bound_version.affects_print IS NOT TRUE THEN
      RAISE EXCEPTION
        'Production creative version must be a print-affecting version of the assigned Campaign.';
    END IF;

    NEW.snapshot := NEW.snapshot || jsonb_build_object(
      'creative_version_id', bound_version.id,
      'creative_settings_fingerprint', bound_version.settings_fingerprint
    );
    NEW.fingerprint := encode(
      extensions.digest(
        convert_to(
          NEW.fingerprint || ':' || bound_version.settings_fingerprint,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_campaign_creative_version_update()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
