-- Adpadz tenant hardening and campaign analytics.
--
-- This migration deliberately leaves ambiguous historical ownership links
-- null.  Direct relationships and owners with exactly one business are safe to
-- backfill; every future attachment is checked at both trigger and RLS layers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.qr_links
  ADD COLUMN IF NOT EXISTS business_id uuid;

CREATE OR REPLACE FUNCTION public.adpadz_jsonb_uuid(
  p_document jsonb,
  p_key text
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
DECLARE
  value_text text;
BEGIN
  value_text := p_document ->> p_key;
  IF value_text IS NULL
     OR value_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  RETURN value_text::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.adpadz_columns_share_type(
  p_left_table regclass,
  p_left_column name,
  p_right_table regclass,
  p_right_column name
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute AS left_column
    JOIN pg_attribute AS right_column
      ON right_column.attrelid = p_right_table
     AND right_column.attname = p_right_column
     AND right_column.attnum > 0
     AND NOT right_column.attisdropped
    WHERE left_column.attrelid = p_left_table
      AND left_column.attname = p_left_column
      AND left_column.attnum > 0
      AND NOT left_column.attisdropped
      AND left_column.atttypid = right_column.atttypid
  );
$$;

-- First use explicit relationships.  A QR destination and an enabled Smart
-- Card output carry stronger evidence than a same-owner guess.
DO $$
BEGIN
  IF public.adpadz_columns_share_type(
       'public.qr_links'::regclass, 'destination_id',
       'public.business_cards'::regclass, 'id'
     )
     AND public.adpadz_columns_share_type(
       'public.qr_links'::regclass, 'business_id',
       'public.business_cards'::regclass, 'business_id'
     ) THEN
    UPDATE public.qr_links AS qr
    SET business_id = card.business_id
    FROM public.business_cards AS card
    WHERE qr.business_id IS NULL
      AND qr.destination_type = 'business_card'
      AND qr.destination_id = card.id
      AND card.business_id IS NOT NULL
      AND qr.owner_user_id IS NOT DISTINCT FROM card.owner_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF public.adpadz_columns_share_type(
       'public.campaigns'::regclass, 'business_id',
       'public.business_cards'::regclass, 'business_id'
     ) THEN
    WITH candidate_businesses AS (
      SELECT
        output.campaign_id,
        (array_agg(card.business_id))[1] AS business_id
      FROM public.campaign_outputs AS output
      JOIN public.business_cards AS card
        ON card.id = public.adpadz_jsonb_uuid(output.metadata, 'smart_card_id')
      JOIN public.campaigns AS campaign
        ON campaign.id = output.campaign_id
       AND campaign.owner_id IS NOT DISTINCT FROM card.owner_user_id
      WHERE output.output_type = 'smart_card'
        AND card.business_id IS NOT NULL
      GROUP BY output.campaign_id
      HAVING count(DISTINCT card.business_id) = 1
    )
    UPDATE public.campaigns AS campaign
    SET business_id = candidate.business_id
    FROM candidate_businesses AS candidate
    WHERE campaign.id = candidate.campaign_id
      AND campaign.business_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF public.adpadz_columns_share_type(
       'public.campaigns'::regclass, 'business_id',
       'public.qr_links'::regclass, 'business_id'
     ) THEN
    UPDATE public.campaigns AS campaign
    SET business_id = qr.business_id
    FROM public.qr_links AS qr
    WHERE campaign.business_id IS NULL
      AND campaign.primary_qr_id = qr.id
      AND qr.business_id IS NOT NULL
      AND campaign.owner_id IS NOT DISTINCT FROM qr.owner_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF public.adpadz_columns_share_type(
       'public.qr_links'::regclass, 'business_id',
       'public.campaigns'::regclass, 'business_id'
     ) THEN
    WITH candidate_businesses AS (
      SELECT
        qr.id AS qr_link_id,
        (array_agg(campaign.business_id))[1] AS business_id
      FROM public.qr_links AS qr
      JOIN public.campaigns AS campaign
        ON campaign.primary_qr_id = qr.id
       AND campaign.owner_id IS NOT DISTINCT FROM qr.owner_user_id
      WHERE campaign.business_id IS NOT NULL
      GROUP BY qr.id
      HAVING count(DISTINCT campaign.business_id) = 1
    )
    UPDATE public.qr_links AS qr
    SET business_id = candidate.business_id
    FROM candidate_businesses AS candidate
    WHERE qr.id = candidate.qr_link_id
      AND qr.business_id IS NULL;
  END IF;
END $$;

-- Fall back to owner matching only when that owner has exactly one business.
-- Multiple businesses are intentionally left unresolved.
DO $$
BEGIN
  IF public.adpadz_columns_share_type(
       'public.business_cards'::regclass, 'business_id',
       'public.businesses'::regclass, 'id'
     )
     AND public.adpadz_columns_share_type(
       'public.business_cards'::regclass, 'owner_user_id',
       'public.businesses'::regclass, 'owner_user_id'
     ) THEN
    WITH single_business AS (
      SELECT owner_user_id, (array_agg(id))[1] AS business_id
      FROM public.businesses
      WHERE owner_user_id IS NOT NULL
      GROUP BY owner_user_id
      HAVING count(*) = 1
    )
    UPDATE public.business_cards AS card
    SET business_id = match.business_id
    FROM single_business AS match
    WHERE card.business_id IS NULL
      AND card.owner_user_id = match.owner_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF public.adpadz_columns_share_type(
       'public.campaigns'::regclass, 'business_id',
       'public.businesses'::regclass, 'id'
     )
     AND public.adpadz_columns_share_type(
       'public.campaigns'::regclass, 'owner_id',
       'public.businesses'::regclass, 'owner_user_id'
     ) THEN
    WITH single_business AS (
      SELECT owner_user_id, (array_agg(id))[1] AS business_id
      FROM public.businesses
      WHERE owner_user_id IS NOT NULL
      GROUP BY owner_user_id
      HAVING count(*) = 1
    )
    UPDATE public.campaigns AS campaign
    SET business_id = match.business_id
    FROM single_business AS match
    WHERE campaign.business_id IS NULL
      AND campaign.owner_id = match.owner_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF public.adpadz_columns_share_type(
       'public.qr_links'::regclass, 'business_id',
       'public.businesses'::regclass, 'id'
     )
     AND public.adpadz_columns_share_type(
       'public.qr_links'::regclass, 'owner_user_id',
       'public.businesses'::regclass, 'owner_user_id'
     ) THEN
    WITH single_business AS (
      SELECT owner_user_id, (array_agg(id))[1] AS business_id
      FROM public.businesses
      WHERE owner_user_id IS NOT NULL
      GROUP BY owner_user_id
      HAVING count(*) = 1
    )
    UPDATE public.qr_links AS qr
    SET business_id = match.business_id
    FROM single_business AS match
    WHERE qr.business_id IS NULL
      AND qr.owner_user_id = match.owner_user_id;
  END IF;
END $$;

UPDATE public.business_marketing_assets AS asset
SET business_id = card.business_id
FROM public.business_cards AS card
WHERE asset.business_id IS NULL
  AND asset.smart_card_id = card.id
  AND card.business_id IS NOT NULL
  AND asset.owner_id IS NOT DISTINCT FROM card.owner_user_id
  AND EXISTS (
    SELECT 1 FROM public.businesses AS business
    WHERE business.id = card.business_id
      AND business.owner_user_id = asset.owner_id
  );

-- Link the three public surfaces (and marketing assets) to the canonical
-- business without validating potentially inconsistent historical rows.
DO $$
DECLARE
  relation_name text;
  constraint_name text;
BEGIN
  FOR relation_name, constraint_name IN
    SELECT *
    FROM (VALUES
      ('business_cards', 'business_cards_business_id_fkey'),
      ('campaigns', 'campaigns_business_id_fkey'),
      ('qr_links', 'qr_links_business_id_fkey'),
      ('business_marketing_assets', 'business_marketing_assets_business_id_fkey')
    ) AS relationships(relation_name, constraint_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format('public.%I', relation_name)::regclass
        AND conname = constraint_name
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL NOT VALID',
          relation_name,
          constraint_name
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped business link constraint %: %', constraint_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS business_cards_business_id_idx
  ON public.business_cards(business_id);
CREATE INDEX IF NOT EXISTS campaigns_business_id_owner_idx
  ON public.campaigns(business_id, owner_id);
CREATE INDEX IF NOT EXISTS qr_links_business_id_owner_idx
  ON public.qr_links(business_id, owner_user_id);

-- Validate campaign-output attachment ownership independently of auth.uid().
-- This makes the same invariant usable by RLS, public visibility helpers, and
-- a trigger that also protects writes made outside PostgREST.
CREATE OR REPLACE FUNCTION public.adpadz_campaign_output_is_owned(
  p_campaign_id uuid,
  p_output_type text,
  p_enabled boolean,
  p_metadata jsonb,
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  campaign_owner uuid;
  campaign_business uuid;
  card_id uuid;
  card_owner uuid;
  card_business uuid;
  qr_id uuid;
  qr_owner uuid;
  qr_business uuid;
  document jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  SELECT owner_id, business_id
  INTO campaign_owner, campaign_business
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND OR campaign_owner IS DISTINCT FROM p_owner_id THEN
    RETURN false;
  END IF;

  IF campaign_business IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.businesses AS business
       WHERE business.id = campaign_business
         AND business.owner_user_id = campaign_owner
     ) THEN
    RETURN false;
  END IF;

  card_id := public.adpadz_jsonb_uuid(document, 'smart_card_id');
  IF document ? 'smart_card_id' AND card_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_output_type = 'smart_card' AND COALESCE(p_enabled, false) AND card_id IS NULL THEN
    RETURN false;
  END IF;

  IF card_id IS NOT NULL THEN
    SELECT owner_user_id, business_id
    INTO card_owner, card_business
    FROM public.business_cards
    WHERE id = card_id;

    IF NOT FOUND
       OR card_owner IS DISTINCT FROM campaign_owner
       OR (
         campaign_business IS NOT NULL
         AND card_business IS DISTINCT FROM campaign_business
       )
       OR (
         card_business IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.businesses AS business
           WHERE business.id = card_business
             AND business.owner_user_id = card_owner
         )
       ) THEN
      RETURN false;
    END IF;
  END IF;

  qr_id := public.adpadz_jsonb_uuid(document, 'qr_link_id');
  IF document ? 'qr_link_id' AND qr_id IS NULL THEN
    RETURN false;
  END IF;

  IF qr_id IS NOT NULL THEN
    SELECT owner_user_id, business_id
    INTO qr_owner, qr_business
    FROM public.qr_links
    WHERE id = qr_id;

    IF NOT FOUND
       OR qr_owner IS DISTINCT FROM campaign_owner
       OR (
         campaign_business IS NOT NULL
         AND qr_business IS DISTINCT FROM campaign_business
       )
       OR (
         qr_business IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.businesses AS business
           WHERE business.id = qr_business
             AND business.owner_user_id = qr_owner
         )
       ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.adpadz_enforce_campaign_output_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  campaign_owner uuid;
BEGIN
  SELECT owner_id
  INTO campaign_owner
  FROM public.campaigns
  WHERE id = NEW.campaign_id;

  IF NOT FOUND OR NOT public.adpadz_campaign_output_is_owned(
    NEW.campaign_id,
    NEW.output_type,
    NEW.enabled,
    NEW.metadata,
    campaign_owner
  ) THEN
    RAISE EXCEPTION 'Campaign output attachment does not belong to the campaign owner'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_outputs_enforce_ownership ON public.campaign_outputs;
CREATE TRIGGER campaign_outputs_enforce_ownership
  BEFORE INSERT OR UPDATE ON public.campaign_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_enforce_campaign_output_ownership();

CREATE OR REPLACE FUNCTION public.adpadz_campaign_output_is_public(
  p_campaign_id uuid,
  p_output_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns AS campaign
    JOIN public.campaign_outputs AS output
      ON output.campaign_id = campaign.id
     AND output.output_type = p_output_type
    WHERE campaign.id = p_campaign_id
      AND campaign.status IN ('active', 'scheduled')
      AND (campaign.start_date IS NULL OR campaign.start_date <= now())
      AND (campaign.end_date IS NULL OR campaign.end_date >= now())
      AND output.enabled IS TRUE
      AND output.output_type IN ('smart_card', 'interactive_ad', 'qr_landing')
      AND (
        campaign.business_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.businesses AS business
          WHERE business.id = campaign.business_id
            AND business.owner_user_id = campaign.owner_id
            AND business.active IS TRUE
        )
      )
      AND public.adpadz_campaign_output_is_owned(
        campaign.id,
        output.output_type,
        output.enabled,
        output.metadata,
        campaign.owner_id
      )
      AND (
        output.output_type <> 'smart_card'
        OR EXISTS (
          SELECT 1
          FROM public.business_cards AS card
          WHERE card.id = public.adpadz_jsonb_uuid(output.metadata, 'smart_card_id')
            AND card.is_published IS TRUE
            AND card.owner_user_id = campaign.owner_id
            AND (
              campaign.business_id IS NULL
              OR card.business_id = campaign.business_id
            )
            AND (
              card.business_id IS NULL
              OR EXISTS (
                SELECT 1 FROM public.businesses AS business
                WHERE business.id = card.business_id
                  AND business.owner_user_id = card.owner_user_id
                  AND business.active IS TRUE
              )
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.adpadz_campaign_is_public(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_outputs AS output
    WHERE output.campaign_id = p_campaign_id
      AND public.adpadz_campaign_output_is_public(
        output.campaign_id,
        output.output_type
      )
  );
$$;

REVOKE ALL ON FUNCTION public.adpadz_jsonb_uuid(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adpadz_columns_share_type(regclass, name, regclass, name) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adpadz_campaign_output_is_owned(uuid, text, boolean, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adpadz_enforce_campaign_output_ownership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adpadz_campaign_output_is_public(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adpadz_campaign_is_public(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.adpadz_campaign_output_is_owned(uuid, text, boolean, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adpadz_jsonb_uuid(jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adpadz_campaign_output_is_public(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adpadz_campaign_is_public(uuid) TO anon, authenticated;

-- Immutable, append-only interactive campaign analytics.
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  business_card_id uuid,
  output_type text NOT NULL DEFAULT 'interactive_ad',
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_events
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS business_card_id uuid,
  ADD COLUMN IF NOT EXISTS output_type text DEFAULT 'interactive_ad',
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
DECLARE
  constraint_name text;
  constraint_sql text;
BEGIN
  FOR constraint_name, constraint_sql IN
    SELECT *
    FROM (VALUES
      ('campaign_events_campaign_id_fkey',
        'FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE NOT VALID'),
      ('campaign_events_business_card_id_fkey',
        'FOREIGN KEY (business_card_id) REFERENCES public.business_cards(id) ON DELETE SET NULL NOT VALID')
    ) AS constraint_rows(constraint_name, constraint_sql)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.campaign_events'::regclass
        AND conname = constraint_name
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.campaign_events ADD CONSTRAINT %I %s',
          constraint_name,
          constraint_sql
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped campaign event constraint %: %', constraint_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- Public event ingestion must fail closed. Replace the known checks so a
-- pre-existing constraint with the same name but weaker definition cannot be
-- mistaken for the required contract.
ALTER TABLE public.campaign_events
  DROP CONSTRAINT IF EXISTS campaign_events_output_type_check,
  DROP CONSTRAINT IF EXISTS campaign_events_event_type_check,
  DROP CONSTRAINT IF EXISTS campaign_events_metadata_object_check,
  DROP CONSTRAINT IF EXISTS campaign_events_payload_size_check,
  DROP CONSTRAINT IF EXISTS campaign_events_required_fields_check;

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_output_type_check
    CHECK (output_type IS NOT NULL AND output_type = 'interactive_ad') NOT VALID,
  ADD CONSTRAINT campaign_events_event_type_check
    CHECK (
      event_type IS NOT NULL
      AND event_type IN ('view', 'reveal', 'cta_click', 'share', 'save', 'offer_claim')
    ) NOT VALID,
  ADD CONSTRAINT campaign_events_metadata_object_check
    CHECK (metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object') NOT VALID,
  ADD CONSTRAINT campaign_events_payload_size_check
    CHECK (
      octet_length(metadata::text) <= 16384
      AND length(COALESCE(user_agent, '')) <= 1024
      AND length(COALESCE(referrer, '')) <= 4096
    ) NOT VALID,
  ADD CONSTRAINT campaign_events_required_fields_check
    CHECK (campaign_id IS NOT NULL AND occurred_at IS NOT NULL AND created_at IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS campaign_events_campaign_type_time_idx
  ON public.campaign_events(campaign_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS campaign_events_card_time_idx
  ON public.campaign_events(business_card_id, occurred_at DESC)
  WHERE business_card_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.adpadz_campaign_event_is_coherent(
  p_campaign_id uuid,
  p_business_card_id uuid,
  p_output_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_output_type = 'interactive_ad'
    AND public.adpadz_campaign_output_is_public(p_campaign_id, p_output_type)
    AND (
      p_business_card_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.campaigns AS campaign
        JOIN public.business_cards AS card
          ON card.id = p_business_card_id
         AND card.owner_user_id = campaign.owner_id
         AND card.is_published IS TRUE
         AND (
           campaign.business_id IS NULL
           OR card.business_id = campaign.business_id
         )
        JOIN public.campaign_outputs AS card_output
          ON card_output.campaign_id = campaign.id
         AND card_output.output_type = 'smart_card'
         AND card_output.enabled IS TRUE
         AND public.adpadz_jsonb_uuid(card_output.metadata, 'smart_card_id') = card.id
        WHERE campaign.id = p_campaign_id
          AND public.adpadz_campaign_output_is_public(
            card_output.campaign_id,
            card_output.output_type
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.adpadz_campaign_event_is_coherent(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adpadz_campaign_event_is_coherent(uuid, uuid, text) TO anon, authenticated;

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_events_public_insert" ON public.campaign_events;
CREATE POLICY "campaign_events_public_insert" ON public.campaign_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    campaign_id IS NOT NULL
    AND event_type IN ('view', 'reveal', 'cta_click', 'share', 'save', 'offer_claim')
    AND public.adpadz_campaign_event_is_coherent(
      campaign_id,
      business_card_id,
      output_type
    )
  );

DROP POLICY IF EXISTS "campaign_events_owner_select" ON public.campaign_events;
CREATE POLICY "campaign_events_owner_select" ON public.campaign_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns
      WHERE campaigns.id = campaign_events.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  );

REVOKE ALL ON public.campaign_events FROM anon, authenticated;
GRANT INSERT ON public.campaign_events TO anon, authenticated;
GRANT SELECT ON public.campaign_events TO authenticated;

-- Tenant ownership policies continue below.

-- Canonical business links must belong to the same authenticated owner. Read
-- and delete policies remain owner-based so a tenant can inspect and remove a
-- historical row even if its old attachment is inconsistent.
DROP POLICY IF EXISTS business_cards_owner_select ON public.business_cards;
CREATE POLICY business_cards_owner_select ON public.business_cards
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS business_cards_owner_insert ON public.business_cards;
CREATE POLICY business_cards_owner_insert ON public.business_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id = business_cards.business_id
          AND businesses.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS business_cards_owner_update ON public.business_cards;
CREATE POLICY business_cards_owner_update ON public.business_cards
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id = business_cards.business_id
          AND businesses.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS business_cards_owner_delete ON public.business_cards;
CREATE POLICY business_cards_owner_delete ON public.business_cards
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS qr_links_owner_select ON public.qr_links;
CREATE POLICY qr_links_owner_select ON public.qr_links
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS qr_links_owner_insert ON public.qr_links;
CREATE POLICY qr_links_owner_insert ON public.qr_links
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id = qr_links.business_id
          AND businesses.owner_user_id = auth.uid()
      )
    )
    AND (
      destination_type <> 'business_card'
      OR EXISTS (
        SELECT 1 FROM public.business_cards AS card
        WHERE card.id = qr_links.destination_id
          AND card.owner_user_id = auth.uid()
          AND (
            qr_links.business_id IS NULL
            OR card.business_id = qr_links.business_id
          )
      )
    )
  );

DROP POLICY IF EXISTS qr_links_owner_update ON public.qr_links;
CREATE POLICY qr_links_owner_update ON public.qr_links
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id = qr_links.business_id
          AND businesses.owner_user_id = auth.uid()
      )
    )
    AND (
      destination_type <> 'business_card'
      OR EXISTS (
        SELECT 1 FROM public.business_cards AS card
        WHERE card.id = qr_links.destination_id
          AND card.owner_user_id = auth.uid()
          AND (
            qr_links.business_id IS NULL
            OR card.business_id = qr_links.business_id
          )
      )
    )
  );

DROP POLICY IF EXISTS qr_links_owner_delete ON public.qr_links;
CREATE POLICY qr_links_owner_delete ON public.qr_links
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.adpadz_campaign_write_is_owned(
  p_business_id uuid,
  p_primary_image_id uuid,
  p_primary_video_id uuid,
  p_primary_qr_id uuid,
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    (
      p_business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses AS business
        WHERE business.id = p_business_id
          AND business.owner_user_id = p_owner_id
      )
    )
    AND (
      p_primary_image_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.business_marketing_assets AS asset
        WHERE asset.id = p_primary_image_id
          AND asset.owner_id = p_owner_id
          AND (p_business_id IS NULL OR asset.business_id = p_business_id)
      )
    )
    AND (
      p_primary_video_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.business_marketing_assets AS asset
        WHERE asset.id = p_primary_video_id
          AND asset.owner_id = p_owner_id
          AND (p_business_id IS NULL OR asset.business_id = p_business_id)
      )
    )
    AND (
      p_primary_qr_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.qr_links AS qr
        WHERE qr.id = p_primary_qr_id
          AND qr.owner_user_id = p_owner_id
          AND (p_business_id IS NULL OR qr.business_id = p_business_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.adpadz_campaign_write_is_owned(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adpadz_campaign_write_is_owned(uuid, uuid, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS campaigns_owner_select ON public.campaigns;
CREATE POLICY campaigns_owner_select ON public.campaigns
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS campaigns_owner_insert ON public.campaigns;
CREATE POLICY campaigns_owner_insert ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.adpadz_campaign_write_is_owned(
      business_id, primary_image_id, primary_video_id, primary_qr_id, auth.uid()
    )
  );

DROP POLICY IF EXISTS campaigns_owner_update ON public.campaigns;
CREATE POLICY campaigns_owner_update ON public.campaigns
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND public.adpadz_campaign_write_is_owned(
      business_id, primary_image_id, primary_video_id, primary_qr_id, auth.uid()
    )
  );

DROP POLICY IF EXISTS campaigns_owner_delete ON public.campaigns;
CREATE POLICY campaigns_owner_delete ON public.campaigns
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Replace the historical Smart-Card-only public rules. Security-definer
-- visibility helpers avoid recursive RLS between campaigns and their outputs.
DROP POLICY IF EXISTS campaigns_public_smart_card_select ON public.campaigns;
DROP POLICY IF EXISTS campaigns_public_select ON public.campaigns;
CREATE POLICY campaigns_public_select ON public.campaigns
  FOR SELECT TO anon, authenticated
  USING (public.adpadz_campaign_is_public(id));

DROP POLICY IF EXISTS campaign_outputs_public_smart_card_select ON public.campaign_outputs;
DROP POLICY IF EXISTS campaign_outputs_public_select ON public.campaign_outputs;
CREATE POLICY campaign_outputs_public_select ON public.campaign_outputs
  FOR SELECT TO anon, authenticated
  USING (public.adpadz_campaign_output_is_public(campaign_id, output_type));

DROP POLICY IF EXISTS campaign_outputs_owner_select ON public.campaign_outputs;
CREATE POLICY campaign_outputs_owner_select ON public.campaign_outputs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS campaign_outputs_owner_insert ON public.campaign_outputs;
CREATE POLICY campaign_outputs_owner_insert ON public.campaign_outputs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.adpadz_campaign_output_is_owned(
      campaign_id, output_type, enabled, metadata, auth.uid()
    )
  );

DROP POLICY IF EXISTS campaign_outputs_owner_update ON public.campaign_outputs;
CREATE POLICY campaign_outputs_owner_update ON public.campaign_outputs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.adpadz_campaign_output_is_owned(
      campaign_id, output_type, enabled, metadata, auth.uid()
    )
  );

DROP POLICY IF EXISTS campaign_outputs_owner_delete ON public.campaign_outputs;
CREATE POLICY campaign_outputs_owner_delete ON public.campaign_outputs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  );

-- Marketing assets derive their tenant from both optional parents. The trigger
-- catches service/API writes; RLS protects authenticated clients and keeps
-- mismatched historical rows out of public card/campaign reads.
CREATE OR REPLACE FUNCTION public.adpadz_enforce_marketing_asset_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  card_owner uuid;
  card_business uuid;
  business_owner uuid;
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;

  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'Marketing asset owner is required'
      USING ERRCODE = '23502';
  END IF;

  IF NEW.smart_card_id IS NOT NULL THEN
    SELECT owner_user_id, business_id
    INTO card_owner, card_business
    FROM public.business_cards
    WHERE id = NEW.smart_card_id;

    IF NOT FOUND OR card_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Marketing asset and Smart Card must have the same owner'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.business_id IS NULL THEN
      NEW.business_id := card_business;
    ELSIF card_business IS NOT NULL
          AND NEW.business_id IS DISTINCT FROM card_business THEN
      RAISE EXCEPTION 'Marketing asset business does not match its Smart Card'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.business_id IS NOT NULL THEN
    SELECT owner_user_id
    INTO business_owner
    FROM public.businesses
    WHERE id = NEW.business_id;

    IF NOT FOUND OR business_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Marketing asset and business must have the same owner'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_marketing_assets_enforce_ownership ON public.business_marketing_assets;
CREATE TRIGGER business_marketing_assets_enforce_ownership
  BEFORE INSERT OR UPDATE ON public.business_marketing_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_enforce_marketing_asset_ownership();

REVOKE ALL ON FUNCTION public.adpadz_enforce_marketing_asset_ownership() FROM PUBLIC;

DROP POLICY IF EXISTS business_marketing_assets_owner_manage ON public.business_marketing_assets;
DROP POLICY IF EXISTS business_marketing_assets_owner_select ON public.business_marketing_assets;
CREATE POLICY business_marketing_assets_owner_select ON public.business_marketing_assets
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS business_marketing_assets_owner_insert ON public.business_marketing_assets;
CREATE POLICY business_marketing_assets_owner_insert ON public.business_marketing_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id = business_marketing_assets.business_id
          AND businesses.owner_user_id = auth.uid()
      )
    )
    AND (
      smart_card_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.business_cards AS card
        WHERE card.id = business_marketing_assets.smart_card_id
          AND card.owner_user_id = auth.uid()
          AND (
            business_marketing_assets.business_id IS NULL
            OR card.business_id = business_marketing_assets.business_id
          )
      )
    )
  );

DROP POLICY IF EXISTS business_marketing_assets_owner_update ON public.business_marketing_assets;
CREATE POLICY business_marketing_assets_owner_update ON public.business_marketing_assets
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id = business_marketing_assets.business_id
          AND businesses.owner_user_id = auth.uid()
      )
    )
    AND (
      smart_card_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.business_cards AS card
        WHERE card.id = business_marketing_assets.smart_card_id
          AND card.owner_user_id = auth.uid()
          AND (
            business_marketing_assets.business_id IS NULL
            OR card.business_id = business_marketing_assets.business_id
          )
      )
    )
  );

