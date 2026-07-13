-- Adpadz legacy local-business foundation.
--
-- The next historical migration tightens policies on these tables, but the
-- original project history never created them.  Keep this migration additive
-- so a clean database can replay the history and an older production database
-- can adopt it without replacing existing columns or data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  phone text,
  email text,
  website text,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text,
  session_id text,
  user_agent text,
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text,
  phone text,
  email text,
  message text,
  source text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'new',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  code text,
  claim_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  customer_email text,
  customer_phone text,
  redemption_code text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CREATE TABLE IF NOT EXISTS does not add missing columns to a pre-existing
-- relation.  Add the contract required by the following migrations without
-- altering the type or nullability of any production column that already
-- exists.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS business_id uuid,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS business_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS business_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS claim_url text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS business_id uuid,
  ADD COLUMN IF NOT EXISTS offer_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS redemption_code text,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Older installations sometimes called the business owner owner_id or
-- user_id.  Copy only UUID-shaped ownership columns and only into empty slots.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'owner_id'
      AND udt_name = 'uuid'
  ) THEN
    EXECUTE 'UPDATE public.businesses SET owner_user_id = owner_id WHERE owner_user_id IS NULL AND owner_id IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'user_id'
      AND udt_name = 'uuid'
  ) THEN
    EXECUTE 'UPDATE public.businesses SET owner_user_id = user_id WHERE owner_user_id IS NULL AND user_id IS NOT NULL';
  END IF;
END $$;

-- NOT VALID preserves historical rows while enforcing each relationship for
-- new writes.  Each add is isolated so an unusual legacy key/type does not
-- prevent the rest of the foundation from being installed.
DO $$
DECLARE
  relation_name text;
  constraint_name text;
  constraint_sql text;
BEGIN
  FOR relation_name, constraint_name, constraint_sql IN
    SELECT *
    FROM (VALUES
      ('businesses', 'businesses_owner_user_id_fkey',
        'FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID'),
      ('analytics_events', 'analytics_events_business_id_fkey',
        'FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE NOT VALID'),
      ('leads', 'leads_business_id_fkey',
        'FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE NOT VALID'),
      ('offers', 'offers_business_id_fkey',
        'FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE NOT VALID'),
      ('redemptions', 'redemptions_business_id_fkey',
        'FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE NOT VALID'),
      ('redemptions', 'redemptions_offer_id_fkey',
        'FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE CASCADE NOT VALID')
    ) AS relationships(relation_name, constraint_name, constraint_sql)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format('public.%I', relation_name)::regclass
        AND conname = constraint_name
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I %s',
          relation_name,
          constraint_name,
          constraint_sql
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped legacy constraint %: %', constraint_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS businesses_owner_user_id_idx
  ON public.businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS businesses_active_idx
  ON public.businesses(active);
CREATE INDEX IF NOT EXISTS analytics_events_business_time_idx
  ON public.analytics_events(business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS leads_business_status_created_idx
  ON public.leads(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS offers_business_active_window_idx
  ON public.offers(business_id, active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS redemptions_business_created_idx
  ON public.redemptions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS redemptions_offer_created_idx
  ON public.redemptions(offer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.legacy_core_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  relation_name text;
  trigger_name text;
BEGIN
  FOR relation_name, trigger_name IN
    SELECT *
    FROM (VALUES
      ('businesses', 'businesses_set_updated_at'),
      ('analytics_events', 'analytics_events_set_updated_at'),
      ('leads', 'leads_set_updated_at'),
      ('offers', 'offers_set_updated_at'),
      ('redemptions', 'redemptions_set_updated_at')
    ) AS trigger_rows(relation_name, trigger_name)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, relation_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.legacy_core_set_updated_at()',
      trigger_name,
      relation_name
    );
  END LOOP;
END $$;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses_owner_select" ON public.businesses;
CREATE POLICY "businesses_owner_select" ON public.businesses
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "businesses_public_read_active" ON public.businesses;
CREATE POLICY "businesses_public_read_active" ON public.businesses
  FOR SELECT TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "businesses_owner_insert" ON public.businesses;
CREATE POLICY "businesses_owner_insert" ON public.businesses
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "businesses_owner_update" ON public.businesses;
CREATE POLICY "businesses_owner_update" ON public.businesses
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "businesses_owner_delete" ON public.businesses;
CREATE POLICY "businesses_owner_delete" ON public.businesses
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "analytics_insert_anon" ON public.analytics_events;
CREATE POLICY "analytics_insert_anon" ON public.analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = analytics_events.business_id
        AND businesses.active IS TRUE
    )
  );

DROP POLICY IF EXISTS "analytics_events_owner_select" ON public.analytics_events;
CREATE POLICY "analytics_events_owner_select" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = analytics_events.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_insert_anon" ON public.leads;
CREATE POLICY "leads_insert_anon" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = leads.business_id
        AND businesses.active IS TRUE
    )
  );

DROP POLICY IF EXISTS "leads_owner_select" ON public.leads;
CREATE POLICY "leads_owner_select" ON public.leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = leads.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_owner_update" ON public.leads;
CREATE POLICY "leads_owner_update" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = leads.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = leads.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_owner_delete" ON public.leads;
CREATE POLICY "leads_owner_delete" ON public.leads
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = leads.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_public_read_active" ON public.offers;
CREATE POLICY "offers_public_read_active" ON public.offers
  FOR SELECT TO anon, authenticated
  USING (
    active IS TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = offers.business_id
        AND businesses.active IS TRUE
    )
  );

DROP POLICY IF EXISTS "offers_owner_select" ON public.offers;
CREATE POLICY "offers_owner_select" ON public.offers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = offers.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_owner_insert" ON public.offers;
CREATE POLICY "offers_owner_insert" ON public.offers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = offers.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_owner_update" ON public.offers;
CREATE POLICY "offers_owner_update" ON public.offers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = offers.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = offers.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_owner_delete" ON public.offers;
CREATE POLICY "offers_owner_delete" ON public.offers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = offers.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "redemptions_insert_anon" ON public.redemptions;
CREATE POLICY "redemptions_insert_anon" ON public.redemptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.offers
      WHERE offers.id = redemptions.offer_id
        AND offers.business_id = redemptions.business_id
        AND offers.active IS TRUE
        AND (offers.starts_at IS NULL OR offers.starts_at <= now())
        AND (offers.ends_at IS NULL OR offers.ends_at >= now())
    )
  );

DROP POLICY IF EXISTS "redemptions_owner_select" ON public.redemptions;
CREATE POLICY "redemptions_owner_select" ON public.redemptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = redemptions.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "redemptions_owner_update" ON public.redemptions;
CREATE POLICY "redemptions_owner_update" ON public.redemptions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = redemptions.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = redemptions.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

GRANT SELECT ON public.businesses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.leads TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT ON public.offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT INSERT ON public.redemptions TO anon, authenticated;
GRANT SELECT, UPDATE ON public.redemptions TO authenticated;
