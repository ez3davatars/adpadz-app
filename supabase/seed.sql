-- Local-only deterministic launch verification fixtures.
-- These identities and credentials are fictional and must never be used in production.

DO $$
DECLARE
  owner_id constant uuid := '10000000-0000-4000-8000-000000000001';
  admin_id constant uuid := '10000000-0000-4000-8000-000000000002';
  second_id constant uuid := '10000000-0000-4000-8000-000000000003';
  instance_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
    (instance_id, owner_id, 'authenticated', 'authenticated',
      'owner@adpadz-demo.test', extensions.crypt('AdpadzDemo!2026', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"name":"Fictional Business Owner"}', now(), now()),
    (instance_id, admin_id, 'authenticated', 'authenticated',
      'admin@adpadz-demo.test', extensions.crypt('AdpadzDemo!2026', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"name":"Fictional Mission Control Admin"}', now(), now()),
    (instance_id, second_id, 'authenticated', 'authenticated',
      'second-owner@adpadz-demo.test', extensions.crypt('AdpadzDemo!2026', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"name":"Second Fictional Owner"}', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email, encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at, updated_at = now();

  UPDATE auth.users SET confirmation_token='', recovery_token='', email_change='',
    email_change_token_new='', phone_change_token='',
    email_change_token_current='', reauthentication_token=''
  WHERE id IN (owner_id, admin_id, second_id);

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  SELECT id, id, email,
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
    'email', now(), now(), now()
  FROM auth.users WHERE id IN (owner_id, admin_id, second_id)
  ON CONFLICT (provider_id, provider) DO UPDATE
    SET identity_data = excluded.identity_data, updated_at = now();

  INSERT INTO public.admin_users (user_id, role, display_name, active)
  VALUES (admin_id, 'owner', 'Fictional Mission Control Admin', true)
  ON CONFLICT (user_id) DO UPDATE SET role='owner', display_name=excluded.display_name, active=true;
END $$;

INSERT INTO public.businesses
  (id, owner_user_id, name, slug, description, phone, email, website, address, active, category, service_area)
VALUES
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   'Juniper & Finch Workshop','juniper-finch-demo','Fictional neighborhood home-care studio.',
   '555-0100','hello@juniper-finch.test','https://juniper-finch.test','100 Example Lane, Demo City',true,
   'Home Services','Demo City North'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
   'Moonrise Pet Parlour','moonrise-pet-demo','Fictional neighborhood pet-care studio.',
   '555-0200','hello@moonrise-pet.test','https://moonrise-pet.test','200 Sample Street, Demo City',true,
   'Pet Services','Demo City South')
ON CONFLICT (id) DO UPDATE SET name=excluded.name, updated_at=now();

INSERT INTO public.business_cards
  (id, owner_user_id, business_id, business_name, slug, tagline, logo_url, cover_image_url,
   phone, email, website, address, primary_color, accent_color, is_published)
VALUES
  ('21000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001','Juniper & Finch Workshop','juniper-finch-demo-card',
   'Thoughtful care for fictional homes.','http://127.0.0.1:5173/demo/brightline-home.svg','http://127.0.0.1:5173/demo/harbor-hearth.svg',
   '555-0100','hello@juniper-finch.test','https://juniper-finch.test','100 Example Lane, Demo City',
   '#24543b','#76c943',true),
  ('21000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000002','Moonrise Pet Parlour','moonrise-pet-demo-card',
   'Gentle care for imaginary companions.','http://127.0.0.1:5173/demo/paws-polish.svg','http://127.0.0.1:5173/demo/lumen-house.svg',
   '555-0200','hello@moonrise-pet.test','https://moonrise-pet.test','200 Sample Street, Demo City',
   '#24354f','#76c943',true)
ON CONFLICT (id) DO UPDATE SET business_name=excluded.business_name, updated_at=now();

INSERT INTO public.business_marketing_assets
  (id,business_id,smart_card_id,owner_id,asset_type,title,file_url,mime_type,file_size_bytes,is_active)
VALUES
  ('22000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
   '21000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   'image','Juniper logo','http://127.0.0.1:5173/demo/brightline-home.svg','image/svg+xml',2048,true),
  ('22000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',
   '21000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   'image','Summer creative','http://127.0.0.1:5173/demo/harbor-hearth.svg','image/svg+xml',4096,true),
  ('22000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',
   '21000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
   'image','Moonrise creative','http://127.0.0.1:5173/demo/paws-polish.svg','image/svg+xml',4096,true)
ON CONFLICT (id) DO UPDATE SET title=excluded.title, updated_at=now();

INSERT INTO public.campaigns
  (id,business_id,owner_id,title,headline,description,offer_title,offer_description,
   cta_label,cta_url,status,start_date,end_date,primary_image_id)
VALUES
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001','Fictional Summer Refresh',
   'Refresh your home this summer','A complete fictional launch-verification Campaign.',
   'Save on a demo consultation','Fixture-only offer with no monetary value.',
   'View the demo','https://juniper-finch.test/summer','active',now()-interval '2 days',now()+interval '60 days',
   '22000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001','Incomplete Fixture Campaign',
   NULL,'Intentionally incomplete for readiness verification.',NULL,NULL,NULL,NULL,'draft',NULL,NULL,NULL),
  ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000003','Moonrise Welcome',
   'A bright welcome for fictional pets','Tenant-isolation fixture.','First visit welcome',
   'Fixture-only offer.','Meet Moonrise','https://moonrise-pet.test/welcome','active',
   now()-interval '1 day',now()+interval '45 days','22000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001','Archived Winter Fixture',
   'Expired fictional promotion','Archived assignment rejection fixture.',NULL,NULL,'Learn more',
   'https://juniper-finch.test/archive','expired',now()-interval '120 days',now()-interval '60 days',NULL)
ON CONFLICT (id) DO UPDATE SET title=excluded.title, updated_at=now();

INSERT INTO public.campaign_outputs (campaign_id, output_type, enabled, sort_order)
VALUES
  ('30000000-0000-4000-8000-000000000001','qr_landing',true,0),
  ('30000000-0000-4000-8000-000000000003','qr_landing',true,0)
ON CONFLICT (campaign_id, output_type) DO UPDATE SET enabled=true, updated_at=now();

INSERT INTO public.qr_links
  (id,owner_user_id,business_id,title,slug,destination_url,status,purpose,destination_type,destination_id)
VALUES
  ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001','Summer Campaign QR','fixture-summer-campaign',
   'https://juniper-finch.test/summer','active','Community Mailer','campaign',
   '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000002','Moonrise Campaign QR','fixture-moonrise-campaign',
   'https://moonrise-pet.test/welcome','active','Tenant isolation','campaign',
   '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',
   NULL,'Mailer discovery QR','fixture-mailer-discovery','https://adpadz-demo.test/community',
   'active','Mailer discovery','url',NULL)
ON CONFLICT (id) DO UPDATE SET destination_url=excluded.destination_url, updated_at=now();

UPDATE public.campaigns SET primary_qr_id='40000000-0000-4000-8000-000000000001'
WHERE id='30000000-0000-4000-8000-000000000001';

INSERT INTO public.community_cards
  (id,owner_id,title,market_name,zone_name,public_slug,format,layout_key,mailing_date,
   household_count,status,sales_open,is_published,layout_locked,consumer_headline,
   discovery_qr_link_id,created_by,updated_by,layout_revision,front_layout_variant,back_layout_variant)
VALUES
  ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
   'Demo City North 9x12','Demo City','North District','fixture-north-9x12','postcard_9x12',
   'community-appreciation-9x12-row-grid',current_date+30,12500,'review',false,true,true,
   'Discover fictional local favorites','40000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',10,'row_grid','row_grid'),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',
   'Demo City South 6x11','Demo City','South District','fixture-south-6x11','community_card_6x11',
   'community-card-6x11-compact',current_date+45,8000,'review',false,true,true,
   'A blocked fictional production fixture','40000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',20,'compact','compact')
