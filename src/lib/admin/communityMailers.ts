import { supabase } from "../supabase";
import type {
  CommunityCardFormat,
  CommunityCardLayout,
  CommunityCardRecord,
  CommunityCardStatus,
  CommunityMailerRowPattern,
} from "../communityCards";
import type { LayoutPlacement, PlacementType } from "../communityMailerLayout";

export type AdminMailerSummary = {
  id: string;
  title: string;
  zone_name: string | null;
  public_slug: string;
  format: CommunityCardFormat;
  mailing_date: string | null;
  household_count: number | null;
  status: string;
  sales_open: boolean;
  is_published: boolean;
  updated_at: string;
  total_placements: number;
  available_placements: number;
  held_placements: number;
  sold_placements: number;
  creative_ready: number;
  payments_ready: number;
  proofs_ready: number;
  booked_revenue_cents: number;
  attention_count: number;
};
export type AdminPlacement = LayoutPlacement & {
  business_id: string | null;
  campaign_id: string | null;
  campaign_assigned_at?: string | null;
  business_name: string | null;
  creative_asset_id: string | null;
  creative_asset_title: string | null;
  creative_asset_url: string | null;
  offer_text: string | null;
  category: string | null;
  internal_notes: string | null;
  payment_status: string;
  proof_status: string;
  production_status: string;
  qr_link_id: string | null;
  qr_title: string | null;
  qr_destination_url: string | null;
  public_creative_visible: boolean;
};
export type AdminMailerRecord = Omit<CommunityCardRecord, "owner_id"> & {
  layout_locked: boolean;
  layout_revision: number;
  front_layout_variant:
    | "legacy_freeform"
    | "double_top"
    | "double_bottom"
    | "row_grid"
    | "compact";
  back_layout_variant:
    | "legacy_freeform"
    | "double_top"
    | "double_bottom"
    | "row_grid"
    | "compact";
  front_top_pattern: CommunityMailerRowPattern | null;
  front_bottom_pattern: CommunityMailerRowPattern | null;
  back_top_pattern: CommunityMailerRowPattern | null;
  back_bottom_pattern: CommunityMailerRowPattern | null;
  consumer_headline: string | null;
  discovery_qr_link_id: string | null;
  discovery_qr_destination_url?: string | null;
  postal_area_confirmed: boolean;
  printer_specs_confirmed: boolean;
  color_profile_confirmed: boolean;
  preflight_fingerprint: string | null;
  preflight_layout_revision: number | null;
  production_version: number;
};
export type AdminMailerCampaign = { id: string; business_id: string; title: string; status: string; updated_at: string };
export type AdminMailerProduction = {
  current_preflight_run_id: string | null;
  snapshots: Array<{
    placement_id: string;
    layout_revision: number;
    campaign_id: string;
    creative_version_id: string | null;
    fingerprint: string;
    snapshot: Record<string, unknown>;
  }>;
  qr_associations: Array<
    Record<string, unknown> & {
      placement_id: string;
      layout_revision: number;
    }
  >;
  exports: Array<Record<string, unknown>>;
};
export type AdminMailerDetail = {
  mailer: AdminMailerRecord;
  placements: AdminPlacement[];
  businesses: Array<{ id: string; name: string }>;
  assets: Array<
    {
      id: string;
      business_id: string | null;
  campaign_id: string | null;
  campaign_assigned_at?: string | null;
      title: string;
      url: string | null;
    }
  >;
  campaigns: AdminMailerCampaign[];
  production: AdminMailerProduction;
  qr_links: Array<
    {
      id: string;
      business_id: string | null;
  campaign_id: string | null;
  campaign_assigned_at?: string | null;
      title: string;
      destination_url: string;
    }
  >;
};
export type BusinessCommunityCampaign = {
  id: string;
  title: string;
  zone_name: string | null;
  public_slug: string;
  mailing_date: string | null;
  household_count: number | null;
  format: CommunityCardFormat;
  layout_key: string;
  status: CommunityCardStatus;
  sales_open: boolean;
  is_published: boolean;
  consumer_headline: string | null;
  discovery_qr_destination_url: string | null;
  available_placements: number;
  layout_placements: LayoutPlacement[];
  own_placements: Array<
    {
      id: string;
      label: string;
      status: string;
      artwork_url: string | null;
      offer: string | null;
      proof_status: string;
      payment_status: string;
      production_status: string;
      qr_destination_url: string | null;
    }
  >;
};
export const getAdminMailers = () =>
  supabase.rpc("get_admin_community_mailers");
