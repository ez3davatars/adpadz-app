CREATE OR REPLACE FUNCTION public.guard_community_mailer_candidate_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'ready_for_print'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND EXISTS (
       SELECT 1
       FROM public.community_card_slots AS slot
       LEFT JOIN public.campaigns AS campaign ON campaign.id = slot.campaign_id
       LEFT JOIN public.qr_links AS qr ON qr.id = slot.qr_link_id
       WHERE slot.community_card_id = NEW.id
         AND slot.placement_type NOT IN ('brand','adpadz')
         AND slot.status NOT IN ('available','unavailable')
         AND (
           slot.business_id IS NULL
           OR campaign.id IS NULL
           OR campaign.business_id IS DISTINCT FROM slot.business_id
           OR campaign.status = 'expired'
           OR qr.id IS NULL
           OR qr.business_id IS DISTINCT FROM slot.business_id
           OR qr.destination_type IS DISTINCT FROM 'campaign'
           OR qr.destination_id IS DISTINCT FROM campaign.id
           OR qr.status <> 'active'
           OR (qr.expires_at IS NOT NULL AND qr.expires_at <= now())
         )
     )
  THEN
    RAISE EXCEPTION
      'Every occupied placement requires a valid Campaign and Campaign-linked QR.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_cards_guard_candidate_readiness
  ON public.community_cards;
CREATE TRIGGER community_cards_guard_candidate_readiness
  BEFORE UPDATE OF status ON public.community_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_community_mailer_candidate_readiness();

NOTIFY pgrst, 'reload schema';
