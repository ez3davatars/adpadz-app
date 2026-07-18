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
};
export type AdminMailerDetail = {
  mailer: AdminMailerRecord;
  placements: AdminPlacement[];
  businesses: Array<{ id: string; name: string }>;
  assets: Array<
    {
      id: string;
      business_id: string | null;
      title: string;
      url: string | null;
    }
  >;
  qr_links: Array<
    {
      id: string;
      business_id: string | null;
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
export const getAdminMailer = (id: string) =>
  supabase.rpc("get_admin_community_mailer", { p_mailer_id: id });
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
export const getBusinessCommunityCampaigns = () =>
  supabase.rpc("get_business_community_campaigns");
export const mailerNeedsAttention = (
  mailer: Pick<AdminMailerSummary, "attention_count">,
) => Number(mailer.attention_count) > 0;
