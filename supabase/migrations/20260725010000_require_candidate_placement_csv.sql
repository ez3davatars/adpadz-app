-- RC1 contract correction: the production specification requires a placement CSV.
-- Keep the ten-file package stable while replacing the JSON placement manifest.

CREATE OR REPLACE FUNCTION public.finalize_admin_community_mailer_candidate(
  p_mailer_id uuid,
  p_preflight_run_id uuid,
  p_storage_prefix text,
  p_manifest jsonb,
  p_checksum text,
  p_generator_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $$
DECLARE
  card public.community_cards%ROWTYPE;
  export_id uuid;
  total_bytes bigint;
  required_count integer;
  expected_prefix text;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO card FROM public.community_cards
  WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community Mailer not found.'; END IF;
  expected_prefix := 'community-mailers/' || card.id::text ||
    '/revisions/' || card.layout_revision::text || '/production-candidate/';
  IF p_storage_prefix <> expected_prefix
     OR p_checksum !~ '^[0-9a-f]{64}$'
     OR NULLIF(btrim(p_generator_version), '') IS NULL
     OR p_manifest->>'preflightFingerprint' IS DISTINCT FROM
       card.preflight_fingerprint
  THEN RAISE EXCEPTION 'Candidate metadata does not match the current revision.'; END IF;
  IF card.layout_locked IS NOT TRUE
     OR card.preflight_layout_revision IS DISTINCT FROM card.layout_revision
     OR NOT EXISTS (
       SELECT 1 FROM public.community_mailer_preflight_runs AS run
       WHERE run.id = p_preflight_run_id
         AND run.community_card_id = card.id
         AND run.layout_revision = card.layout_revision
         AND run.passed IS TRUE
         AND run.fingerprint = card.preflight_fingerprint
     ) THEN RAISE EXCEPTION 'A current passing preflight is required.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_card_slots AS slot
    WHERE slot.community_card_id = card.id
      AND slot.status NOT IN ('available','unavailable')
      AND (
        slot.campaign_id IS NULL OR
        NOT EXISTS (
          SELECT 1 FROM public.community_mailer_production_snapshots AS snapshot
          WHERE snapshot.placement_id = slot.id
            AND snapshot.layout_revision = card.layout_revision
            AND snapshot.campaign_id = slot.campaign_id
        ) OR NOT EXISTS (
          SELECT 1 FROM public.community_mailer_qr_associations AS association
          WHERE association.placement_id = slot.id
            AND association.layout_revision = card.layout_revision
            AND association.campaign_id = slot.campaign_id
            AND association.qr_link_id = slot.qr_link_id
            AND association.active IS TRUE
        )
      )
  ) THEN RAISE EXCEPTION 'Campaign snapshot or QR association is incomplete.'; END IF;
  SELECT count(*), COALESCE(sum((metadata->>'size')::bigint), 0)
  INTO required_count, total_bytes
  FROM storage.objects
  WHERE bucket_id = 'community-mailer-production'
    AND name IN (
      expected_prefix || 'front.pdf',
      expected_prefix || 'back.pdf',
      expected_prefix || 'front.png',
      expected_prefix || 'back.png',
      expected_prefix || 'production-manifest.json',
      expected_prefix || 'placement-manifest.csv',
      expected_prefix || 'advertiser-manifest.csv',
      expected_prefix || 'qr-manifest.json',
      expected_prefix || 'preflight-report.json',
      expected_prefix || 'confirmation-record.json'
    );
  IF required_count <> 10 OR total_bytes <= 0 THEN
    RAISE EXCEPTION 'The complete stored Production Candidate package is required.';
  END IF;
  INSERT INTO public.community_mailer_exports (
    community_card_id, preflight_run_id, production_version, layout_revision,
    fingerprint, manifest, export_kind, checksum, storage_prefix, byte_size,
    generator_version, created_by
  ) VALUES (
    card.id, p_preflight_run_id, card.production_version, card.layout_revision,
    card.preflight_fingerprint, p_manifest, 'production_candidate', p_checksum,
    expected_prefix, total_bytes, btrim(p_generator_version), auth.uid()
  ) RETURNING id INTO export_id;
  RETURN export_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_admin_community_mailer_candidate(
  uuid,uuid,text,jsonb,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_admin_community_mailer_candidate(
  uuid,uuid,text,jsonb,text,text
) TO authenticated;

NOTIFY pgrst, 'reload schema';