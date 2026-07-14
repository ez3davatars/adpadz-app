-- Adpadz Mission Control: Phase 1 authorization and read-only dashboard data.
--
-- Cross-tenant operational data is intentionally available only through the
-- two sanitized SECURITY DEFINER RPCs below. No admin bypass policies are
-- added to customer-owned tables.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_role_check
    CHECK (role IN ('owner', 'admin', 'sales', 'creative', 'finance', 'support')),
  CONSTRAINT admin_users_display_name_not_blank
    CHECK (btrim(display_name) <> '')
);

-- The incomplete, undeployed predecessor used permissive defaults. Keep this
-- migration fail-closed even if its table definition was applied manually.
ALTER TABLE public.admin_users
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN active SET DEFAULT false,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- Re-assert the checks by name so a manually applied copy of the earlier
-- table-only draft cannot retain a weaker definition.
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check,
  DROP CONSTRAINT IF EXISTS admin_users_display_name_not_blank;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('owner', 'admin', 'sales', 'creative', 'finance', 'support')),
  ADD CONSTRAINT admin_users_display_name_not_blank
    CHECK (btrim(display_name) <> '');

CREATE INDEX IF NOT EXISTS admin_users_active_role_idx
  ON public.admin_users(active, role);

CREATE OR REPLACE FUNCTION public.adpadz_admin_users_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON public.admin_users;
CREATE TRIGGER admin_users_set_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_admin_users_set_updated_at();

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

DROP POLICY IF EXISTS admin_users_self_select ON public.admin_users;
CREATE POLICY admin_users_self_select ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND active IS TRUE
    AND role IN ('owner', 'admin', 'sales', 'creative', 'finance', 'support')
  );

-- This helper cannot be used to enumerate other accounts: callers may only
-- check the identity represented by their own verified JWT.
CREATE OR REPLACE FUNCTION public.is_adpadz_admin(
  check_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    check_user_id IS NOT NULL
    AND check_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.admin_users AS admin_user
      WHERE admin_user.user_id = check_user_id
        AND admin_user.active IS TRUE
        AND admin_user.role IN (
          'owner', 'admin', 'sales', 'creative', 'finance', 'support'
        )
    );
$$;

-- A single, sanitized metrics row. Each non-NULL value is a real database
-- count; a genuine empty result is returned as zero, while a failed source
-- query is returned as NULL for an honest partial-data state.
CREATE OR REPLACE FUNCTION public.get_adpadz_admin_dashboard_metrics()
RETURNS TABLE (
  active_businesses bigint,
  total_campaigns bigint,
  active_campaigns bigint,
  draft_campaigns bigint,
  campaigns_without_dates bigint,
  total_leads bigint,
  new_leads bigint,
  total_qr_scans bigint,
  published_profiles bigint,
  businesses_without_published_profiles bigint,
  community_mailers bigint,
  available_placements bigint,
  reserved_placements bigint,
  sold_placements bigint,
  community_mailers_with_open_placements bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_adpadz_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Adpadz administrator access required.'
      USING ERRCODE = '42501';
  END IF;

  -- Isolate source queries so one unavailable operational source becomes a
  -- NULL metric instead of erasing otherwise valid dashboard counts.
  BEGIN
    SELECT count(*) INTO active_businesses
    FROM public.businesses AS business
    WHERE business.active IS TRUE;
  EXCEPTION WHEN OTHERS THEN
    active_businesses := NULL;
  END;

  BEGIN
    SELECT count(*) INTO total_campaigns FROM public.campaigns;
  EXCEPTION WHEN OTHERS THEN
    total_campaigns := NULL;
  END;

  BEGIN
    SELECT count(*) INTO active_campaigns
    FROM public.campaigns AS campaign
    WHERE campaign.status = 'active';
  EXCEPTION WHEN OTHERS THEN
    active_campaigns := NULL;
  END;

  BEGIN
    SELECT count(*) INTO draft_campaigns
    FROM public.campaigns AS campaign
    WHERE campaign.status = 'draft';
  EXCEPTION WHEN OTHERS THEN
    draft_campaigns := NULL;
  END;

  BEGIN
    SELECT count(*) INTO campaigns_without_dates
    FROM public.campaigns AS campaign
    WHERE campaign.start_date IS NULL OR campaign.end_date IS NULL;
  EXCEPTION WHEN OTHERS THEN
    campaigns_without_dates := NULL;
  END;

  BEGIN
    SELECT count(*) INTO total_leads FROM public.business_card_leads;
  EXCEPTION WHEN OTHERS THEN
    total_leads := NULL;
  END;

  BEGIN
    SELECT count(*) INTO new_leads
    FROM public.business_card_leads AS lead
    WHERE lead.status = 'new';
  EXCEPTION WHEN OTHERS THEN
    new_leads := NULL;
  END;

  BEGIN
    SELECT count(*) INTO total_qr_scans FROM public.qr_scan_events;
  EXCEPTION WHEN OTHERS THEN
    total_qr_scans := NULL;
  END;

  -- Keep this in lockstep with adpadz_business_card_is_public(uuid): a
  -- published profile is public only on its owner's active Business Hub.
  BEGIN
    SELECT count(*) INTO published_profiles
    FROM public.business_cards AS card
    JOIN public.businesses AS business
      ON business.id = card.business_id
     AND business.owner_user_id = card.owner_user_id
    WHERE card.is_published IS TRUE
      AND card.business_id IS NOT NULL
      AND business.active IS TRUE;
  EXCEPTION WHEN OTHERS THEN
    published_profiles := NULL;
  END;

  BEGIN
    SELECT count(*) INTO businesses_without_published_profiles
    FROM public.businesses AS business
    WHERE business.active IS TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_cards AS card
        WHERE card.business_id = business.id
          AND card.owner_user_id = business.owner_user_id
          AND card.is_published IS TRUE
      );
  EXCEPTION WHEN OTHERS THEN
    businesses_without_published_profiles := NULL;
  END;

  BEGIN
    SELECT count(*) INTO community_mailers FROM public.community_cards;
  EXCEPTION WHEN OTHERS THEN
    community_mailers := NULL;
  END;

  BEGIN
    SELECT count(*) INTO available_placements
    FROM public.community_card_slots AS slot
    WHERE slot.status = 'available';
  EXCEPTION WHEN OTHERS THEN
    available_placements := NULL;
  END;

  BEGIN
    SELECT count(*) INTO reserved_placements
    FROM public.community_card_slots AS slot
    WHERE slot.status = 'reserved';
  EXCEPTION WHEN OTHERS THEN
    reserved_placements := NULL;
  END;

  BEGIN
    SELECT count(*) INTO sold_placements
    FROM public.community_card_slots AS slot
    WHERE slot.status = 'sold';
  EXCEPTION WHEN OTHERS THEN
    sold_placements := NULL;
  END;

  BEGIN
    SELECT count(*) INTO community_mailers_with_open_placements
    FROM public.community_cards AS community_card
    WHERE community_card.is_published IS TRUE
      AND community_card.sales_open IS TRUE
      AND EXISTS (
        SELECT 1
        FROM public.community_card_slots AS slot
        WHERE slot.community_card_id = community_card.id
          AND slot.status = 'available'
      );
  EXCEPTION WHEN OTHERS THEN
    community_mailers_with_open_placements := NULL;
  END;

  RETURN NEXT;
