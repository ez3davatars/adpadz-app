-- Creative History is an event timeline. Suppress only an adjacent duplicate:
-- a save that matches the current latest projection. A previously seen state
-- restored after another state (A -> B -> A) must create a new history row.
--
-- The public save RPC already locks the owning Campaign row before invoking
-- this private helper, so legitimate writes remain serialized while the latest
-- projection is compared and inserted.

ALTER TABLE public.campaign_creative_versions
  DROP CONSTRAINT IF EXISTS
    campaign_creative_versions_material_version_unique;

CREATE OR REPLACE FUNCTION public.save_campaign_creative_projection_internal(
  p_campaign_id uuid,
  p_destination text,
  p_scope text,
  p_format_key text,
  p_template_family text,
  p_settings_snapshot jsonb,
  p_material_settings jsonb,
  p_change_summary text[],
  p_affects_print boolean,
  p_created_override boolean,
  p_actor_id uuid
)
RETURNS TABLE (
  projection_id uuid,
  projection_created boolean,
  projection_fingerprint text,
  projection_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  authoritative_fingerprint text;
  latest_id uuid;
  latest_fingerprint text;
  latest_at timestamptz;
BEGIN
  authoritative_fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'destination', p_destination,
          'scope', p_scope,
          'format_key', p_format_key,
          'material_settings', p_material_settings,
          'affects_print', p_affects_print
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT
    version.id,
    version.settings_fingerprint,
    version.created_at
  INTO
    latest_id,
    latest_fingerprint,
    latest_at
  FROM public.campaign_creative_versions AS version
  WHERE version.campaign_id = p_campaign_id
    AND version.destination = p_destination
  ORDER BY version.created_at DESC, version.id DESC
  LIMIT 1;

  IF latest_id IS NOT NULL
     AND latest_fingerprint IS NOT DISTINCT FROM authoritative_fingerprint THEN
    projection_id := latest_id;
    projection_created := false;
    projection_fingerprint := authoritative_fingerprint;
    projection_created_at := latest_at;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.campaign_creative_versions (
    campaign_id,
    destination,
    scope,
    format_key,
    template_family,
    settings_snapshot,
    settings_fingerprint,
    change_summary,
    affects_print,
    created_override,
    created_by
  )
  VALUES (
    p_campaign_id,
    p_destination,
    p_scope,
    p_format_key,
    p_template_family,
    p_settings_snapshot,
    authoritative_fingerprint,
    p_change_summary,
    p_affects_print,
    p_created_override,
    p_actor_id
  )
  RETURNING id, created_at
  INTO latest_id, latest_at;

  projection_id := latest_id;
  projection_created := true;
  projection_fingerprint := authoritative_fingerprint;
  projection_created_at := latest_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_campaign_creative_projection_internal(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text[],
  boolean,
  boolean,
  uuid
) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.save_campaign_creative_projection_internal(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text[],
  boolean,
  boolean,
  uuid
) IS
  'Appends a Campaign creative projection unless it exactly matches that destination''s latest history entry.';

-- The finalized save function's no-change path predates per-destination
-- baselines: it can return the newest row from another destination and skip an
-- explicitly saved destination that has no history yet. Keep its established
-- validation and persistence behavior private, then correct only that returned
-- baseline after the transactional save has completed. The Campaign row lock
-- acquired by the internal function remains held until this outer transaction
-- ends.
ALTER FUNCTION public.save_campaign_creative_version(
  uuid,
  text,
  text,
  jsonb,
  text[],
  boolean,
  boolean,
  text
) RENAME TO save_campaign_creative_version_internal;

REVOKE ALL ON FUNCTION public.save_campaign_creative_version_internal(
  uuid,
  text,
  text,
  jsonb,
  text[],
  boolean,
  boolean,
  text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_campaign_creative_version(
  p_campaign_id uuid,
  p_destination text,
  p_format_key text,
  p_settings_snapshot jsonb,
  p_change_summary text[] DEFAULT ARRAY[]::text[],
  p_affects_print boolean DEFAULT false,
  p_created_override boolean DEFAULT false,
  p_scope text DEFAULT 'global'
)
RETURNS TABLE (
  version_id uuid,
  version_created boolean,
  version_fingerprint text,
  version_created_at timestamptz,
  persisted_metadata jsonb,
  print_affected boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  save_result record;
  projection_result record;
  canonical_snapshot jsonb;
  destination_settings jsonb;
  material_settings jsonb;
  template_family text;
BEGIN
  SELECT *
  INTO save_result
  FROM public.save_campaign_creative_version_internal(
    p_campaign_id,
    p_destination,
    p_format_key,
    p_settings_snapshot,
    p_change_summary,
    p_affects_print,
    p_created_override,
    p_scope
  );

  version_id := save_result.version_id;
  version_created := save_result.version_created;
  version_fingerprint := save_result.version_fingerprint;
  version_created_at := save_result.version_created_at;
  persisted_metadata := save_result.persisted_metadata;
  print_affected := save_result.print_affected;

  -- Changed saves already append every material projection. For a no-change
  -- save, return this destination's latest row instead of another
  -- destination's newer row.
  IF version_created IS NOT TRUE THEN
    SELECT
      version.id,
      version.settings_fingerprint,
      version.created_at
    INTO
      version_id,
      version_fingerprint,
      version_created_at
    FROM public.campaign_creative_versions AS version
    WHERE version.campaign_id = p_campaign_id
      AND version.destination = p_destination
    ORDER BY version.created_at DESC, version.id DESC
    LIMIT 1;

    -- An explicit first save for this destination establishes its baseline
    -- even when another destination already has Campaign history.
    IF version_id IS NULL THEN
      canonical_snapshot :=
        persisted_metadata -> 'creative_workshop';

      IF p_scope = 'global' THEN
        destination_settings := canonical_snapshot -> 'global';
        material_settings := destination_settings;
      ELSE
        destination_settings := COALESCE(
          canonical_snapshot #> ARRAY['overrides', p_destination],
          canonical_snapshot -> 'global'
        );
        material_settings := jsonb_build_object(
          'has_override',
            canonical_snapshot #> ARRAY['overrides', p_destination]
              IS NOT NULL,
          'settings', destination_settings
        );
      END IF;

      template_family := lower(btrim(COALESCE(
        destination_settings ->> 'template',
        ''
      )));

      SELECT *
      INTO projection_result
      FROM public.save_campaign_creative_projection_internal(
        p_campaign_id,
        p_destination,
        p_scope,
        canonical_snapshot #>> ARRAY['formats', p_destination],
        template_family,
        canonical_snapshot,
        material_settings,
        ARRAY['Initial creative version'],
        false,
        false,
        auth.uid()
      );

      version_id := projection_result.projection_id;
      version_created := projection_result.projection_created;
      version_fingerprint := projection_result.projection_fingerprint;
      version_created_at := projection_result.projection_created_at;
    END IF;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_campaign_creative_version(
  uuid,
  text,
  text,
  jsonb,
  text[],
  boolean,
  boolean,
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_campaign_creative_version(
  uuid,
  text,
  text,
  jsonb,
  text[],
  boolean,
  boolean,
  text
) TO authenticated;

COMMENT ON FUNCTION public.save_campaign_creative_version(
  uuid,
  text,
  text,
  jsonb,
  text[],
  boolean,
  boolean,
  text
) IS
  'Atomically saves canonical Campaign creative state and resolves history against the requested destination''s latest entry.';
