-- Business identity is owned by the Business Hub. Smart Cards keep a public
-- projection for fast reads, but profile saves may not diverge from the Hub.

UPDATE public.business_cards AS card
SET
  business_name = business.name,
  phone = business.phone,
  email = business.email,
  website = CASE
    WHEN business.website IS NULL OR business.website = '' THEN NULL
    WHEN business.website ~* '^https?://'
      AND business.website !~ '[[:cntrl:]]'
      AND char_length(business.website) <= 2048
      THEN business.website
    ELSE NULL
  END,
  address = business.address,
  bio = business.description
FROM public.businesses AS business
WHERE card.business_id = business.id
  AND card.owner_user_id = business.owner_user_id
  AND business.name IS NOT NULL
  AND btrim(business.name) <> '';

CREATE OR REPLACE FUNCTION public.adpadz_project_business_hub_to_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  hub public.businesses%ROWTYPE;
BEGIN
  IF NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO hub
  FROM public.businesses AS business
  WHERE business.id = NEW.business_id;

  IF NOT FOUND OR hub.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'Business Profile and Business Hub must have the same owner'
      USING ERRCODE = '42501';
  END IF;

  IF hub.name IS NULL OR btrim(hub.name) = '' THEN
    RAISE EXCEPTION 'Business Hub name must be completed before saving its Business Profile'
      USING ERRCODE = '23514';
  END IF;

  NEW.business_name := hub.name;
  NEW.phone := hub.phone;
  NEW.email := hub.email;
  NEW.website := CASE
    WHEN hub.website IS NULL OR hub.website = '' THEN NULL
    WHEN hub.website ~* '^https?://'
      AND hub.website !~ '[[:cntrl:]]'
      AND char_length(hub.website) <= 2048
      THEN hub.website
    ELSE NULL
  END;
  NEW.address := hub.address;
  NEW.bio := hub.description;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_cards_project_business_hub
  ON public.business_cards;
CREATE TRIGGER business_cards_project_business_hub
  BEFORE INSERT OR UPDATE OF
    business_id,
    owner_user_id,
    business_name,
    phone,
    email,
    website,
    address,
    bio
  ON public.business_cards
  FOR EACH ROW EXECUTE FUNCTION public.adpadz_project_business_hub_to_card();

REVOKE ALL ON FUNCTION public.adpadz_project_business_hub_to_card() FROM PUBLIC;

COMMENT ON FUNCTION public.adpadz_project_business_hub_to_card() IS
  'Keeps the Smart Card public identity projection canonical to its owner Business Hub.';
