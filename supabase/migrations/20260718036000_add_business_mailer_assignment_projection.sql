CREATE OR REPLACE FUNCTION public.get_business_community_mailer_assignments()
RETURNS TABLE (
  placement_id uuid,
  community_card_id uuid,
  campaign_id uuid,
  campaign_title text,
  campaign_status text,
  placement_locked boolean,
  layout_locked boolean,
  mailing_date date,
  proof_status text,
  production_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT slot.id, slot.community_card_id, campaign.id, campaign.title,
    campaign.status, slot.is_locked, card.layout_locked, card.mailing_date,
    slot.proof_status, slot.production_status
  FROM public.community_card_slots AS slot
  JOIN public.community_cards AS card ON card.id = slot.community_card_id
  JOIN public.businesses AS business ON business.id = slot.business_id
    AND business.owner_user_id = auth.uid()
  LEFT JOIN public.campaigns AS campaign ON campaign.id = slot.campaign_id
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_business_community_mailer_assignments()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_community_mailer_assignments()
  TO authenticated;

NOTIFY pgrst, 'reload schema';