DROP POLICY IF EXISTS business_marketing_assets_owner_delete ON public.business_marketing_assets;
CREATE POLICY business_marketing_assets_owner_delete ON public.business_marketing_assets
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS business_marketing_assets_public_read ON public.business_marketing_assets;
CREATE POLICY business_marketing_assets_public_read ON public.business_marketing_assets
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND (
      business_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.businesses AS asset_business
        WHERE asset_business.id = business_marketing_assets.business_id
          AND asset_business.owner_user_id = business_marketing_assets.owner_id
          AND asset_business.active IS TRUE
      )
    )
    AND (
      smart_card_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.business_cards AS attached_card
        WHERE attached_card.id = business_marketing_assets.smart_card_id
          AND attached_card.owner_user_id = business_marketing_assets.owner_id
          AND (
            business_marketing_assets.business_id IS NULL
            OR attached_card.business_id = business_marketing_assets.business_id
          )
          AND (
            attached_card.business_id IS NULL
            OR EXISTS (
              SELECT 1 FROM public.businesses AS card_business
              WHERE card_business.id = attached_card.business_id
                AND card_business.owner_user_id = attached_card.owner_user_id
                AND card_business.active IS TRUE
            )
          )
      )
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.business_cards AS card
        WHERE card.id = business_marketing_assets.smart_card_id
          AND card.is_published IS TRUE
          AND card.owner_user_id = business_marketing_assets.owner_id
          AND (
            business_marketing_assets.business_id IS NULL
            OR card.business_id = business_marketing_assets.business_id
          )
          AND (
            card.business_id IS NULL
            OR EXISTS (
              SELECT 1 FROM public.businesses AS business
              WHERE business.id = card.business_id
                AND business.owner_user_id = card.owner_user_id
                AND business.active IS TRUE
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.campaigns AS campaign
        WHERE (
            campaign.primary_image_id = business_marketing_assets.id
            OR campaign.primary_video_id = business_marketing_assets.id
          )
          AND campaign.owner_id = business_marketing_assets.owner_id
          AND (
            campaign.business_id IS NULL
            OR campaign.business_id = business_marketing_assets.business_id
          )
          AND public.adpadz_campaign_is_public(campaign.id)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.adpadz_enforce_card_child_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  card_owner uuid;
  card_business uuid;
  business_owner uuid;
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;

  SELECT owner_user_id, business_id
  INTO card_owner, card_business
  FROM public.business_cards
  WHERE id = NEW.card_id;

  IF NOT FOUND OR NEW.owner_id IS DISTINCT FROM card_owner THEN
    RAISE EXCEPTION 'Smart Card child and Smart Card must have the same owner'
      USING ERRCODE = '42501';
  END IF;

  IF card_business IS NOT NULL THEN
    SELECT owner_user_id
    INTO business_owner
    FROM public.businesses
    WHERE id = card_business;

    IF NOT FOUND OR business_owner IS DISTINCT FROM card_owner THEN
      RAISE EXCEPTION 'Smart Card business does not belong to its owner'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_before_after_enforce_ownership
  ON public.business_card_before_after_items;
CREATE TRIGGER business_card_before_after_enforce_ownership
  BEFORE INSERT OR UPDATE ON public.business_card_before_after_items
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_enforce_card_child_ownership();

DROP TRIGGER IF EXISTS business_card_testimonials_enforce_ownership
  ON public.business_card_testimonials;
CREATE TRIGGER business_card_testimonials_enforce_ownership
  BEFORE INSERT OR UPDATE ON public.business_card_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_enforce_card_child_ownership();

REVOKE ALL ON FUNCTION public.adpadz_enforce_card_child_ownership() FROM PUBLIC;

DROP POLICY IF EXISTS business_card_before_after_owner_manage
  ON public.business_card_before_after_items;
DROP POLICY IF EXISTS business_card_before_after_owner_select
  ON public.business_card_before_after_items;
CREATE POLICY business_card_before_after_owner_select
  ON public.business_card_before_after_items
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS business_card_before_after_owner_insert
  ON public.business_card_before_after_items;
CREATE POLICY business_card_before_after_owner_insert
  ON public.business_card_before_after_items
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.business_cards AS card
      WHERE card.id = business_card_before_after_items.card_id
        AND card.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS business_card_before_after_owner_update
  ON public.business_card_before_after_items;
CREATE POLICY business_card_before_after_owner_update
  ON public.business_card_before_after_items
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.business_cards AS card
      WHERE card.id = business_card_before_after_items.card_id
        AND card.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS business_card_before_after_owner_delete
  ON public.business_card_before_after_items;
CREATE POLICY business_card_before_after_owner_delete
  ON public.business_card_before_after_items
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS business_card_before_after_public_read
  ON public.business_card_before_after_items;
CREATE POLICY business_card_before_after_public_read
  ON public.business_card_before_after_items
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.business_cards AS card
      WHERE card.id = business_card_before_after_items.card_id
        AND card.is_published IS TRUE
        AND card.owner_user_id = business_card_before_after_items.owner_id
        AND (
          card.business_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.businesses AS business
            WHERE business.id = card.business_id
              AND business.owner_user_id = card.owner_user_id
              AND business.active IS TRUE
          )
        )
    )
  );

