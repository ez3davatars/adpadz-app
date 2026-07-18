-- Community Mailer production orchestration.
-- Extends the canonical community_cards/slots model; it does not introduce a
-- second layout, campaign, asset, QR, reservation, or public-rendering model.

ALTER TABLE public.community_cards
  ADD COLUMN IF NOT EXISTS postal_area_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printer_specs_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color_profile_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preflight_fingerprint text,
  ADD COLUMN IF NOT EXISTS preflight_layout_revision bigint,
  ADD COLUMN IF NOT EXISTS preflight_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS mailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS digital_published_at timestamptz;

ALTER TABLE public.community_cards
  DROP CONSTRAINT IF EXISTS community_cards_status_check;
ALTER TABLE public.community_cards
  ADD CONSTRAINT community_cards_status_check CHECK (status IN (
    'draft','selling','building','review','ready_for_print','printed','mailed',
    'published','archived',
    -- Legacy values remain readable while operations converge on the lifecycle.
    'proof','approved'
  )) NOT VALID;

CREATE TABLE IF NOT EXISTS public.community_mailer_preflight_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_card_id uuid NOT NULL
    REFERENCES public.community_cards(id) ON DELETE CASCADE,
  production_version integer NOT NULL,
  layout_revision bigint NOT NULL,
  fingerprint text NOT NULL,
  passed boolean NOT NULL,
  blocking_count integer NOT NULL CHECK (blocking_count >= 0),
  warning_count integer NOT NULL CHECK (warning_count >= 0),
  checks jsonb NOT NULL CHECK (jsonb_typeof(checks) = 'array'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_card_id, production_version, fingerprint)
);

CREATE TABLE IF NOT EXISTS public.community_mailer_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_card_id uuid NOT NULL
    REFERENCES public.community_cards(id) ON DELETE CASCADE,
  preflight_run_id uuid NOT NULL
    REFERENCES public.community_mailer_preflight_runs(id) ON DELETE RESTRICT,
  production_version integer NOT NULL,
  layout_revision bigint NOT NULL,
  fingerprint text NOT NULL,
  manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_mailer_production_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_card_id uuid NOT NULL
    REFERENCES public.community_cards(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  production_version integer NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_mailer_preflight_runs_card_idx
  ON public.community_mailer_preflight_runs(community_card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_mailer_exports_card_idx
  ON public.community_mailer_exports(community_card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_mailer_production_events_card_idx
  ON public.community_mailer_production_events(community_card_id, created_at DESC);

ALTER TABLE public.community_mailer_preflight_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mailer_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mailer_production_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.community_mailer_preflight_runs,
  public.community_mailer_exports, public.community_mailer_production_events
  FROM PUBLIC, anon, authenticated;

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
  IF jsonb_typeof(p_checks) <> 'array' THEN
    RAISE EXCEPTION 'Preflight checks must be an array.';
  END IF;
  INSERT INTO public.community_mailer_preflight_runs (
    community_card_id, production_version, layout_revision, fingerprint,
    passed, blocking_count, warning_count, checks, created_by
  ) VALUES (
    card.id, card.production_version, card.layout_revision, p_fingerprint,
    p_passed, p_blocking_count, p_warning_count, p_checks, auth.uid()
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
    (p_to_status = 'archived')
  ) THEN
    RAISE EXCEPTION 'Invalid Community Mailer production transition.';
  END IF;
  IF p_to_status = 'ready_for_print' AND (
    card.layout_locked IS NOT TRUE OR
    card.preflight_fingerprint IS NULL OR
    card.preflight_layout_revision IS DISTINCT FROM card.layout_revision
  ) THEN
    RAISE EXCEPTION 'A passing preflight for the locked revision is required.';
  END IF;
  UPDATE public.community_cards SET
    status = p_to_status,
    sales_open = CASE WHEN p_to_status IN (
      'building','review','ready_for_print','printed','mailed','published',
      'archived'
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
    NEW.production_version = OLD.production_version + 1;
    IF NEW.status IN ('ready_for_print','printed') THEN NEW.status = 'review'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS community_cards_invalidate_preflight
  ON public.community_cards;
CREATE TRIGGER community_cards_invalidate_preflight
  BEFORE UPDATE ON public.community_cards
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_community_mailer_preflight();

REVOKE ALL ON FUNCTION public.record_admin_community_mailer_preflight(
  uuid,text,boolean,integer,integer,jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_admin_community_mailer_production(
  uuid,text,jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_community_mailer_preflight(
  uuid,text,boolean,integer,integer,jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_admin_community_mailer_production(
  uuid,text,jsonb
) TO authenticated;

COMMENT ON TABLE public.community_mailer_preflight_runs IS
  'Versioned automated/manual/printer-confirmed production preflight snapshots.';
COMMENT ON TABLE public.community_mailer_exports IS
  'Immutable export manifests linked to a passing preflight snapshot.';
COMMENT ON TABLE public.community_mailer_production_events IS
  'Append-only operational history for Community Mailer production.';

NOTIFY pgrst, 'reload schema';
