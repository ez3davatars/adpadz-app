-- Remove an ambiguous PL/pgSQL identifier found by `supabase db lint`.

CREATE OR REPLACE FUNCTION public.save_admin_community_mailer_layout(
  p_mailer_id uuid, p_placements jsonb, p_expected_revision bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  placement_payload jsonb;
  current_slot public.community_card_slots%ROWTYPE;
  current_revision bigint;
  mailer_locked boolean;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.' USING ERRCODE = '42501';
  END IF;
  SELECT layout_locked, layout_revision INTO mailer_locked, current_revision
  FROM public.community_cards WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002'; END IF;
  IF mailer_locked THEN RAISE EXCEPTION 'Unlock the layout before changing geometry.'; END IF;
  IF p_expected_revision IS NOT NULL AND p_expected_revision <> current_revision THEN
    RAISE EXCEPTION 'This layout changed in another session. Refresh before saving.' USING ERRCODE = '40001';
  END IF;
  IF p_placements IS NULL OR jsonb_typeof(p_placements) <> 'array' OR (
    SELECT count(*) <> count(DISTINCT payload.value->>'id')
    FROM jsonb_array_elements(p_placements) AS payload(value)
  ) THEN
    RAISE EXCEPTION 'Layout updates must contain unique placement IDs.';
  END IF;
  FOR placement_payload IN SELECT payload.value FROM jsonb_array_elements(p_placements) AS payload(value)
  LOOP
    SELECT * INTO current_slot FROM public.community_card_slots
    WHERE id = (placement_payload->>'id')::uuid AND community_card_id = p_mailer_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Placement belongs to another mailer or no longer exists.'; END IF;
    IF current_slot.is_locked AND (
      current_slot.side IS DISTINCT FROM placement_payload->>'side'
      OR current_slot.x IS DISTINCT FROM (placement_payload->>'x')::numeric
      OR current_slot.y IS DISTINCT FROM (placement_payload->>'y')::numeric
      OR current_slot.width IS DISTINCT FROM (placement_payload->>'width')::numeric
      OR current_slot.height IS DISTINCT FROM (placement_payload->>'height')::numeric
      OR current_slot.z_index IS DISTINCT FROM (placement_payload->>'z_index')::integer
    ) THEN
      RAISE EXCEPTION 'Unlock the placement before changing its geometry.';
    END IF;
    IF NOT current_slot.is_locked THEN
      UPDATE public.community_card_slots SET
        side = placement_payload->>'side', x = (placement_payload->>'x')::numeric,
        y = (placement_payload->>'y')::numeric, width = (placement_payload->>'width')::numeric,
        height = (placement_payload->>'height')::numeric,
        z_index = COALESCE((placement_payload->>'z_index')::integer, z_index)
      WHERE id = current_slot.id;
    END IF;
  END LOOP;
  PERFORM public.assert_community_mailer_layout(p_mailer_id);
  UPDATE public.community_cards
  SET layout_revision = layout_revision + 1, updated_by = auth.uid(), updated_at = now()
  WHERE id = p_mailer_id RETURNING layout_revision INTO current_revision;
  RETURN current_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.save_admin_community_mailer_layout(uuid,jsonb,bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_community_mailer_layout(uuid,jsonb,bigint)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