DROP POLICY IF EXISTS business_card_testimonials_owner_manage
  ON public.business_card_testimonials;
DROP POLICY IF EXISTS business_card_testimonials_owner_select
  ON public.business_card_testimonials;
CREATE POLICY business_card_testimonials_owner_select
  ON public.business_card_testimonials
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS business_card_testimonials_owner_insert
  ON public.business_card_testimonials;
CREATE POLICY business_card_testimonials_owner_insert
  ON public.business_card_testimonials
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.business_cards AS card
      WHERE card.id = business_card_testimonials.card_id
        AND card.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS business_card_testimonials_owner_update
  ON public.business_card_testimonials;
CREATE POLICY business_card_testimonials_owner_update
  ON public.business_card_testimonials
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.business_cards AS card
      WHERE card.id = business_card_testimonials.card_id
        AND card.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS business_card_testimonials_owner_delete
  ON public.business_card_testimonials;
CREATE POLICY business_card_testimonials_owner_delete
  ON public.business_card_testimonials
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS business_card_testimonials_public_read
  ON public.business_card_testimonials;
CREATE POLICY business_card_testimonials_public_read
  ON public.business_card_testimonials
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.business_cards AS card
      WHERE card.id = business_card_testimonials.card_id
        AND card.is_published IS TRUE
        AND card.owner_user_id = business_card_testimonials.owner_id
        AND (
          card.business_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.businesses AS business
            WHERE business.id = card.business_id
              AND business.owner_user_id = card.owner_user_id
              AND business.active IS TRUE
          )
        )
    )
  );

