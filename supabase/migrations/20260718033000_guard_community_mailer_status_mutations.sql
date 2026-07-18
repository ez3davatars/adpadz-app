-- Ensure lifecycle status cannot bypass transition/preflight RPC guards.

CREATE OR REPLACE FUNCTION public.guard_community_mailer_status_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND current_setting(
       'adpadz.community_mailer_status_transition', true
     ) IS DISTINCT FROM 'allowed'
  THEN
    RAISE EXCEPTION
      'Community Mailer status changes require the production transition API.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_cards_guard_status_mutation
  ON public.community_cards;
CREATE TRIGGER community_cards_guard_status_mutation
  BEFORE UPDATE OF status ON public.community_cards
  FOR EACH ROW EXECUTE FUNCTION public.guard_community_mailer_status_mutation();

CREATE OR REPLACE FUNCTION public.record_admin_community_mailer_preflight(
  p_mailer_id uuid,
  p_fingerprint text,
  p_passed boolean,
  p_blocking_count integer,
  p_warning_count integer,
  p_checks jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  card public.community_cards%ROWTYPE;
  actual_blockers bigint;
  run_id uuid;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO card FROM public.community_cards
  WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002';
  END IF;
  IF card.layout_locked IS NOT TRUE THEN
    RAISE EXCEPTION 'Lock the layout before recording final preflight.';
  END IF;
  IF jsonb_typeof(p_checks) <> 'array'
     OR p_blocking_count < 0 OR p_warning_count < 0
     OR p_fingerprint !~ ('^cm-' || card.layout_revision::text || '-[0-9a-f]{8}$')
  THEN RAISE EXCEPTION 'Invalid preflight payload.'; END IF;
  SELECT
    (CASE WHEN card.mailing_date IS NULL THEN 1 ELSE 0 END) +
    (CASE WHEN card.postal_area_confirmed IS NOT TRUE
      OR card.postal_area_confirmation_revision IS DISTINCT FROM card.layout_revision
      THEN 1 ELSE 0 END) +
    (CASE WHEN card.printer_specs_confirmed IS NOT TRUE
      OR card.printer_specs_confirmation_revision IS DISTINCT FROM card.layout_revision
      THEN 1 ELSE 0 END) +
    (CASE WHEN card.color_profile_confirmed IS NOT TRUE
      OR card.color_profile_confirmation_revision IS DISTINCT FROM card.layout_revision
      THEN 1 ELSE 0 END) +
    count(*) FILTER (WHERE slot.status NOT IN ('available','unavailable')
      AND (
        slot.business_id IS NULL
        OR (slot.creative_asset_id IS NULL AND slot.ad_image_url IS NULL)
        OR slot.payment_status NOT IN ('paid','waived')
        OR slot.proof_status <> 'approved'
      ))
  INTO actual_blockers
  FROM public.community_card_slots AS slot
  WHERE slot.community_card_id = card.id
    AND slot.placement_type NOT IN ('brand','adpadz');
  IF p_passed IS DISTINCT FROM (actual_blockers = 0)
     OR p_blocking_count::bigint IS DISTINCT FROM actual_blockers THEN
    RAISE EXCEPTION 'Preflight result does not match current mailer state.';
  END IF;
  INSERT INTO public.community_mailer_preflight_runs (
    community_card_id, production_version, layout_revision, fingerprint,
    passed, blocking_count, warning_count, checks, created_by
  ) VALUES (
    card.id, card.production_version, card.layout_revision, p_fingerprint,
    p_passed, actual_blockers::integer, p_warning_count, p_checks, auth.uid()
  )
  ON CONFLICT (community_card_id, production_version, fingerprint)
  DO UPDATE SET passed = EXCLUDED.passed,
    blocking_count = EXCLUDED.blocking_count,
    warning_count = EXCLUDED.warning_count,
    checks = EXCLUDED.checks,
    created_at = now()
  RETURNING id INTO run_id;
  PERFORM set_config(
    'adpadz.community_mailer_status_transition', 'allowed', true
  );
  UPDATE public.community_cards SET
    preflight_fingerprint = CASE WHEN p_passed THEN p_fingerprint ELSE NULL END,
    preflight_layout_revision = CASE WHEN p_passed THEN layout_revision ELSE NULL END,
    preflight_completed_at = CASE WHEN p_passed THEN now() ELSE NULL END,
    status = CASE WHEN p_passed THEN 'ready_for_print' ELSE 'review' END
  WHERE id = p_mailer_id;
  RETURN run_id;
END;
$$;

-- Patch the guarded transition function without changing its public signature.
CREATE OR REPLACE FUNCTION public.allow_community_mailer_status_transition()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT set_config(
    'adpadz.community_mailer_status_transition', 'allowed', true
  )::void;
$$;
REVOKE ALL ON FUNCTION public.allow_community_mailer_status_transition()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