ON CONFLICT (id) DO UPDATE SET title=excluded.title, updated_at=now();

INSERT INTO public.community_card_slots
  (id,community_card_id,slot_key,label,side,template_index,x,y,width,height,price_cents,status,
   advertiser_name,buyer_user_id,business_id,creative_asset_id,qr_link_id,category,is_featured,
   payment_status,proof_status,placement_type,placement_tier,is_locked,public_creative_visible,
   production_status,campaign_id,campaign_assigned_at,campaign_assigned_by)
VALUES
  ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','front-standard','Front standard','front',1,1,1,23,43,25000,'approved',
   'Juniper & Finch','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
   '22000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Home Services',false,
   'paid','approved','standard','standard',true,true,'approved','30000000-0000-4000-8000-000000000001',now(),'10000000-0000-4000-8000-000000000002'),
  ('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','front-combined','Front combined','front',2,25,1,48,43,50000,'approved',
   'Juniper & Finch','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
   '22000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Home Services',false,
   'paid','approved','wide','premium',true,true,'approved','30000000-0000-4000-8000-000000000001',now(),'10000000-0000-4000-8000-000000000002'),
  ('51000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000001','front-featured','Front featured','front',3,1,55,48,43,75000,'approved',
   'Juniper & Finch','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
   '22000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Home Services',true,
   'paid','approved','featured','premium',true,true,'approved','30000000-0000-4000-8000-000000000001',now(),'10000000-0000-4000-8000-000000000002'),
  ('51000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001','back-available','Back available','back',2,51,55,23,43,25000,'available',
   NULL,NULL,NULL,NULL,NULL,NULL,false,'not_started','not_started','standard','standard',true,false,'not_started',NULL,NULL,NULL),
  ('52000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','front-blocked','Blocked placement','front',1,2,2,46,42,25000,'reserved',
   'Juniper & Finch','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
   '22000000-0000-4000-8000-000000000002',NULL,'Home Services',false,
   'not_started','changes_requested','standard','standard',true,false,'creative_needed',NULL,NULL,NULL),
  ('52000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','back-available','Back available','back',1,52,56,46,42,25000,'available',
   NULL,NULL,NULL,NULL,NULL,NULL,false,'not_started','not_started','standard','standard',true,false,'not_started',NULL,NULL,NULL)
