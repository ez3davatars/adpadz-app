-- Adpadz Smart Cards premium v1 upgrade
-- Adds template selection and a simple gallery module without changing existing routes.

ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'modern_glass';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_cards_template_check'
  ) THEN
    ALTER TABLE public.business_cards
      ADD CONSTRAINT business_cards_template_check
      CHECK (template IN (
        'modern_glass',
        'luxury',
        'restaurant',
        'home_services',
        'realtor',
        'fitness',
        'automotive',
        'minimal'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.business_card_gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_card_gallery_items_image_url_http CHECK (image_url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS business_card_gallery_items_card_sort_idx
  ON public.business_card_gallery_items(card_id, sort_order);

DROP TRIGGER IF EXISTS business_card_gallery_items_set_updated_at ON public.business_card_gallery_items;
CREATE TRIGGER business_card_gallery_items_set_updated_at
  BEFORE UPDATE ON public.business_card_gallery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.business_cards_set_updated_at();

ALTER TABLE public.business_card_gallery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_card_gallery_public_read" ON public.business_card_gallery_items;
CREATE POLICY "business_card_gallery_public_read" ON public.business_card_gallery_items
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_gallery_items.card_id
        AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "business_card_gallery_owner_manage" ON public.business_card_gallery_items;
CREATE POLICY "business_card_gallery_owner_manage" ON public.business_card_gallery_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_gallery_items.card_id
        AND business_cards.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_gallery_items.card_id
        AND business_cards.owner_user_id = auth.uid()
    )
  );

GRANT SELECT ON public.business_card_gallery_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_card_gallery_items TO authenticated;
