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
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_confirmation NOT IN (
    'postal_area_confirmed','printer_specs_confirmed','color_profile_confirmed'
  ) THEN
    RAISE EXCEPTION 'Unsupported preflight confirmation.';
  END IF;
  UPDATE public.community_cards SET
    postal_area_confirmed = CASE WHEN p_confirmation = 'postal_area_confirmed'
      THEN p_confirmed ELSE postal_area_confirmed END,
    printer_specs_confirmed = CASE WHEN p_confirmation = 'printer_specs_confirmed'
      THEN p_confirmed ELSE printer_specs_confirmed END,
    color_profile_confirmed = CASE WHEN p_confirmation = 'color_profile_confirmed'
      THEN p_confirmed ELSE color_profile_confirmed END,
    preflight_fingerprint = NULL,
    preflight_layout_revision = NULL,
    preflight_completed_at = NULL
  WHERE id = p_mailer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_admin_community_mailer_preflight(
  uuid,text,boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_admin_community_mailer_preflight(
  uuid,text,boolean
) TO authenticated;

NOTIFY pgrst, 'reload schema';
