ALTER TABLE public.business_card_leads
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.business_card_leads
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS business_card_leads_set_updated_at ON public.business_card_leads;
CREATE TRIGGER business_card_leads_set_updated_at
  BEFORE UPDATE ON public.business_card_leads
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

DROP POLICY IF EXISTS "business_card_leads_owner_update" ON public.business_card_leads;
CREATE POLICY "business_card_leads_owner_update" ON public.business_card_leads
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT UPDATE ON public.business_card_leads TO authenticated;