END;
$$;

-- Recent activity intentionally omits contact details, QR metadata, URLs,
-- owner ids, and other tenant/private fields. limit_count is bounded to keep
-- the endpoint predictable even if a client supplies an extreme value.
CREATE OR REPLACE FUNCTION public.get_adpadz_admin_recent_activity(
  limit_count integer DEFAULT 20
)
RETURNS TABLE (
  id text,
  source text,
  kind text,
  title text,
  detail text,
  occurred_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(limit_count, 20), 1), 100);
BEGIN
  IF NOT public.is_adpadz_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Adpadz administrator access required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT activity.id,
         activity.source,
         activity.kind,
         activity.title,
         activity.detail,
         activity.occurred_at
  FROM (
    SELECT business.id::text AS id,
           'business'::text AS source,
           'business_created'::text AS kind,
           COALESCE(NULLIF(btrim(business.name), ''), 'Untitled business') AS title,
           CASE WHEN business.active
             THEN 'Active business'
             ELSE 'Inactive business'
           END::text AS detail,
           business.created_at AS occurred_at
    FROM public.businesses AS business

    UNION ALL

    SELECT campaign.id::text,
           'campaign'::text,
           'campaign_updated'::text,
           COALESCE(NULLIF(btrim(campaign.title), ''), 'Untitled campaign'),
           ('Status: ' || campaign.status)::text,
           campaign.updated_at
    FROM public.campaigns AS campaign

    UNION ALL

    SELECT lead.id::text,
           'lead'::text,
           'lead_captured'::text,
           'Business lead captured'::text,
           ('Status: ' || lead.status)::text,
           lead.created_at
    FROM public.business_card_leads AS lead

    UNION ALL

    SELECT scan.id::text,
           'qr'::text,
           'qr_scan'::text,
           'QR code scanned'::text,
           'QR activity recorded'::text,
           scan.scanned_at
    FROM public.qr_scan_events AS scan
  ) AS activity
  ORDER BY activity.occurred_at DESC, activity.source, activity.id
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.adpadz_admin_users_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_adpadz_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_adpadz_admin_dashboard_metrics() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_adpadz_admin_recent_activity(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_adpadz_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_adpadz_admin_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_adpadz_admin_recent_activity(integer) TO authenticated;

COMMENT ON TABLE public.admin_users IS
  'Manually bootstrapped internal Mission Control identities and roles.';
COMMENT ON FUNCTION public.is_adpadz_admin(uuid) IS
  'Fail-closed check for the current authenticated user active Mission Control membership.';
COMMENT ON FUNCTION public.get_adpadz_admin_dashboard_metrics() IS
  'Sanitized cross-tenant operational counts for active Mission Control administrators.';
COMMENT ON FUNCTION public.get_adpadz_admin_recent_activity(integer) IS
  'Sanitized cross-tenant operational activity for active Mission Control administrators.';
