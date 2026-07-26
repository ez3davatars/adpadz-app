-- Creative changes may invalidate only Community Mailers that are still in a
-- mutable, pre-print lifecycle. Printed and later records are historical
-- evidence: their revision, preflight, confirmations, timestamps, and export
-- bindings must never move when an advertiser edits Campaign creative.

CREATE OR REPLACE FUNCTION public.scope_community_mailer_revision_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.layout_revision IS NOT DISTINCT FROM OLD.layout_revision THEN
    RETURN NEW;
  END IF;

  -- Mutable/current statuses are the active pre-print lifecycle plus the two
  -- legacy pre-print values still admitted by community_cards_status_check.
  -- Any unknown future status fails closed as immutable.
  IF OLD.status NOT IN (
    'draft',
    'selling',
    'building',
    'review',
    'ready_for_print',
    'proof',
    'approved'
  ) THEN
    -- Returning NULL skips this row before updated_at and preflight
    -- invalidation triggers run. Other mutable Mailers in the same Campaign
    -- UPDATE continue to advance normally.
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.scope_community_mailer_revision_invalidation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
  community_cards_00_scope_creative_print_invalidation
  ON public.community_cards;
CREATE TRIGGER community_cards_00_scope_creative_print_invalidation
  BEFORE UPDATE OF layout_revision ON public.community_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.scope_community_mailer_revision_invalidation();

COMMENT ON FUNCTION public.scope_community_mailer_revision_invalidation() IS
  'Allows revision invalidation only for pre-print Community Mailers; printed, mailed, published, archived, and unknown lifecycle states remain immutable.';

NOTIFY pgrst, 'reload schema';
