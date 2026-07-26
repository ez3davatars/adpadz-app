-- `now()` is fixed for an entire transaction. Wall-clock timestamps keep
-- retention order deterministic if multiple authorized saves are exercised in
-- a single transaction (for example, retention verification or future batch
-- recovery tooling).

ALTER TABLE public.campaign_creative_versions
  ALTER COLUMN created_at SET DEFAULT clock_timestamp();
