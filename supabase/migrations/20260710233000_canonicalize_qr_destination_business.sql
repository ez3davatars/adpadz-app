-- Keep QR destination ownership and Business Hub identity canonical.
-- Business-card links previously allowed a null business_id even when the
-- destination card belonged to a Hub, which made the hardened resolver fail
-- closed. Campaign links also need a safe one-transaction path while an
-- existing unassigned campaign and its primary QR are connected to a Hub.

UPDATE public.qr_links AS qr
SET business_id = card.business_id
FROM public.business_cards AS card
WHERE qr.destination_type = 'business_card'
  AND qr.destination_id = card.id
  AND qr.owner_user_id = card.owner_user_id
  AND qr.business_id IS DISTINCT FROM card.business_id;

CREATE OR REPLACE FUNCTION public.adpadz_qr_campaign_destination_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  destination_owner uuid;
  destination_business uuid;
  destination_status text;
  destination_found boolean;
  require_public_destination boolean := TG_OP = 'INSERT';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    require_public_destination := OLD.destination_type IS DISTINCT FROM NEW.destination_type
      OR OLD.destination_id IS DISTINCT FROM NEW.destination_id;
  END IF;

  IF NEW.destination_type = 'business_card' THEN
    IF NEW.destination_id IS NULL THEN
      RAISE EXCEPTION 'Business Card QR destinations require destination_id'
        USING ERRCODE = '23502';
    END IF;

    SELECT card.owner_user_id, card.business_id
    INTO destination_owner, destination_business
    FROM public.business_cards AS card
    WHERE card.id = NEW.destination_id;
    destination_found := FOUND;

    IF NOT destination_found
      AND NOT require_public_destination
      AND NEW.owner_user_id IS NOT NULL
      AND (actor_id IS NULL OR NEW.owner_user_id = actor_id)
      AND (
        NEW.business_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.businesses AS business
          WHERE business.id = NEW.business_id
            AND business.owner_user_id = NEW.owner_user_id
        )
      ) THEN
      RETURN NEW;
    ELSIF NOT destination_found THEN
      RAISE EXCEPTION 'Business Card QR destination was not found'
        USING ERRCODE = '23503';
    END IF;

    IF actor_id IS NOT NULL AND destination_owner IS DISTINCT FROM actor_id THEN
      RAISE EXCEPTION 'Business Card QR destination is owned by another tenant'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.owner_user_id IS DISTINCT FROM destination_owner THEN
      RAISE EXCEPTION 'QR owner must match Business Card owner'
        USING ERRCODE = '42501';
    END IF;

    -- Always derive this value. A null Hub is meaningful and must match the
    -- destination exactly for resolve_qr_redirect().
    NEW.business_id := destination_business;
    RETURN NEW;
  END IF;

  IF NEW.destination_type <> 'campaign' THEN
    RETURN NEW;
  END IF;

  IF NEW.destination_id IS NULL THEN
    RAISE EXCEPTION 'Campaign QR destinations require destination_id'
      USING ERRCODE = '23502';
  END IF;

  SELECT campaign.owner_id, campaign.business_id, campaign.status
  INTO destination_owner, destination_business, destination_status
  FROM public.campaigns AS campaign
  WHERE campaign.id = NEW.destination_id;
  destination_found := FOUND;

  IF NOT destination_found
    AND NOT require_public_destination
    AND NEW.owner_user_id IS NOT NULL
    AND (actor_id IS NULL OR NEW.owner_user_id = actor_id)
    AND (
      NEW.business_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.businesses AS business
        WHERE business.id = NEW.business_id
          AND business.owner_user_id = NEW.owner_user_id
      )
    ) THEN
    RETURN NEW;
  ELSIF NOT destination_found THEN
    RAISE EXCEPTION 'Campaign QR destination was not found'
      USING ERRCODE = '23503';
  END IF;

  IF require_public_destination
    AND (
      destination_status NOT IN ('active', 'scheduled')
      OR NOT EXISTS (
      SELECT 1
      FROM public.campaign_outputs AS output
      WHERE output.campaign_id = NEW.destination_id
        AND output.output_type = 'qr_landing'
        AND output.enabled IS TRUE
        AND public.adpadz_campaign_output_is_owned(
          output.campaign_id,
          output.output_type,
          output.enabled,
          output.metadata,
          destination_owner
        )
      )
    ) THEN
    RAISE EXCEPTION 'Campaign QR destination is unavailable or has no coherent QR Landing output'
      USING ERRCODE = '23503';
  END IF;

  IF actor_id IS NOT NULL AND destination_owner IS DISTINCT FROM actor_id THEN
    RAISE EXCEPTION 'Campaign QR destination is owned by another tenant'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM destination_owner THEN
    RAISE EXCEPTION 'QR owner must match campaign owner'
      USING ERRCODE = '42501';
  END IF;

  IF destination_business IS NOT NULL THEN
    IF NEW.business_id IS NULL THEN
      NEW.business_id := destination_business;
    ELSIF NEW.business_id IS DISTINCT FROM destination_business THEN
      RAISE EXCEPTION 'QR business must exactly match campaign business'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.business_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.businesses AS business
    WHERE business.id = NEW.business_id
      AND business.owner_user_id = destination_owner
  ) THEN
    RAISE EXCEPTION 'QR business must belong to the campaign owner'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.adpadz_qr_campaign_destination_guard() FROM PUBLIC;

COMMENT ON FUNCTION public.adpadz_qr_campaign_destination_guard() IS
  'Derives Business Card QR Hub identity and validates Campaign QR ownership, including atomic legacy Hub attachment.';