ON CONFLICT (id) DO UPDATE SET label=excluded.label, updated_at=now();

INSERT INTO public.community_card_orders
  (id,community_card_id,buyer_user_id,slot_ids,quantity,amount_cents,status)
VALUES
  ('53000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   ARRAY['51000000-0000-4000-8000-000000000001'::uuid],1,25000,'paid'),
  ('53000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001',
   ARRAY['52000000-0000-4000-8000-000000000001'::uuid],1,25000,'pending_payment')
ON CONFLICT (id) DO UPDATE SET status=excluded.status, updated_at=now();

UPDATE public.community_cards SET
  layout_revision=10, production_version=1, layout_locked=true
WHERE id='50000000-0000-4000-8000-000000000001';

UPDATE public.community_cards SET
  postal_area_confirmed=true, printer_specs_confirmed=true, color_profile_confirmed=true,
  postal_area_confirmation_revision=10, printer_specs_confirmation_revision=10,
  color_profile_confirmation_revision=10,
  preflight_fingerprint='cm-10-abcdef12', preflight_layout_revision=10,
  preflight_completed_at=now()
WHERE id='50000000-0000-4000-8000-000000000001';

INSERT INTO public.community_mailer_preflight_runs
  (id,community_card_id,production_version,layout_revision,fingerprint,passed,
   blocking_count,warning_count,checks,created_by)
VALUES
  ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
   1,10,'cm-10-abcdef12',true,0,0,'[{"key":"fixture","status":"pass"}]',
   '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',
   1,19,'cm-19-deadbeef',false,4,0,'[{"key":"campaign","status":"block"}]',
   '10000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('adpadz.community_mailer_status_transition','allowed',true);
UPDATE public.community_cards SET status='ready_for_print'
WHERE id='50000000-0000-4000-8000-000000000001';

-- Historical stale candidate metadata for blocked Mailer B. It is revision-bound
-- and intentionally has no current Storage objects.
INSERT INTO public.community_mailer_exports
  (id,community_card_id,preflight_run_id,production_version,layout_revision,fingerprint,
   manifest,created_by,export_kind,checksum,storage_prefix,byte_size,generator_version)
VALUES
  ('61000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',
   '60000000-0000-4000-8000-000000000002',1,19,'cm-19-deadbeef',
   '{"fixture":true,"state":"stale"}','10000000-0000-4000-8000-000000000002',
   'production_candidate','fixture-stale-checksum',
   'community-mailers/50000000-0000-4000-8000-000000000002/revisions/19/production-candidate/1',
   1024,'fixture-seed-v1')
ON CONFLICT (id) DO NOTHING;
