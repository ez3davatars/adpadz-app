import type {
  CreativeDestination,
  CreativeWorkshopState,
} from "../features/campaign-templates/creativeWorkshop";
import { supabase } from "./supabase";

export type CampaignCreativeVersionRecord = {
  id: string;
  campaign_id: string;
  destination: CreativeDestination;
  scope: "global" | "destination";
  format_key: string;
  template_family: string;
  settings_snapshot: CreativeWorkshopState;
  settings_fingerprint: string;
  change_summary: string[];
  affects_print: boolean;
  created_override: boolean;
  created_by: string | null;
  created_at: string;
};

export type SaveCampaignCreativeInput = {
  campaignId: string;
  destination: CreativeDestination;
  formatKey: string;
  state: CreativeWorkshopState;
  changeSummary: string[];
  affectsPrint: boolean;
  createdOverride: boolean;
  scope: "global" | "destination";
};

export type SaveCampaignCreativeResult = {
  version_id: string;
  version_created: boolean;
  version_fingerprint: string;
  version_created_at: string;
  persisted_metadata: Record<string, unknown>;
  print_affected: boolean;
};

export async function saveCampaignCreative(
  input: SaveCampaignCreativeInput,
): Promise<SaveCampaignCreativeResult> {
  const { data, error } = await supabase.rpc("save_campaign_creative_version", {
    p_campaign_id: input.campaignId,
    p_destination: input.destination,
    p_format_key: input.formatKey,
    p_settings_snapshot: input.state,
    p_change_summary: input.changeSummary,
    p_affects_print: input.affectsPrint,
    p_created_override: input.createdOverride,
    p_scope: input.scope,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("Creative save did not return an authoritative version.");
  }
  return row as SaveCampaignCreativeResult;
}

export async function loadCampaignCreativeVersions(
  campaignId: string,
  options: {
    limit?: number;
    before?: string | null;
    beforeId?: string | null;
  } = {},
): Promise<CampaignCreativeVersionRecord[]> {
  let query = supabase
    .from("campaign_creative_versions")
    .select(
      "id,campaign_id,destination,scope,format_key,template_family,settings_snapshot,settings_fingerprint,change_summary,affects_print,created_override,created_by,created_at",
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(25, Math.max(1, options.limit ?? 10)));
  if (options.before && options.beforeId) {
    query = query.or(
      `created_at.lt.${options.before},and(created_at.eq.${options.before},id.lt.${options.beforeId})`,
    );
  } else if (options.before) {
    query = query.lt("created_at", options.before);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignCreativeVersionRecord[];
}
