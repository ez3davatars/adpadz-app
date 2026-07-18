-- Release hardening for Community Mailer production contracts.

ALTER TABLE public.community_cards
  ADD COLUMN IF NOT EXISTS postal_area_confirmation_revision bigint,
  ADD COLUMN IF NOT EXISTS printer_specs_confirmation_revision bigint,
  ADD COLUMN IF NOT EXISTS color_profile_confirmation_revision bigint;

ALTER TABLE public.community_mailer_exports
  ADD COLUMN IF NOT EXISTS export_kind text NOT NULL
    DEFAULT 'production_candidate',
  ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE public.community_mailer_exports
  DROP CONSTRAINT IF EXISTS community_mailer_exports_kind_check;
ALTER TABLE public.community_mailer_exports
  ADD CONSTRAINT community_mailer_exports_kind_check CHECK (
    export_kind IN ('preview','browser_draft','production_candidate',
      'printer_certified')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.confirm_admin_community_mailer_preflight(
  p_mailer_id uuid,
  p_confirmation text,
  p_confirmed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE card_revision bigint;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_confirmation NOT IN (
    'postal_area_confirmed','printer_specs_confirmed','color_profile_confirmed'
  ) THEN RAISE EXCEPTION 'Unsupported preflight confirmation.'; END IF;
  SELECT layout_revision INTO card_revision
  FROM public.community_cards WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.community_cards SET
    postal_area_confirmed = CASE WHEN p_confirmation = 'postal_area_confirmed'
      THEN p_confirmed ELSE postal_area_confirmed END,
    postal_area_confirmation_revision =
      CASE WHEN p_confirmation = 'postal_area_confirmed' AND p_confirmed
        THEN card_revision
      WHEN p_confirmation = 'postal_area_confirmed' THEN NULL
      ELSE postal_area_confirmation_revision END,
    printer_specs_confirmed =
      CASE WHEN p_confirmation = 'printer_specs_confirmed'
        THEN p_confirmed ELSE printer_specs_confirmed END,
    printer_specs_confirmation_revision =
      CASE WHEN p_confirmation = 'printer_specs_confirmed' AND p_confirmed
        THEN card_revision
      WHEN p_confirmation = 'printer_specs_confirmed' THEN NULL
      ELSE printer_specs_confirmation_revision END,
    color_profile_confirmed =
      CASE WHEN p_confirmation = 'color_profile_confirmed'
        THEN p_confirmed ELSE color_profile_confirmed END,
    color_profile_confirmation_revision =
      CASE WHEN p_confirmation = 'color_profile_confirmed' AND p_confirmed
        THEN card_revision
      WHEN p_confirmation = 'color_profile_confirmed' THEN NULL
      ELSE color_profile_confirmation_revision END,
    preflight_fingerprint = NULL,
    preflight_layout_revision = NULL,
    preflight_completed_at = NULL
  WHERE id = p_mailer_id;
END;
$$;

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
  actual_blockers integer;
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
     OR p_blocking_count IS DISTINCT FROM actual_blockers THEN
    RAISE EXCEPTION 'Preflight result does not match current mailer state.';
  END IF;

  INSERT INTO public.community_mailer_preflight_runs (
    community_card_id, production_version, layout_revision, fingerprint,
    passed, blocking_count, warning_count, checks, created_by
  ) VALUES (
    card.id, card.production_version, card.layout_revision, p_fingerprint,
    p_passed, actual_blockers, p_warning_count, p_checks, auth.uid()
  )
  ON CONFLICT (community_card_id, production_version, fingerprint)
  DO UPDATE SET passed = EXCLUDED.passed,
    blocking_count = EXCLUDED.blocking_count,
    warning_count = EXCLUDED.warning_count,
    checks = EXCLUDED.checks,
    created_at = now()
  RETURNING id INTO run_id;

  UPDATE public.community_cards SET
    preflight_fingerprint = CASE WHEN p_passed THEN p_fingerprint ELSE NULL END,
    preflight_layout_revision = CASE WHEN p_passed THEN layout_revision ELSE NULL END,
    preflight_completed_at = CASE WHEN p_passed THEN now() ELSE NULL END,
    status = CASE WHEN p_passed THEN 'ready_for_print' ELSE 'review' END
  WHERE id = p_mailer_id;
  RETURN run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_admin_community_mailer_export(
  p_mailer_id uuid,
  p_preflight_run_id uuid,
  p_manifest jsonb,
  p_export_kind text,
  p_checksum text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE card public.community_cards%ROWTYPE; export_id uuid;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO card FROM public.community_cards
  WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community Mailer not found.'; END IF;
  IF p_export_kind NOT IN (
    'preview','browser_draft','production_candidate','printer_certified'
  ) OR jsonb_typeof(p_manifest) <> 'object' THEN
    RAISE EXCEPTION 'Invalid export contract.';
  END IF;
  IF card.layout_locked IS NOT TRUE
     OR card.preflight_layout_revision IS DISTINCT FROM card.layout_revision
     OR NOT EXISTS (
       SELECT 1 FROM public.community_mailer_preflight_runs AS run
       WHERE run.id = p_preflight_run_id
         AND run.community_card_id = card.id
         AND run.layout_revision = card.layout_revision
         AND run.production_version = card.production_version
         AND run.passed IS TRUE
         AND run.fingerprint = card.preflight_fingerprint
     ) THEN
    RAISE EXCEPTION 'A current passing preflight is required for export.';
  END IF;
  INSERT INTO public.community_mailer_exports (
    community_card_id, preflight_run_id, production_version, layout_revision,
    fingerprint, manifest, export_kind, checksum, created_by
  ) VALUES (
    card.id, p_preflight_run_id, card.production_version, card.layout_revision,
    card.preflight_fingerprint, p_manifest, p_export_kind,
    NULLIF(btrim(p_checksum), ''), auth.uid()
  ) RETURNING id INTO export_id;
  RETURN export_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_community_mailer_preflight()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.layout_revision IS DISTINCT FROM OLD.layout_revision
     OR (OLD.layout_locked IS TRUE AND NEW.layout_locked IS FALSE) THEN
    NEW.preflight_fingerprint = NULL;
    NEW.preflight_layout_revision = NULL;
    NEW.preflight_completed_at = NULL;
    NEW.postal_area_confirmed = false;
    NEW.postal_area_confirmation_revision = NULL;
    NEW.printer_specs_confirmed = false;
    NEW.printer_specs_confirmation_revision = NULL;
    NEW.color_profile_confirmed = false;
    NEW.color_profile_confirmation_revision = NULL;
    NEW.production_version = OLD.production_version + 1;
    IF NEW.status IN ('ready_for_print','printed') THEN NEW.status = 'review'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_mailer_on_placement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR
    ROW(NEW.business_id, NEW.creative_asset_id, NEW.ad_image_url, NEW.qr_link_id,
      NEW.proof_status, NEW.payment_status, NEW.side, NEW.x, NEW.y, NEW.width,
      NEW.height)
    IS DISTINCT FROM
    ROW(OLD.business_id, OLD.creative_asset_id, OLD.ad_image_url, OLD.qr_link_id,
      OLD.proof_status, OLD.payment_status, OLD.side, OLD.x, OLD.y, OLD.width,
      OLD.height)
  THEN
    UPDATE public.community_cards
    SET layout_revision = layout_revision + 1
    WHERE id = COALESCE(NEW.community_card_id, OLD.community_card_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS community_card_slots_invalidate_production
  ON public.community_card_slots;
CREATE TRIGGER community_card_slots_invalidate_production
  AFTER INSERT OR UPDATE OR DELETE ON public.community_card_slots
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_mailer_on_placement_change();

CREATE OR REPLACE FUNCTION public.transition_admin_community_mailer_production(
  p_mailer_id uuid,
  p_to_status text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE card public.community_cards%ROWTYPE;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO card FROM public.community_cards
  WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community Mailer not found.'; END IF;
  IF NOT (
    (card.status = 'draft' AND p_to_status = 'selling') OR
    (card.status = 'selling' AND p_to_status = 'building') OR
    (card.status = 'building' AND p_to_status = 'review') OR
    (card.status IN ('review','proof','approved')
      AND p_to_status = 'ready_for_print') OR
    (card.status = 'ready_for_print' AND p_to_status = 'printed') OR
    (card.status = 'printed' AND p_to_status = 'mailed') OR
    (card.status = 'mailed' AND p_to_status = 'published') OR
    (card.status <> 'archived' AND p_to_status = 'archived')
  ) THEN RAISE EXCEPTION 'Invalid Community Mailer production transition.'; END IF;
  IF p_to_status = 'ready_for_print' AND (
    card.layout_locked IS NOT TRUE OR card.preflight_fingerprint IS NULL OR
    card.preflight_layout_revision IS DISTINCT FROM card.layout_revision
  ) THEN RAISE EXCEPTION 'A passing preflight for the locked revision is required.'; END IF;
  IF p_to_status = 'printed' AND NOT EXISTS (
    SELECT 1 FROM public.community_mailer_exports AS export
    WHERE export.community_card_id = card.id
      AND export.layout_revision = card.layout_revision
      AND export.production_version = card.production_version
      AND export.fingerprint = card.preflight_fingerprint
      AND export.export_kind IN ('production_candidate','printer_certified')
  ) THEN RAISE EXCEPTION 'A current production candidate export is required.'; END IF;
  IF p_to_status = 'published' AND (
    card.is_published IS NOT TRUE OR card.discovery_qr_link_id IS NULL OR
    NOT EXISTS (
      SELECT 1 FROM public.qr_links AS qr
      WHERE qr.id = card.discovery_qr_link_id
        AND qr.status = 'active'
        AND NULLIF(btrim(qr.destination_url), '') IS NOT NULL
        AND (qr.expires_at IS NULL OR qr.expires_at > now())
    ) OR EXISTS (
      SELECT 1 FROM public.community_card_slots AS slot
      LEFT JOIN public.qr_links AS qr ON qr.id = slot.qr_link_id
      WHERE slot.community_card_id = card.id
        AND slot.qr_link_id IS NOT NULL
        AND (qr.id IS NULL OR qr.status <> 'active'
          OR NULLIF(btrim(qr.destination_url), '') IS NULL
          OR (qr.expires_at IS NOT NULL AND qr.expires_at <= now()))
    )
  ) THEN RAISE EXCEPTION 'Required public QR destinations are unavailable.'; END IF;
  PERFORM set_config(
    'adpadz.community_mailer_status_transition', 'allowed', true
  );
  UPDATE public.community_cards SET
    status = p_to_status,
    sales_open = CASE WHEN p_to_status IN (
      'building','review','ready_for_print','printed','mailed','published','archived'
    ) THEN false ELSE sales_open END,
    printed_at = CASE WHEN p_to_status = 'printed' THEN now() ELSE printed_at END,
    mailed_at = CASE WHEN p_to_status = 'mailed' THEN now() ELSE mailed_at END,
    digital_published_at = CASE WHEN p_to_status = 'published'
      THEN now() ELSE digital_published_at END
  WHERE id = p_mailer_id;
  INSERT INTO public.community_mailer_production_events (
    community_card_id, actor_user_id, event_type, from_status, to_status,
    production_version, details
  ) VALUES (
    card.id, auth.uid(), 'status_transition', card.status, p_to_status,
    card.production_version, COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_admin_community_mailer_export(
  uuid,uuid,jsonb,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_community_mailer_export(
  uuid,uuid,jsonb,text,text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
