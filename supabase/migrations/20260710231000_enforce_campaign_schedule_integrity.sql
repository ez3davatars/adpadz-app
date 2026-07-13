-- Scheduled campaigns must have a start date and never publish early.

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_scheduled_start_check;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_public_business_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_scheduled_start_check
  CHECK (status <> 'scheduled' OR start_date IS NOT NULL)
  NOT VALID,
  ADD CONSTRAINT campaigns_public_business_check
  CHECK (status NOT IN ('active', 'scheduled') OR business_id IS NOT NULL)
  NOT VALID;

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
      AND (
        (
          campaign.status = 'active'
          AND (campaign.start_date IS NULL OR campaign.start_date <= now())
        )
        OR (
          campaign.status = 'scheduled'
          AND campaign.start_date IS NOT NULL
          AND campaign.start_date <= now()
        )
      )
      AND (campaign.end_date IS NULL OR campaign.end_date >= now())
      AND output.enabled IS TRUE
      AND output.output_type IN ('smart_card', 'interactive_ad', 'qr_landing')
      AND campaign.business_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.businesses AS business
        WHERE business.id = campaign.business_id
          AND business.owner_user_id = campaign.owner_id
          AND business.active IS TRUE
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
                SELECT 1
                FROM public.businesses AS business
                WHERE business.id = card.business_id
                  AND business.owner_user_id = card.owner_user_id
                  AND business.active IS TRUE
              )
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.adpadz_campaign_output_is_public(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adpadz_campaign_output_is_public(uuid, text) TO anon, authenticated;

COMMENT ON CONSTRAINT campaigns_scheduled_start_check ON public.campaigns IS
  'Scheduled campaigns require an explicit start date; the public helper also prevents early publication.';

COMMENT ON CONSTRAINT campaigns_public_business_check ON public.campaigns IS
  'Active and scheduled campaigns must belong to the owner Business Hub.';