export const getAdminMailer = async (id: string) => {
  const [detail, campaigns, production] = await Promise.all([
    supabase.rpc("get_admin_community_mailer", { p_mailer_id: id }),
    supabase.rpc("get_admin_community_mailer_campaigns", { p_mailer_id: id }),
    supabase.rpc("get_admin_community_mailer_production", { p_mailer_id: id }),
  ]);
  const error = detail.error || campaigns.error || production.error;
  return { data: error ? null : { ...(detail.data as object), campaigns: campaigns.data || [], production: production.data || { current_preflight_run_id: null, snapshots: [], qr_associations: [], exports: [] } }, error };
};
export const createAdminMailer = (
  input: {
    title: string;
    zoneName: string;
    format: CommunityCardFormat;
    layout: CommunityCardLayout;
    householdCount: number | null;
    mailingDate: string | null;
  },
) =>
  supabase.rpc("create_admin_community_mailer", {
    p_title: input.title,
    p_zone_name: input.zoneName,
    p_format: input.format,
    p_layout_key: input.layout.key,
    p_household_count: input.householdCount,
    p_mailing_date: input.mailingDate,
    p_slots: input.layout.slots,
  });
export const updateAdminMailer = (
  id: string,
  changes: Record<string, unknown>,
) =>
  supabase.rpc("update_admin_community_mailer", {
    p_mailer_id: id,
    p_changes: changes,
  });
export const updateAdminPlacement = (
  id: string,
  changes: Record<string, unknown>,
) =>
  supabase.rpc("update_admin_community_placement", {
    p_placement_id: id,
    p_changes: changes,
  });
export const saveAdminMailerLayout = (
  id: string,
  placements: LayoutPlacement[],
  revision: number,
) =>
  supabase.rpc("save_admin_community_mailer_layout", {
    p_mailer_id: id,
    p_placements: placements.map((
      { id: placementId, side, x, y, width, height, z_index },
    ) => ({ id: placementId, side, x, y, width, height, z_index })),
    p_expected_revision: revision,
  });
export const addAdminPlacement = (
  mailerId: string,
  type: PlacementType,
  placement: Partial<LayoutPlacement>,
) =>
  supabase.rpc("add_admin_community_placement", {
    p_mailer_id: mailerId,
    p_placement: { ...placement, placement_type: type },
  });
export const deleteAdminPlacement = (id: string) =>
  supabase.rpc("delete_admin_community_placement", { p_placement_id: id });
export const applyAdminMailerTemplate = (
  mailerId: string,
  side: "front" | "back",
  topPattern: CommunityMailerRowPattern,
  bottomPattern: CommunityMailerRowPattern,
) =>
  supabase.rpc("apply_admin_community_mailer_template", {
    p_mailer_id: mailerId,
    p_side: side,
    p_top_pattern: topPattern,
    p_bottom_pattern: bottomPattern,
  });
export const confirmAdminMailerPreflight = (mailerId: string, confirmation: string, confirmed: boolean) =>
  supabase.rpc("confirm_admin_community_mailer_preflight", {
    p_mailer_id: mailerId, p_confirmation: confirmation, p_confirmed: confirmed,
  });
export const recordAdminMailerPreflight = (
  mailerId: string,
  result: {
    fingerprint: string;
    passed: boolean;
    blockingCount: number;
    warningCount: number;
    checks: unknown[];
  },
) => supabase.rpc("record_admin_community_mailer_preflight", {
  p_mailer_id: mailerId,
  p_fingerprint: result.fingerprint,
  p_passed: result.passed,
  p_blocking_count: result.blockingCount,
  p_warning_count: result.warningCount,
  p_checks: result.checks,
});
export const transitionAdminMailerProduction = (
  mailerId: string,
  status: string,
) => supabase.rpc("transition_admin_community_mailer_production", {
  p_mailer_id: mailerId,
  p_to_status: status,
  p_details: {},
});export const assignAdminMailerCampaign = (placementId: string, campaignId: string, overrideReason?: string) =>
  supabase.rpc("assign_admin_community_mailer_campaign", { p_placement_id: placementId, p_campaign_id: campaignId, p_override_reason: overrideReason || null });
export const createAdminMailerSnapshots = (mailerId: string) =>
  supabase.rpc("create_admin_community_mailer_snapshots", { p_mailer_id: mailerId });
export const finalizeAdminMailerCandidate = (input: { mailerId: string; preflightRunId: string; storagePrefix: string; manifest: Record<string, unknown>; checksum: string; generatorVersion: string }) =>
  supabase.rpc("finalize_admin_community_mailer_candidate", { p_mailer_id: input.mailerId, p_preflight_run_id: input.preflightRunId, p_storage_prefix: input.storagePrefix, p_manifest: input.manifest, p_checksum: input.checksum, p_generator_version: input.generatorVersion });
export const certifyAdminMailerCandidate = (exportId: string, metadata: Record<string, unknown>) =>
  supabase.rpc("certify_admin_community_mailer_candidate", { p_export_id: exportId, p_metadata: metadata });export const getBusinessCommunityMailerAssignments = () =>
  supabase.rpc("get_business_community_mailer_assignments");
export const getBusinessCommunityCampaigns = () =>
  supabase.rpc("get_business_community_campaigns");
export const mailerNeedsAttention = (
  mailer: Pick<AdminMailerSummary, "attention_count">,
) => Number(mailer.attention_count) > 0;
