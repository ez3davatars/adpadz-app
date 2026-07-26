-- Deduplication is destination/scope material, not a hash of unrelated
-- destination overrides. Mailer format is also part of print safety.

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
  campaign_owner_id uuid;
  existing_metadata jsonb := '{}'::jsonb;
  existing_sort_order integer := 0;
  previous_workshop jsonb;
  previous_mailer jsonb;
  next_mailer jsonb;
  previous_mailer_format text;
  next_mailer_format text;
  effective_settings jsonb;
  material_settings jsonb;
  normalized_format text;
  normalized_summary text[];
  selected_template text;
  authoritative_fingerprint text;
  inserted_version_id uuid;
  inserted_version_created_at timestamptz;
  did_insert boolean := false;
  did_affect_print boolean;
  did_create_override boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to save Campaign creative.'
      USING ERRCODE = '42501';
  END IF;

  SELECT campaign.owner_id
  INTO campaign_owner_id
  FROM public.campaigns AS campaign
  WHERE campaign.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.' USING ERRCODE = 'P0002';
  END IF;
  IF campaign_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Campaign owner access required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_destination IS NULL
     OR p_destination NOT IN ('mailer', 'discovery', 'qr', 'social') THEN
    RAISE EXCEPTION 'Choose a supported creative destination.';
  END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('global', 'destination') THEN
    RAISE EXCEPTION 'Choose global or destination creative scope.';
  END IF;

  normalized_format := lower(btrim(COALESCE(p_format_key, '')));
  IF normalized_format !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'Choose a valid creative format.';
  END IF;

  IF p_settings_snapshot IS NULL
     OR jsonb_typeof(p_settings_snapshot) <> 'object'
     OR jsonb_typeof(p_settings_snapshot -> 'global') <> 'object'
     OR octet_length(p_settings_snapshot::text) > 262144 THEN
    RAISE EXCEPTION 'Creative settings must be a valid Workshop snapshot.';
  END IF;

  normalized_summary := COALESCE(p_change_summary, ARRAY[]::text[]);
  IF cardinality(normalized_summary) > 20
     OR EXISTS (
       SELECT 1
       FROM unnest(normalized_summary) AS summary(item)
       WHERE NULLIF(btrim(summary.item), '') IS NULL
          OR char_length(summary.item) > 160
     ) THEN
    RAISE EXCEPTION 'Creative change summary is invalid.';
  END IF;

  effective_settings := COALESCE(
    p_settings_snapshot #> ARRAY['overrides', p_destination],
    p_settings_snapshot -> 'global'
  );
  material_settings := CASE
    WHEN p_scope = 'global' THEN p_settings_snapshot -> 'global'
    ELSE effective_settings
  END;
  selected_template := lower(btrim(COALESCE(
    effective_settings ->> 'template',
    ''
  )));
  IF selected_template !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'Creative snapshot has no valid template family.';
  END IF;

  SELECT output.metadata, output.sort_order
  INTO existing_metadata, existing_sort_order
  FROM public.campaign_outputs AS output
  WHERE output.campaign_id = p_campaign_id
    AND output.output_type = 'interactive_ad'
  FOR UPDATE;

  IF NOT FOUND THEN
    existing_metadata := '{}'::jsonb;
    existing_sort_order := 0;
  END IF;

  previous_workshop := existing_metadata -> 'creative_workshop';
  IF jsonb_typeof(previous_workshop) IS DISTINCT FROM 'object'
     AND jsonb_typeof(existing_metadata -> 'template_settings') = 'object' THEN
    previous_workshop := jsonb_build_object(
      'version', 1,
      'global', existing_metadata -> 'template_settings',
      'overrides', '{}'::jsonb
    );
  END IF;

  previous_mailer := COALESCE(
    previous_workshop #> ARRAY['overrides', 'mailer'],
    previous_workshop -> 'global'
  );
  next_mailer := COALESCE(
    p_settings_snapshot #> ARRAY['overrides', 'mailer'],
    p_settings_snapshot -> 'global'
  );
  previous_mailer_format := COALESCE(
    previous_workshop #>> ARRAY['formats', 'mailer'],
    'standard'
  );
  next_mailer_format := COALESCE(
    p_settings_snapshot #>> ARRAY['formats', 'mailer'],
    'standard'
  );
  did_affect_print := COALESCE(p_affects_print, false)
    OR previous_mailer IS DISTINCT FROM next_mailer
    OR previous_mailer_format IS DISTINCT FROM next_mailer_format;
  did_create_override := COALESCE(p_created_override, false)
    OR (
      p_scope = 'destination'
      AND p_settings_snapshot #> ARRAY['overrides', p_destination] IS NOT NULL
    );

  persisted_metadata := existing_metadata || jsonb_build_object(
    'creative_workshop', p_settings_snapshot,
    'template_settings', p_settings_snapshot -> 'global'
  );

  INSERT INTO public.campaign_outputs (
    campaign_id,
    output_type,
    enabled,
    sort_order,
    metadata
  )
  VALUES (
    p_campaign_id,
    'interactive_ad',
    true,
    existing_sort_order,
    persisted_metadata
  )
  ON CONFLICT (campaign_id, output_type) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      metadata = EXCLUDED.metadata;

  IF did_affect_print THEN
    UPDATE public.campaigns
    SET updated_at = clock_timestamp()
    WHERE id = p_campaign_id;
  END IF;

  authoritative_fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'destination', p_destination,
          'format_key', normalized_format,
          'scope', p_scope,
          'material_settings', material_settings
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

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
    normalized_format,
    selected_template,
    p_settings_snapshot,
    authoritative_fingerprint,
    normalized_summary,
    did_affect_print,
    did_create_override,
    auth.uid()
  )
  ON CONFLICT (
    campaign_id,
    destination,
    settings_fingerprint
  ) DO NOTHING
  RETURNING id, created_at
  INTO inserted_version_id, inserted_version_created_at;

  did_insert := inserted_version_id IS NOT NULL;
  IF NOT did_insert THEN
    SELECT version.id, version.created_at
    INTO inserted_version_id, inserted_version_created_at
    FROM public.campaign_creative_versions AS version
    WHERE version.campaign_id = p_campaign_id
      AND version.destination = p_destination
      AND version.settings_fingerprint = authoritative_fingerprint;
  END IF;

  WITH ranked_versions AS (
    SELECT
      version.id,
      row_number() OVER (
        ORDER BY version.created_at DESC, version.id DESC
      ) AS retention_rank
    FROM public.campaign_creative_versions AS version
    WHERE version.campaign_id = p_campaign_id
      AND version.destination = p_destination
  )
  DELETE FROM public.campaign_creative_versions AS version
  USING ranked_versions AS ranked
  WHERE version.id = ranked.id
    AND ranked.retention_rank > 25
    AND NOT EXISTS (
      SELECT 1
      FROM public.community_mailer_production_snapshots AS production_snapshot
      WHERE production_snapshot.creative_version_id = version.id
    );

  version_id := inserted_version_id;
  version_created := did_insert;
  version_fingerprint := authoritative_fingerprint;
  version_created_at := inserted_version_created_at;
  print_affected := did_affect_print;
  RETURN NEXT;
END;
$$;

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
      AND COALESCE(
        version.settings_snapshot #>> ARRAY['formats', 'mailer'],
        'standard'
      ) IS NOT DISTINCT FROM COALESCE(
        output.metadata #>> ARRAY[
          'creative_workshop',
          'formats',
          'mailer'
        ],
        'standard'
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

NOTIFY pgrst, 'reload schema';