-- The final historical event-type check predates interactive campaign links.
-- Replace only the known enum check; preserve any compound integrity checks a
-- production installation may have added independently.
ALTER TABLE public.business_card_events
  DROP CONSTRAINT IF EXISTS business_card_events_event_type_check;

ALTER TABLE public.business_card_events
  ADD CONSTRAINT business_card_events_event_type_check
    CHECK (
      event_type IN (
        'card_view',
        'qr_scan',
        'call_click',
        'text_click',
        'email_click',
        'website_click',
        'directions_click',
        'offer_view',
        'offer_claim',
        'save_contact',
        'document_view',
        'document_click',
        'virtual_tour_view',
        'virtual_tour_click',
        'before_after_view',
        'before_after_interaction',
        'testimonial_view',
        'lead_submit',
        'booking_click',
        'booking_request_submit',
        'interactive_ad_click',
        'media_click'
      )
    ) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.business_card_events'::regclass
      AND conname = 'business_card_events_payload_size_check'
  ) THEN
    ALTER TABLE public.business_card_events
      ADD CONSTRAINT business_card_events_payload_size_check
      CHECK (
        octet_length(metadata::text) <= 16384
        AND length(COALESCE(user_agent, '')) <= 1024
        AND length(COALESCE(referrer, '')) <= 4096
      ) NOT VALID;
  END IF;
