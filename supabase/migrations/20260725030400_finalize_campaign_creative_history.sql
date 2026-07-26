-- Final Creative History hardening.
--
-- 1. Campaign output creative keys have one protected write boundary.
-- 2. A Workshop save versions every material projection it persists.
-- 3. Production can bind only a version matching the effective Mailer state.

-- The historical Campaign bundle function replaces all output rows. Keep that
-- implementation private and expose a wrapper that cannot overwrite canonical
-- Workshop state with caller-supplied metadata.
ALTER FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid)
  RENAME TO save_campaign_bundle_internal;

REVOKE ALL ON FUNCTION public.save_campaign_bundle_internal(jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_campaign_output_creative_boundary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_creative jsonb := '{}'::jsonb;
  new_creative jsonb := '{}'::jsonb;
  write_boundary text := current_setting(
    'adpadz.creative_write_authorized',
    true
  );
  output_table_owner text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_creative := jsonb_strip_nulls(jsonb_build_object(
      'creative_workshop', OLD.metadata -> 'creative_workshop',
      'template_settings', OLD.metadata -> 'template_settings'
    ));
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_creative := jsonb_strip_nulls(jsonb_build_object(
      'creative_workshop', NEW.metadata -> 'creative_workshop',
      'template_settings', NEW.metadata -> 'template_settings'
    ));
  END IF;

  IF old_creative IS NOT DISTINCT FROM new_creative THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Permit a Campaign delete to cascade through its owned outputs. A direct
  -- output delete still sees its parent and must use an authorized boundary.
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (
       SELECT 1
       FROM public.campaigns AS campaign
       WHERE campaign.id = OLD.campaign_id
     ) THEN
    RETURN OLD;
  END IF;

  SELECT pg_get_userbyid(relation.relowner)
  INTO output_table_owner
  FROM pg_catalog.pg_class AS relation
  WHERE relation.oid = 'public.campaign_outputs'::regclass;

  -- Migration and seed maintenance run as the table owner without a JWT.
  -- Authenticated SECURITY DEFINER calls still require the local boundary.
  IF current_user::text IS NOT DISTINCT FROM output_table_owner
     AND auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF current_user::text IS DISTINCT FROM output_table_owner
     OR write_boundary IS NULL
     OR write_boundary NOT IN ('campaign_bundle', 'creative_workshop') THEN
    RAISE EXCEPTION
      'Creative Workshop metadata must be changed through its authorized save workflow.'
      USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS campaign_outputs_protect_creative_metadata
  ON public.campaign_outputs;
CREATE TRIGGER campaign_outputs_protect_creative_metadata
  BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_output_creative_boundary();

REVOKE ALL ON FUNCTION public.enforce_campaign_output_creative_boundary()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_campaign_bundle(
  p_campaign jsonb,
  p_outputs jsonb,
  p_campaign_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  campaign_owner_id uuid;
  existing_output public.campaign_outputs%ROWTYPE;
  existing_creative_metadata jsonb := '{}'::jsonb;
  incoming_metadata jsonb;
  incoming_template_settings jsonb;
  output_value jsonb;
  sanitized_outputs jsonb := '[]'::jsonb;
  saw_interactive_ad boolean := false;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save a campaign'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize bundle saves with Workshop saves before reading the canonical
  -- creative keys that the replacement operation must preserve.
  IF p_campaign_id IS NOT NULL THEN
    SELECT campaign.owner_id
    INTO campaign_owner_id
    FROM public.campaigns AS campaign
    WHERE campaign.id = p_campaign_id
    FOR UPDATE;

    IF NOT FOUND OR campaign_owner_id IS DISTINCT FROM actor_id THEN
      RAISE EXCEPTION 'Campaign not found or not owned by the current user'
        USING ERRCODE = '42501';
    END IF;

    SELECT output.*
    INTO existing_output
    FROM public.campaign_outputs AS output
    WHERE output.campaign_id = p_campaign_id
      AND output.output_type = 'interactive_ad'
    FOR UPDATE;

    IF FOUND THEN
      IF existing_output.metadata ? 'creative_workshop' THEN
        existing_creative_metadata := existing_creative_metadata
          || jsonb_build_object(
            'creative_workshop',
            existing_output.metadata -> 'creative_workshop'
          );
      END IF;
      IF existing_output.metadata ? 'template_settings' THEN
        existing_creative_metadata := existing_creative_metadata
          || jsonb_build_object(
            'template_settings',
            existing_output.metadata -> 'template_settings'
          );
      END IF;
    END IF;
  END IF;

  -- Let the established implementation produce its existing validation errors
  -- for malformed bundle values.
  IF p_outputs IS NULL OR jsonb_typeof(p_outputs) <> 'array' THEN
    PERFORM set_config(
      'adpadz.creative_write_authorized',
      'campaign_bundle',
      true
    );
    RETURN public.save_campaign_bundle_internal(
      p_campaign,
      p_outputs,
      p_campaign_id
    );
  END IF;

  FOR output_value IN
    SELECT item.value
    FROM jsonb_array_elements(p_outputs) AS item(value)
  LOOP
    IF jsonb_typeof(output_value) <> 'object' THEN
      sanitized_outputs := sanitized_outputs
        || jsonb_build_array(output_value);
      CONTINUE;
    END IF;

    IF output_value ->> 'output_type' = 'interactive_ad' THEN
      saw_interactive_ad := true;
    END IF;

    IF output_value ? 'metadata'
       AND jsonb_typeof(output_value -> 'metadata') <> 'object' THEN
      sanitized_outputs := sanitized_outputs
        || jsonb_build_array(output_value);
      CONTINUE;
    END IF;

    incoming_metadata := COALESCE(output_value -> 'metadata', '{}'::jsonb);
    incoming_template_settings := incoming_metadata -> 'template_settings';
    incoming_metadata := incoming_metadata
      - 'creative_workshop'
      - 'template_settings';

    IF output_value ->> 'output_type' = 'interactive_ad' THEN
      IF existing_creative_metadata <> '{}'::jsonb THEN
        incoming_metadata := incoming_metadata || existing_creative_metadata;
      ELSIF incoming_template_settings IS NOT NULL THEN
        IF jsonb_typeof(incoming_template_settings) <> 'object' THEN
          RAISE EXCEPTION 'Initial template settings must be a JSON object.'
            USING ERRCODE = '22023';
        END IF;
        -- Campaign Studio may establish initial template settings. Once those
        -- settings exist, subsequent bundle saves preserve the canonical copy.
        incoming_metadata := incoming_metadata || jsonb_build_object(
          'template_settings',
          incoming_template_settings
        );
      END IF;
    END IF;

    output_value := jsonb_set(
      output_value,
      ARRAY['metadata'],
      incoming_metadata,
      true
    );
    sanitized_outputs := sanitized_outputs
      || jsonb_build_array(output_value);
  END LOOP;

  -- Omitting Interactive Ad deselects it without destroying its canonical
  -- Workshop state. It can be selected again without losing creative history.
  IF NOT saw_interactive_ad
     AND existing_creative_metadata <> '{}'::jsonb THEN
    sanitized_outputs := sanitized_outputs || jsonb_build_array(
      jsonb_build_object(
        'output_type', 'interactive_ad',
        'enabled', false,
        'sort_order', COALESCE(existing_output.sort_order, 0),
        'metadata', existing_creative_metadata
      )
    );
  END IF;

  PERFORM set_config(
    'adpadz.creative_write_authorized',
    'campaign_bundle',
    true
  );
  RETURN public.save_campaign_bundle_internal(
    p_campaign,
    sanitized_outputs,
    p_campaign_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid) IS
  'Safely saves a Campaign bundle while preserving canonical Creative Workshop metadata.';

-- A private helper gives every projection exactly the same authoritative
-- fingerprint and immutable deduplication behavior.
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
  inserted_id uuid;
  inserted_at timestamptz;
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
  ON CONFLICT (
    campaign_id,
    destination,
    settings_fingerprint
  ) DO NOTHING
  RETURNING id, created_at
  INTO inserted_id, inserted_at;

  projection_created := inserted_id IS NOT NULL;
  IF NOT projection_created THEN
    SELECT version.id, version.created_at
    INTO inserted_id, inserted_at
    FROM public.campaign_creative_versions AS version
    WHERE version.campaign_id = p_campaign_id
      AND version.destination = p_destination
      AND version.settings_fingerprint = authoritative_fingerprint;
  END IF;

  projection_id := inserted_id;
  projection_fingerprint := authoritative_fingerprint;
  projection_created_at := inserted_at;
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
  campaign_primary_qr_id uuid;
  canonical_snapshot jsonb;
  existing_metadata jsonb := '{}'::jsonb;
  existing_sort_order integer := 0;
  previous_workshop jsonb;
  previous_global jsonb;
  previous_overrides jsonb := '{}'::jsonb;
  previous_formats jsonb;
  next_global jsonb;
  next_overrides jsonb;
  next_formats jsonb;
  previous_mailer jsonb;
  next_mailer jsonb;
  previous_mailer_format text;
  next_mailer_format text;
  normalized_summary text[];
  destination_name text;
  destination_format text;
  destination_settings jsonb;
  settings_entry record;
  referenced_qr_id uuid;
  referenced_image_asset_id uuid;
  material_settings jsonb;
  template_family text;
  projection_summary text[];
  projection_queue jsonb := '[]'::jsonb;
  projection_item record;
  projection_result record;
  global_changed boolean;
  destination_changed boolean;
  mailer_projection_changed boolean := false;
  did_affect_print boolean;
  projection_affects_print boolean;
  projection_created_override boolean;
  selected_priority integer := -1;
  selected_id uuid;
  selected_fingerprint text;
  selected_created_at timestamptz;
  any_version_created boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to save Campaign creative.'
      USING ERRCODE = '42501';
  END IF;

  SELECT campaign.owner_id, campaign.primary_qr_id
  INTO campaign_owner_id, campaign_primary_qr_id
  FROM public.campaigns AS campaign
  WHERE campaign.id = p_campaign_id
  FOR NO KEY UPDATE;

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

  IF p_settings_snapshot IS NULL
     OR jsonb_typeof(p_settings_snapshot) <> 'object'
     OR p_settings_snapshot ->> 'version' IS DISTINCT FROM '1'
     OR jsonb_typeof(p_settings_snapshot -> 'global') <> 'object'
     OR jsonb_typeof(p_settings_snapshot -> 'overrides') <> 'object'
     OR jsonb_typeof(p_settings_snapshot -> 'formats') <> 'object'
     OR octet_length(p_settings_snapshot::text) > 262144 THEN
    RAISE EXCEPTION 'Creative settings must be a valid Workshop snapshot.';
  END IF;

  canonical_snapshot := p_settings_snapshot;
  next_global := canonical_snapshot -> 'global';
  next_overrides := canonical_snapshot -> 'overrides';
  next_formats := canonical_snapshot -> 'formats';

  -- Older Workshop clients could store Featured Sponsor globally even though
  -- only Mailer can render it. Preserve the effective Mailer treatment, move
  -- it into a Mailer override when needed, and give digital destinations the
  -- established Hero Visual fallback before validating or persisting state.
  IF lower(btrim(COALESCE(next_global ->> 'template', '')))
       = 'featured-sponsor' THEN
    IF NOT (next_overrides ? 'mailer') THEN
      next_overrides := jsonb_set(
        next_overrides,
        ARRAY['mailer'],
        jsonb_set(
          next_global,
          ARRAY['template'],
          to_jsonb('featured-sponsor'::text),
          true
        ),
        true
      );
    END IF;
    next_global := jsonb_set(
      next_global,
      ARRAY['template'],
      to_jsonb('hero-visual'::text),
      true
    );
    canonical_snapshot := jsonb_set(
      jsonb_set(
        canonical_snapshot,
        ARRAY['global'],
        next_global,
        true
      ),
      ARRAY['overrides'],
      next_overrides,
      true
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(next_overrides) AS override_key(key)
    WHERE override_key.key NOT IN ('mailer', 'discovery', 'qr', 'social')
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_each(next_overrides) AS override_item(key, value)
    WHERE jsonb_typeof(override_item.value) <> 'object'
  ) THEN
    RAISE EXCEPTION 'Creative overrides contain an unsupported destination.';
  END IF;

  -- The RPC persists the entire snapshot, so validate every settings object,
  -- not only the projection selected in the UI. This keeps direct RPC callers
  -- inside the same template and tenant boundaries as the Workshop controls.
  FOR settings_entry IN
    SELECT 'global'::text AS destination, next_global AS settings
    UNION ALL
    SELECT override_item.key, override_item.value
    FROM jsonb_each(next_overrides) AS override_item(key, value)
  LOOP
    template_family := lower(btrim(COALESCE(
      settings_entry.settings ->> 'template',
      ''
    )));
    IF settings_entry.settings ->> 'template'
         IS DISTINCT FROM template_family
       OR template_family NOT IN (
      'hero-visual',
      'offer-first',
      'brand-focus',
      'featured-sponsor'
    ) THEN
      RAISE EXCEPTION 'Creative snapshot contains an unsupported template.'
        USING ERRCODE = '23514';
    END IF;
    IF template_family = 'featured-sponsor'
       AND settings_entry.destination <> 'mailer' THEN
      RAISE EXCEPTION
        'Featured Sponsor is supported only by the Mailer destination.'
        USING ERRCODE = '23514';
    END IF;

    IF settings_entry.settings ? 'qrId'
       AND jsonb_typeof(settings_entry.settings -> 'qrId')
         IS DISTINCT FROM 'null' THEN
      referenced_qr_id := public.adpadz_jsonb_uuid(
        settings_entry.settings,
        'qrId'
      );
      IF referenced_qr_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.qr_links AS qr
        WHERE qr.id = referenced_qr_id
          AND qr.owner_user_id = auth.uid()
      ) THEN
        RAISE EXCEPTION
          'Creative snapshot QR must belong to the Campaign owner.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    IF settings_entry.settings ? 'imageAssetId'
       AND jsonb_typeof(settings_entry.settings -> 'imageAssetId')
         IS DISTINCT FROM 'null' THEN
      referenced_image_asset_id := public.adpadz_jsonb_uuid(
        settings_entry.settings,
        'imageAssetId'
      );
      IF referenced_image_asset_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.business_marketing_assets AS asset
        WHERE asset.id = referenced_image_asset_id
          AND asset.owner_id = auth.uid()
      ) THEN
        RAISE EXCEPTION
          'Creative snapshot image asset must belong to the Campaign owner.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  IF (
    SELECT count(*)
    FROM jsonb_object_keys(next_formats)
  ) <> 4
     OR EXISTS (
       SELECT 1
       FROM jsonb_object_keys(next_formats) AS format_key(key)
       WHERE format_key.key NOT IN ('mailer', 'discovery', 'qr', 'social')
     )
     OR next_formats ->> 'mailer' NOT IN ('standard', 'combined', 'featured')
     OR next_formats ->> 'discovery' IS DISTINCT FROM 'card'
     OR next_formats ->> 'qr' IS DISTINCT FROM 'hero'
     OR next_formats ->> 'social' NOT IN (
       'square',
       'portrait',
       'landscape',
       'story'
     ) THEN
    RAISE EXCEPTION 'Creative formats must exactly match their destinations.';
  END IF;

  destination_format := next_formats ->> p_destination;
  IF p_format_key IS NULL
     OR p_format_key IS DISTINCT FROM destination_format THEN
    RAISE EXCEPTION
      'The selected creative format does not match the Workshop snapshot.';
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

  next_mailer := COALESCE(
    next_overrides -> 'mailer',
    next_global
  );
  IF NULLIF(btrim(next_mailer ->> 'qrId'), '') IS NOT NULL
     AND next_mailer -> 'showQr' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION
      'A selected Mailer QR cannot be hidden.'
      USING ERRCODE = '23514';
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
    -- Match the client normalization exactly so adopting Creative Workshop on
    -- a legacy Campaign is a baseline conversion, not a false print change.
    previous_global := '{
      "version": 1,
      "template": "hero-visual",
      "imageFit": "cover",
      "imagePositionX": 50,
      "imagePositionY": 50,
      "imageZoom": 1,
      "showQr": false,
      "showExpiration": true,
      "theme": "dark",
      "imageAssetId": null,
      "rotation": 0,
      "brightness": 100,
      "contrast": 100,
      "saturation": 100,
      "blur": 0,
      "overlayEnabled": true,
      "overlayStyle": "bottom-fade",
      "overlayColor": "#000000",
      "overlayOpacity": 55,
      "overlayDirection": 180,
      "overlaySpread": 55,
      "qrId": null,
      "headlineSize": "medium",
      "textAlign": "left",
      "textPanel": "none",
      "primaryColorOverride": null,
      "accentColorOverride": null,
      "showLogo": true,
      "showBusinessName": true,
      "showHeadline": true,
      "showOffer": true,
      "showCta": true,
      "showPhone": false,
      "showWebsite": false,
      "showSponsorBadge": true,
      "safeAreaVisible": false,
      "bleedVisible": false,
      "qrMinimumVisible": false
    }'::jsonb
      || (existing_metadata -> 'template_settings')
      || CASE
        WHEN campaign_primary_qr_id IS NOT NULL THEN jsonb_build_object(
          'qrId', campaign_primary_qr_id,
          'showQr', true
        )
        ELSE '{}'::jsonb
      END;
    previous_workshop := jsonb_build_object(
      'version', 1,
      'global', previous_global,
      'overrides', '{}'::jsonb,
      'formats', jsonb_build_object(
        'mailer', 'standard',
        'discovery', 'card',
        'qr', 'hero',
        'social', 'square'
      )
    );
  END IF;

  previous_global := CASE
    WHEN jsonb_typeof(previous_workshop -> 'global') = 'object'
      THEN previous_workshop -> 'global'
    ELSE NULL
  END;
  previous_overrides := CASE
    WHEN jsonb_typeof(previous_workshop -> 'overrides') = 'object'
      THEN previous_workshop -> 'overrides'
    ELSE '{}'::jsonb
  END;
  previous_formats := jsonb_build_object(
    'mailer',
      CASE
        WHEN previous_workshop #>> ARRAY['formats', 'mailer']
          IN ('standard', 'combined', 'featured')
          THEN previous_workshop #>> ARRAY['formats', 'mailer']
        ELSE 'standard'
      END,
    'discovery', 'card',
    'qr', 'hero',
    'social',
      CASE
        WHEN previous_workshop #>> ARRAY['formats', 'social']
          IN ('square', 'portrait', 'landscape', 'story')
          THEN previous_workshop #>> ARRAY['formats', 'social']
        ELSE 'square'
      END
  );

  previous_mailer := COALESCE(
    previous_overrides -> 'mailer',
    previous_global
  );
  previous_mailer_format := previous_formats ->> 'mailer';
  next_mailer_format := next_formats ->> 'mailer';
  did_affect_print := previous_mailer IS DISTINCT FROM next_mailer
    OR previous_mailer_format IS DISTINCT FROM next_mailer_format;

  -- Existing Mailer unreadiness must not block digital-only saves, but a save
  -- that changes the rendered Mailer cannot create a new unsafe print state.
  IF did_affect_print THEN
    referenced_qr_id := public.adpadz_jsonb_uuid(next_mailer, 'qrId');
    IF referenced_qr_id IS NULL
       OR next_mailer -> 'showQr' IS DISTINCT FROM 'true'::jsonb
       OR NOT EXISTS (
         SELECT 1
         FROM public.qr_links AS qr
         WHERE qr.id = referenced_qr_id
           AND qr.owner_user_id = campaign_owner_id
           AND qr.status = 'active'
           AND (qr.expires_at IS NULL OR qr.expires_at > now())
       ) THEN
      RAISE EXCEPTION
        'A print-affecting save requires a visible, active, unexpired Mailer QR owned by the Campaign owner.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  global_changed := previous_global IS DISTINCT FROM next_global;
  mailer_projection_changed :=
    (previous_overrides ? 'mailer')
      IS DISTINCT FROM (next_overrides ? 'mailer')
    OR previous_overrides -> 'mailer'
      IS DISTINCT FROM next_overrides -> 'mailer'
    OR previous_mailer_format IS DISTINCT FROM next_mailer_format;

  IF global_changed THEN
    template_family := lower(btrim(COALESCE(
      next_global ->> 'template',
      ''
    )));
    IF template_family !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
      RAISE EXCEPTION 'Creative snapshot has no valid global template family.';
    END IF;

    projection_summary := CASE
      WHEN p_scope = 'global' AND cardinality(normalized_summary) > 0
        THEN normalized_summary
      ELSE ARRAY['Global creative settings']
    END;
    projection_affects_print := did_affect_print
      AND NOT mailer_projection_changed;

    projection_queue := projection_queue || jsonb_build_array(
      jsonb_build_object(
        'destination',
          CASE
            WHEN projection_affects_print THEN 'mailer'
            ELSE p_destination
          END,
        'scope', 'global',
        'format_key',
          CASE
            WHEN projection_affects_print THEN next_formats ->> 'mailer'
            ELSE next_formats ->> p_destination
          END,
        'template_family', template_family,
        'material_settings', next_global,
        'change_summary', to_jsonb(projection_summary),
        'affects_print', projection_affects_print,
        'created_override', false,
        'priority',
          CASE
            WHEN p_scope = 'global' THEN 3
            WHEN projection_affects_print THEN 2
            ELSE 1
          END
      )
    );
  END IF;

  FOREACH destination_name IN ARRAY ARRAY[
    'mailer',
    'discovery',
    'qr',
    'social'
  ]
  LOOP
    destination_changed :=
      (previous_overrides ? destination_name)
        IS DISTINCT FROM (next_overrides ? destination_name)
      OR previous_overrides -> destination_name
        IS DISTINCT FROM next_overrides -> destination_name
      OR previous_formats ->> destination_name
        IS DISTINCT FROM next_formats ->> destination_name;

    IF NOT destination_changed THEN
      CONTINUE;
    END IF;

    destination_format := next_formats ->> destination_name;
    destination_settings := COALESCE(
      next_overrides -> destination_name,
      next_global
    );
    material_settings := jsonb_build_object(
      'has_override', next_overrides ? destination_name,
      'settings', destination_settings
    );
    template_family := lower(btrim(COALESCE(
      destination_settings ->> 'template',
      ''
    )));
    IF template_family !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
      RAISE EXCEPTION
        'Creative snapshot has no valid destination template family.';
    END IF;

    projection_summary := CASE
      WHEN p_scope = 'destination'
       AND p_destination = destination_name
       AND cardinality(normalized_summary) > 0
        THEN normalized_summary
      WHEN previous_formats ->> destination_name
        IS DISTINCT FROM destination_format
        AND (
          (previous_overrides ? destination_name)
            IS DISTINCT FROM (next_overrides ? destination_name)
          OR previous_overrides -> destination_name
            IS DISTINCT FROM next_overrides -> destination_name
        )
        THEN ARRAY['Destination creative settings', 'Format']
      WHEN previous_formats ->> destination_name
        IS DISTINCT FROM destination_format
        THEN ARRAY['Format']
      ELSE ARRAY['Destination creative settings']
    END;

    projection_affects_print := did_affect_print
      AND destination_name = 'mailer'
      AND mailer_projection_changed;
    projection_created_override := NOT (previous_overrides ? destination_name)
      AND next_overrides ? destination_name;

    projection_queue := projection_queue || jsonb_build_array(
      jsonb_build_object(
        'destination', destination_name,
        'scope', 'destination',
        'format_key', destination_format,
        'template_family', template_family,
        'material_settings', material_settings,
        'change_summary', to_jsonb(projection_summary),
        'affects_print', projection_affects_print,
        'created_override', projection_created_override,
        'priority',
          CASE
            WHEN p_scope = 'destination'
             AND p_destination = destination_name THEN 3
            WHEN projection_affects_print THEN 2
            ELSE 1
          END
      )
    );
  END LOOP;

  -- A pre-existing Campaign may have canonical Workshop state but no history
  -- yet. Establish one active baseline without inventing additional changes.
  -- Once any history exists, a no-op save returns the latest authoritative row
  -- instead of manufacturing a second event variant for identical material.
  IF jsonb_array_length(projection_queue) = 0 THEN
    SELECT
      version.id,
      version.settings_fingerprint,
      version.created_at
    INTO selected_id, selected_fingerprint, selected_created_at
    FROM public.campaign_creative_versions AS version
    WHERE version.campaign_id = p_campaign_id
    ORDER BY version.created_at DESC, version.id DESC
    LIMIT 1;
  END IF;

  IF jsonb_array_length(projection_queue) = 0
     AND selected_id IS NULL THEN
    destination_format := next_formats ->> p_destination;
    IF p_scope = 'global' THEN
      material_settings := next_global;
      destination_settings := next_global;
      projection_created_override := false;
    ELSE
      destination_settings := COALESCE(
        next_overrides -> p_destination,
        next_global
      );
      material_settings := jsonb_build_object(
        'has_override', next_overrides ? p_destination,
        'settings', destination_settings
      );
      projection_created_override := false;
    END IF;

    template_family := lower(btrim(COALESCE(
      destination_settings ->> 'template',
      ''
    )));
    IF template_family !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
      RAISE EXCEPTION 'Creative snapshot has no valid template family.';
    END IF;

    projection_queue := jsonb_build_array(
      jsonb_build_object(
        'destination', p_destination,
        'scope', p_scope,
        'format_key', destination_format,
        'template_family', template_family,
        'material_settings', material_settings,
        'change_summary',
          to_jsonb(
            CASE
              WHEN cardinality(normalized_summary) > 0
                THEN normalized_summary
              ELSE ARRAY['Initial creative version']
            END
          ),
        'affects_print', false,
        'created_override', projection_created_override,
        'priority', 3
      )
    );
  END IF;

  persisted_metadata := existing_metadata || jsonb_build_object(
    'creative_workshop', canonical_snapshot,
    'template_settings', next_global
  );

  PERFORM set_config(
    'adpadz.creative_write_authorized',
    'creative_workshop',
    true
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
  SET metadata = EXCLUDED.metadata;

  IF did_affect_print THEN
    UPDATE public.campaigns
    SET updated_at = clock_timestamp()
    WHERE id = p_campaign_id;

    -- Mailer production artifacts are revision-bound. A print-affecting
    -- creative change must move every Community Mailer that currently uses
    -- this Campaign onto a new rendered revision so its preflight,
    -- confirmations, Production Candidate, and placement snapshots are stale.
    -- EXISTS keeps a Campaign assigned to multiple placements on one mailer
    -- from incrementing that mailer's revision more than once per save.
    UPDATE public.community_cards AS card
    SET layout_revision = card.layout_revision + 1
    WHERE EXISTS (
      SELECT 1
      FROM public.community_card_slots AS slot
      WHERE slot.community_card_id = card.id
        AND slot.campaign_id = p_campaign_id
    );
  END IF;

  FOR projection_item IN
    SELECT *
    FROM jsonb_to_recordset(projection_queue) AS item(
      destination text,
      scope text,
      format_key text,
      template_family text,
      material_settings jsonb,
      change_summary jsonb,
      affects_print boolean,
      created_override boolean,
      priority integer
    )
  LOOP
    SELECT *
    INTO projection_result
    FROM public.save_campaign_creative_projection_internal(
      p_campaign_id,
      projection_item.destination,
      projection_item.scope,
      projection_item.format_key,
      projection_item.template_family,
      canonical_snapshot,
      projection_item.material_settings,
      ARRAY(
        SELECT jsonb_array_elements_text(projection_item.change_summary)
      ),
      projection_item.affects_print,
      projection_item.created_override,
      auth.uid()
    );

    any_version_created := any_version_created
      OR projection_result.projection_created;
    IF selected_id IS NULL
       OR projection_item.priority > selected_priority THEN
      selected_priority := projection_item.priority;
      selected_id := projection_result.projection_id;
      selected_fingerprint := projection_result.projection_fingerprint;
      selected_created_at := projection_result.projection_created_at;
    END IF;
  END LOOP;

  -- Retention remains per destination. Pinned versions are excluded and also
  -- protected independently by the production snapshot RESTRICT foreign key.
  WITH ranked_versions AS (
    SELECT
      version.id,
      row_number() OVER (
        PARTITION BY version.destination
        ORDER BY version.created_at DESC, version.id DESC
      ) AS retention_rank
    FROM public.campaign_creative_versions AS version
    WHERE version.campaign_id = p_campaign_id
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

  -- These legacy parameters remain in the public signature for compatibility.
  -- Print impact and override presence above are exclusively server-derived.
  PERFORM p_affects_print, p_created_override;

  version_id := selected_id;
  version_created := any_version_created;
  version_fingerprint := selected_fingerprint;
  version_created_at := selected_created_at;
  print_affected := did_affect_print;
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

-- Explicit and automatic binding now share the same Mailer-equivalence test.
CREATE OR REPLACE FUNCTION public.bind_community_mailer_creative_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  bound_version public.campaign_creative_versions%ROWTYPE;
BEGIN
  SELECT version.*
  INTO bound_version
  FROM public.campaign_creative_versions AS version
  JOIN public.campaign_outputs AS output
    ON output.campaign_id = version.campaign_id
    AND output.output_type = 'interactive_ad'
  WHERE version.campaign_id = NEW.campaign_id
    AND (NEW.creative_version_id IS NULL OR version.id = NEW.creative_version_id)
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
  -- affects_print describes the save event, not production compatibility.
  -- Prefer a Mailer-authored audit row, but allow an exactly equivalent
  -- baseline from another active destination when no Mailer row exists.
  ORDER BY
    (version.destination = 'mailer') DESC,
    version.created_at DESC,
    version.id DESC
  LIMIT 1;

  IF NEW.creative_version_id IS NOT NULL AND NOT FOUND THEN
    RAISE EXCEPTION
      'Production creative version must match the Campaign Mailer treatment and format.';
  END IF;

  NEW.creative_version_id := bound_version.id;
  IF NEW.creative_version_id IS NOT NULL THEN
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

-- Keep the administrative timeline cursor consistent with the customer query.
DROP FUNCTION public.get_admin_campaign_creative_versions(
  uuid,
  integer,
  timestamptz
);

CREATE OR REPLACE FUNCTION public.get_admin_campaign_creative_versions(
  p_campaign_id uuid,
  p_limit integer DEFAULT 25,
  p_before timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL
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
  IF auth.uid() IS NULL
     OR NOT COALESCE(public.is_adpadz_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Mission Control administrator access required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT version.*
  FROM public.campaign_creative_versions AS version
  WHERE version.campaign_id = p_campaign_id
    AND (
      p_before IS NULL
      OR version.created_at < p_before
      OR (
        p_before_id IS NOT NULL
        AND version.created_at = p_before
        AND version.id < p_before_id
      )
    )
  ORDER BY version.created_at DESC, version.id DESC
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_campaign_creative_versions(
  uuid,
  integer,
  timestamptz,
  uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_campaign_creative_versions(
  uuid,
  integer,
  timestamptz,
  uuid
) TO authenticated;

COMMENT ON FUNCTION public.get_admin_campaign_creative_versions(
  uuid,
  integer,
  timestamptz,
  uuid
) IS
  'Mission Control-only compound-cursor inspection of immutable Campaign Creative History.';

NOTIFY pgrst, 'reload schema';
