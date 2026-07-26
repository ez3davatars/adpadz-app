-- Immutable, tenant-owned Creative Workshop history.
--
-- Campaign content remains canonical on campaigns and current presentation
-- state remains canonical on campaign_outputs. These rows retain only the
-- settings and references needed to preview or restore a saved creative state.

CREATE TABLE public.campaign_creative_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  destination text NOT NULL
    CHECK (destination IN ('mailer', 'discovery', 'qr', 'social')),
  scope text NOT NULL
    CHECK (scope IN ('global', 'destination')),
  format_key text NOT NULL
    CHECK (format_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  template_family text NOT NULL
    CHECK (template_family ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  settings_snapshot jsonb NOT NULL
    CHECK (
      jsonb_typeof(settings_snapshot) = 'object'
      AND jsonb_typeof(settings_snapshot -> 'global') = 'object'
      AND octet_length(settings_snapshot::text) <= 262144
    ),
  settings_fingerprint text NOT NULL
    CHECK (settings_fingerprint ~ '^[0-9a-f]{64}$'),
  change_summary text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (
      cardinality(change_summary) <= 20
      AND array_position(change_summary, NULL) IS NULL
    ),
  affects_print boolean NOT NULL DEFAULT false,
  created_override boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_creative_versions_material_version_unique
    UNIQUE (campaign_id, destination, settings_fingerprint)
);

CREATE INDEX campaign_creative_versions_timeline_idx
  ON public.campaign_creative_versions(
    campaign_id,
    destination,
    created_at DESC,
    id DESC
  );

CREATE INDEX campaign_creative_versions_campaign_timeline_idx
  ON public.campaign_creative_versions(
    campaign_id,
    created_at DESC,
    id DESC
  );

ALTER TABLE public.campaign_creative_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.campaign_creative_versions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.campaign_creative_versions TO authenticated;

CREATE POLICY campaign_creative_versions_owner_select
  ON public.campaign_creative_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns AS campaign
      WHERE campaign.id = campaign_creative_versions.campaign_id
        AND campaign.owner_id = auth.uid()
    )
  );

-- Production snapshots are immutable and therefore provide the durable
-- reference that exempts a Creative History row from automatic retention.
ALTER TABLE public.community_mailer_production_snapshots
  ADD COLUMN creative_version_id uuid
    REFERENCES public.campaign_creative_versions(id) ON DELETE RESTRICT;

CREATE INDEX community_mailer_snapshots_creative_version_idx
  ON public.community_mailer_production_snapshots(creative_version_id)
  WHERE creative_version_id IS NOT NULL;

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
    WHERE version.campaign_id = NEW.campaign_id
      AND version.affects_print IS TRUE
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

CREATE TRIGGER community_mailer_snapshots_bind_creative_version
  BEFORE INSERT ON public.community_mailer_production_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.bind_community_mailer_creative_version();

-- Current Workshop persistence and history creation are one transaction.
-- The Campaign row lock serializes concurrent saves for deterministic
-- deduplication and retention.
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
  effective_settings jsonb;
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
  IF jsonb_typeof(previous_workshop) <> 'object'
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
  did_affect_print := COALESCE(p_affects_print, false)
    OR previous_mailer IS DISTINCT FROM next_mailer;
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
          'settings_snapshot', p_settings_snapshot
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

  -- Keep the latest 25 entries for this Campaign/destination. An older row
  -- remains when a production snapshot references it, and the RESTRICT foreign
  -- key independently protects that audit relationship.
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

-- Mission Control inspection remains a narrow, server-authorized cross-tenant
-- read. No administrative bypass policy is added to the customer table.
CREATE OR REPLACE FUNCTION public.get_admin_campaign_creative_versions(
  p_campaign_id uuid,
  p_limit integer DEFAULT 25,
  p_before timestamptz DEFAULT NULL
)
RETURNS SETOF public.campaign_creative_versions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
BEGIN
  IF NOT public.is_adpadz_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Mission Control administrator access required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT version.*
  FROM public.campaign_creative_versions AS version
  WHERE version.campaign_id = p_campaign_id
    AND (p_before IS NULL OR version.created_at < p_before)
  ORDER BY version.created_at DESC, version.id DESC
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_community_mailer_creative_version()
  FROM PUBLIC, anon, authenticated;
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
REVOKE ALL ON FUNCTION public.get_admin_campaign_creative_versions(
  uuid,
  integer,
  timestamptz
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
GRANT EXECUTE ON FUNCTION public.get_admin_campaign_creative_versions(
  uuid,
  integer,
  timestamptz
) TO authenticated;

COMMENT ON TABLE public.campaign_creative_versions IS
  'Immutable, deduplicated Creative Workshop settings history owned by Campaign Engine.';
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
  'Atomically persists current Workshop metadata and an immutable, retained Creative History version.';
COMMENT ON FUNCTION public.get_admin_campaign_creative_versions(
  uuid,
  integer,
  timestamptz
) IS
  'Mission Control-only inspection of immutable Campaign Creative History.';

NOTIFY pgrst, 'reload schema';