END $$;

DROP POLICY IF EXISTS business_card_events_public_insert ON public.business_card_events;
CREATE POLICY business_card_events_public_insert ON public.business_card_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    business_card_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_events.business_card_id
        AND card.is_published IS TRUE
        AND (
          card.business_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.businesses AS business
            WHERE business.id = card.business_id
              AND business.owner_user_id = card.owner_user_id
              AND business.active IS TRUE
          )
        )
    )
    AND (
      (
        event_type IN ('offer_view', 'offer_claim')
        AND offer_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.business_card_offers AS offer
          WHERE offer.id = business_card_events.offer_id
            AND offer.business_card_id = business_card_events.business_card_id
            AND offer.is_active IS TRUE
            AND (offer.starts_at IS NULL OR offer.starts_at <= now())
            AND (offer.ends_at IS NULL OR offer.ends_at >= now())
        )
      )
      OR (
        event_type NOT IN ('offer_view', 'offer_claim')
        AND offer_id IS NULL
      )
    )
    AND (
      (
        qr_link_id IS NULL
        AND event_type <> 'qr_scan'
      )
      OR (
        qr_link_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.qr_links AS qr
          JOIN public.business_cards AS card
            ON card.id = business_card_events.business_card_id
          WHERE qr.id = business_card_events.qr_link_id
            AND qr.status = 'active'
            AND (qr.expires_at IS NULL OR qr.expires_at > now())
            AND qr.destination_type = 'business_card'
            AND qr.destination_id = business_card_events.business_card_id
            AND qr.owner_user_id = card.owner_user_id
            AND (
              qr.business_id IS NULL
              OR card.business_id = qr.business_id
            )
        )
      )
    )
    AND (
      event_type <> 'interactive_ad_click'
      OR (
        public.adpadz_jsonb_uuid(metadata, 'campaign_id') IS NOT NULL
        AND public.adpadz_campaign_event_is_coherent(
          public.adpadz_jsonb_uuid(metadata, 'campaign_id'),
          business_card_id,
          'interactive_ad'
        )
      )
    )
  );

