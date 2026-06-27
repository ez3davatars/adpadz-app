-- Adpadz hosted QR redirect RPC
-- Resolves one public QR slug, logs the scan, and returns only redirect status/data.

CREATE OR REPLACE FUNCTION public.resolve_qr_redirect(
  p_slug text,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.qr_links%ROWTYPE;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;

  SELECT *
  INTO v_link
  FROM public.qr_links
  WHERE slug = lower(p_slug)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;

  IF v_link.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'inactive');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'status', 'expired');
  END IF;

  INSERT INTO public.qr_scan_events (
    qr_link_id,
    user_agent,
    referrer,
    metadata
  ) VALUES (
    v_link.id,
    p_user_agent,
    p_referrer,
    jsonb_build_object(
      'source', 'php_redirect',
      'slug', v_link.slug
    )
  );

  -- The qr_scan_events_increment_count trigger maintained by the QR Studio
  -- migration increments qr_links.scan_count after the scan event insert.

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ok',
    'destination_url', v_link.destination_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_qr_redirect(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_qr_redirect(text, text, text) TO anon, authenticated;