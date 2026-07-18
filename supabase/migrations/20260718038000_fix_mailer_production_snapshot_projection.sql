CREATE OR REPLACE FUNCTION public.get_admin_community_mailer_production(
  p_mailer_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN public.is_adpadz_admin(auth.uid()) THEN jsonb_build_object(
    'current_preflight_run_id', (
      SELECT run.id FROM public.community_mailer_preflight_runs AS run
      JOIN public.community_cards AS card ON card.id = run.community_card_id
      WHERE run.community_card_id = p_mailer_id
        AND run.layout_revision = card.layout_revision
        AND run.fingerprint = card.preflight_fingerprint
        AND run.passed IS TRUE
      ORDER BY run.created_at DESC LIMIT 1
    ),
    'snapshots', COALESCE((
      SELECT jsonb_agg(to_jsonb(snapshot_row) ORDER BY snapshot_row.placement_id)
      FROM public.community_mailer_production_snapshots AS snapshot_row
      WHERE snapshot_row.community_card_id = p_mailer_id
    ), '[]'::jsonb),
    'qr_associations', COALESCE((
      SELECT jsonb_agg(to_jsonb(association_row) ORDER BY association_row.placement_id)
      FROM public.community_mailer_qr_associations AS association_row
      WHERE association_row.community_card_id = p_mailer_id
    ), '[]'::jsonb),
    'exports', COALESCE((
      SELECT jsonb_agg(to_jsonb(export_row) ORDER BY export_row.created_at DESC)
      FROM public.community_mailer_exports AS export_row
      WHERE export_row.community_card_id = p_mailer_id
    ), '[]'::jsonb)
  ) ELSE NULL END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_community_mailer_production(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_community_mailer_production(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