DROP POLICY IF EXISTS business_card_events_owner_select ON public.business_card_events;
CREATE POLICY business_card_events_owner_select ON public.business_card_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_cards AS card
      WHERE card.id = business_card_events.business_card_id
        AND card.owner_user_id = auth.uid()
    )
    OR (
      business_card_id IS NULL
      AND EXISTS (
      SELECT 1
      FROM public.business_card_offers AS offer
      JOIN public.business_cards AS card
        ON card.id = offer.business_card_id
      WHERE offer.id = business_card_events.offer_id
        AND card.owner_user_id = auth.uid()
      )
    )
    OR (
      business_card_id IS NULL
      AND offer_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.qr_links AS qr
        WHERE qr.id = business_card_events.qr_link_id
          AND qr.owner_user_id = auth.uid()
      )
    )
  );

-- Save the Campaign Engine record and all selected outputs as one database
-- transaction. SECURITY INVOKER keeps RLS active; explicit checks produce
-- useful errors before any destructive replacement is attempted.
CREATE OR REPLACE FUNCTION public.save_campaign_bundle(
  p_campaign jsonb,
  p_outputs jsonb,
  p_campaign_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  campaign_input public.campaigns%ROWTYPE;
  effective_campaign public.campaigns%ROWTYPE;
  saved_campaign_id uuid;
  output_item record;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save a campaign'
      USING ERRCODE = '42501';
  END IF;

  IF p_campaign IS NULL OR jsonb_typeof(p_campaign) <> 'object' THEN
    RAISE EXCEPTION 'p_campaign must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF p_outputs IS NULL OR jsonb_typeof(p_outputs) <> 'array' THEN
    RAISE EXCEPTION 'p_outputs must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_outputs) > 32 THEN
    RAISE EXCEPTION 'A campaign bundle cannot contain more than 32 outputs'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_outputs) AS item(value)
    WHERE jsonb_typeof(item.value) <> 'object'
  ) THEN
    RAISE EXCEPTION 'Every campaign output must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  campaign_input := jsonb_populate_record(NULL::public.campaigns, p_campaign);

  IF p_campaign_id IS NULL THEN
    effective_campaign := campaign_input;
    effective_campaign.owner_id := actor_id;
    effective_campaign.status := COALESCE(effective_campaign.status, 'draft');
  ELSE
    SELECT *
    INTO effective_campaign
    FROM public.campaigns
    WHERE id = p_campaign_id
      AND owner_id = actor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Campaign not found or not owned by the current user'
        USING ERRCODE = '42501';
    END IF;

    IF p_campaign ? 'business_id' THEN
      effective_campaign.business_id := campaign_input.business_id;
    END IF;
    IF p_campaign ? 'title' THEN
      effective_campaign.title := campaign_input.title;
    END IF;
    IF p_campaign ? 'headline' THEN
      effective_campaign.headline := campaign_input.headline;
    END IF;
    IF p_campaign ? 'description' THEN
      effective_campaign.description := campaign_input.description;
    END IF;
    IF p_campaign ? 'offer_title' THEN
      effective_campaign.offer_title := campaign_input.offer_title;
    END IF;
    IF p_campaign ? 'offer_description' THEN
      effective_campaign.offer_description := campaign_input.offer_description;
    END IF;
    IF p_campaign ? 'cta_label' THEN
      effective_campaign.cta_label := campaign_input.cta_label;
    END IF;
    IF p_campaign ? 'cta_url' THEN
      effective_campaign.cta_url := campaign_input.cta_url;
    END IF;
    IF p_campaign ? 'status' THEN
      effective_campaign.status := campaign_input.status;
    END IF;
    IF p_campaign ? 'start_date' THEN
      effective_campaign.start_date := campaign_input.start_date;
    END IF;
    IF p_campaign ? 'end_date' THEN
      effective_campaign.end_date := campaign_input.end_date;
    END IF;
    IF p_campaign ? 'primary_image_id' THEN
      effective_campaign.primary_image_id := campaign_input.primary_image_id;
    END IF;
    IF p_campaign ? 'primary_video_id' THEN
      effective_campaign.primary_video_id := campaign_input.primary_video_id;
    END IF;
    IF p_campaign ? 'primary_qr_id' THEN
      effective_campaign.primary_qr_id := campaign_input.primary_qr_id;
    END IF;
  END IF;

  IF NULLIF(btrim(effective_campaign.title), '') IS NULL THEN
    RAISE EXCEPTION 'Campaign title is required'
      USING ERRCODE = '23502';
  END IF;

  IF effective_campaign.status IS NULL
     OR effective_campaign.status NOT IN ('draft', 'active', 'scheduled', 'expired') THEN
    RAISE EXCEPTION 'Invalid campaign status'
      USING ERRCODE = '23514';
  END IF;

  IF effective_campaign.start_date IS NOT NULL
     AND effective_campaign.end_date IS NOT NULL
     AND effective_campaign.end_date < effective_campaign.start_date THEN
    RAISE EXCEPTION 'Campaign end_date must not precede start_date'
      USING ERRCODE = '23514';
  END IF;

  IF NOT public.adpadz_campaign_write_is_owned(
    effective_campaign.business_id,
    effective_campaign.primary_image_id,
    effective_campaign.primary_video_id,
    effective_campaign.primary_qr_id,
    actor_id
  ) THEN
    RAISE EXCEPTION 'Campaign references a resource owned by another tenant'
      USING ERRCODE = '42501';
  END IF;

  IF p_campaign_id IS NULL THEN
    INSERT INTO public.campaigns (
      business_id,
      owner_id,
      title,
      headline,
      description,
      offer_title,
      offer_description,
      cta_label,
      cta_url,
      status,
      start_date,
      end_date,
      primary_image_id,
      primary_video_id,
      primary_qr_id
    ) VALUES (
      effective_campaign.business_id,
      actor_id,
      btrim(effective_campaign.title),
      effective_campaign.headline,
      effective_campaign.description,
      effective_campaign.offer_title,
      effective_campaign.offer_description,
      effective_campaign.cta_label,
      effective_campaign.cta_url,
      effective_campaign.status,
      effective_campaign.start_date,
      effective_campaign.end_date,
      effective_campaign.primary_image_id,
      effective_campaign.primary_video_id,
      effective_campaign.primary_qr_id
    )
    RETURNING id INTO saved_campaign_id;
  ELSE
    UPDATE public.campaigns
    SET
      business_id = effective_campaign.business_id,
      title = btrim(effective_campaign.title),
      headline = effective_campaign.headline,
      description = effective_campaign.description,
      offer_title = effective_campaign.offer_title,
      offer_description = effective_campaign.offer_description,
      cta_label = effective_campaign.cta_label,
      cta_url = effective_campaign.cta_url,
      status = effective_campaign.status,
      start_date = effective_campaign.start_date,
      end_date = effective_campaign.end_date,
      primary_image_id = effective_campaign.primary_image_id,
      primary_video_id = effective_campaign.primary_video_id,
      primary_qr_id = effective_campaign.primary_qr_id
    WHERE id = p_campaign_id
      AND owner_id = actor_id
    RETURNING id INTO saved_campaign_id;

    IF saved_campaign_id IS NULL THEN
      RAISE EXCEPTION 'Campaign update was rejected by ownership policy'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT item.output_type, count(*) AS occurrences
      FROM jsonb_to_recordset(p_outputs) AS item(output_type text)
      GROUP BY item.output_type
      HAVING count(*) > 1 OR item.output_type IS NULL
    ) AS invalid_output
  ) THEN
    RAISE EXCEPTION 'Campaign output types must be present and unique'
      USING ERRCODE = '23505';
  END IF;

  FOR output_item IN
    SELECT
      item.output_type,
      COALESCE(item.enabled, true) AS enabled,
      COALESCE(item.sort_order, 0) AS sort_order,
      COALESCE(item.metadata, '{}'::jsonb) AS metadata
    FROM jsonb_to_recordset(p_outputs) AS item(
      output_type text,
      enabled boolean,
      sort_order integer,
      metadata jsonb
    )
  LOOP
    IF jsonb_typeof(output_item.metadata) <> 'object' THEN
      RAISE EXCEPTION 'Campaign output metadata must be a JSON object'
        USING ERRCODE = '22023';
    END IF;

    IF NOT public.adpadz_campaign_output_is_owned(
      saved_campaign_id,
      output_item.output_type,
      output_item.enabled,
      output_item.metadata,
      actor_id
    ) THEN
      RAISE EXCEPTION 'Campaign output references another tenant resource'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  DELETE FROM public.campaign_outputs
  WHERE campaign_id = saved_campaign_id;

  INSERT INTO public.campaign_outputs (
    campaign_id,
    output_type,
    enabled,
    sort_order,
    metadata
  )
  SELECT
    saved_campaign_id,
    item.output_type,
    COALESCE(item.enabled, true),
    COALESCE(item.sort_order, 0),
    COALESCE(item.metadata, '{}'::jsonb)
  FROM jsonb_to_recordset(p_outputs) AS item(
    output_type text,
    enabled boolean,
    sort_order integer,
    metadata jsonb
  );

  RETURN saved_campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid) TO authenticated;
