import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mailerNeedsAttention } from "../communityMailers";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../../App.tsx");
const adminPage = read("../../../pages/admin/AdminCommunityMailerDetail.tsx");
const businessPage = read("../../../pages/business/CommunityCampaigns.tsx");
const publicPage = read("../../../pages/CommunityCardPublic.tsx");
const reconcile = read(
  "../../../../supabase/migrations/20260714040000_reconcile_community_card_marketplace.sql",
);
const operations = read(
  "../../../../supabase/migrations/20260714050000_secure_community_mailer_operations.sql",
);
const builder = read(
  "../../../../supabase/migrations/20260714060000_add_visual_community_mailer_builder.sql",
);
const fixedTemplates = read(
  "../../../../supabase/migrations/20260716010000_add_fixed_community_mailer_templates.sql",
);
const rowPatterns = read(
  "../../../../supabase/migrations/20260717010000_expand_fixed_community_mailer_row_patterns.sql",
);
const toolbar = read(
  "../../../components/community-mailer/CommunityMailerToolbar.tsx",
);
const brandArea = read(
  "../../../components/community-mailer/MailerBrandArea.tsx",
);

describe("Community Mailer portal boundaries", () => {
  it("protects operator routes beneath the admin guard tree", () => {
    expect(app).toContain('<Route path="/admin"');
    expect(app).toContain('path="community-mailers"');
    expect(app).toContain('path="community-mailers/:mailerId"');
  });
  it("redirects the obsolete Business Hub operator route and preserves public URLs", () => {
    expect(app).toContain(
      'path="community-cards" element={<Navigate to="../community-campaigns" replace />}',
    );
    expect(app).toContain('path="/community-cards/:slug"');
  });
  it("uses one renderer in admin, business, public, and print modes", () => {
    for (const source of [adminPage, businessPage, publicPage]) {
      expect(source).toContain("CommunityMailerCanvas");
    }
    expect(adminPage).toContain('mode="admin-edit"');
    expect(adminPage).toContain('mode="print-preview"');
    expect(businessPage).toContain('mode="business-review"');
    expect(publicPage).toContain('mode="public-booking"');
  });
  it("uses approved fixed templates instead of freeform placement controls", () => {
    expect(toolbar).toContain("Double left + 2 singles");
    expect(toolbar).toContain("Single + double center + single");
    expect(toolbar).toContain("1 full-width spot (4 combined)");
    expect(toolbar).not.toContain("Add placement");
    expect(adminPage).toContain("applyAdminMailerTemplate");
    expect(adminPage).not.toContain("onChange={changePlacement}");
  });
  it("keeps postage on the front and the discovery QR on the back", () => {
    expect(brandArea).toContain("Postage<br />Indicia Area");
    expect(brandArea).toContain("CircularPadQR");
    expect(brandArea.indexOf('side === "front"')).toBeLessThan(
      brandArea.indexOf("Postage<br />Indicia Area"),
    );
  });
});

describe("Community Mailer server authorization and privacy", () => {
  it("requires owner/admin authorization for mutations", () => {
    expect(builder).toContain(
      "public.can_manage_community_mailers(auth.uid())",
    );
    expect(operations).toContain("admin_user.role IN ('owner', 'admin')");
  });
  it("revokes forged order inserts and raw placement reads", () => {
    expect(reconcile).toContain('DROP POLICY IF EXISTS "buyers start orders"');
    expect(reconcile).toContain("REVOKE ALL ON TABLE public.community_cards");
    expect(builder).toContain("REVOKE ALL ON TABLE public.community_cards");
  });
  it("keeps public output strict and creative opt-in explicit", () => {
    const projection = builder.slice(
      builder.indexOf(
        "CREATE OR REPLACE FUNCTION public.get_public_community_mailer",
      ),
      builder.indexOf(
        "REVOKE ALL ON FUNCTION public.get_admin_community_mailers",
      ),
    );
    expect(projection).toContain("slot.public_creative_visible");
    expect(projection).toContain("ELSE 'occupied' END");
    expect(projection).not.toContain("'buyer_user_id'");
    expect(projection).not.toContain("'internal_notes'");
    expect(projection).not.toContain("'payment_status'");
  });
  it("filters advertiser details at the database boundary", () => {
    expect(builder).toContain("own_business.owner_user_id = auth.uid()");
    expect(builder).toContain("slot.buyer_user_id = auth.uid()");
    expect(builder).toMatch(
      /slot\.buyer_user_id = auth\.uid\(\)\s+AND slot\.business_id IS NULL/,
    );
    expect(builder).not.toContain(
      "own_business.id IS NOT NULL OR slot.buyer_user_id = auth.uid()",
    );
  });
  it("uses explicit safe search paths for security-definer functions", () => {
    const securityDefiners = builder.match(/SECURITY DEFINER/g) || [];
    const safePaths = builder.match(/SET search_path = pg_catalog, public/g) ||
      [];
    expect(safePaths.length).toBeGreaterThanOrEqual(securityDefiners.length);
  });
  it("enforces fixed template geometry and blocks unsafe conversion", () => {
    expect(fixedTemplates).toContain(
      "CREATE TRIGGER community_card_slots_enforce_fixed_template",
    );
    expect(fixedTemplates).toContain(
      "CREATE OR REPLACE FUNCTION public.apply_admin_community_mailer_template",
    );
    expect(fixedTemplates).toContain(
      "Unassign or resolve every placement and order",
    );
    expect(fixedTemplates).toContain("SET search_path = pg_catalog, public");
    expect(rowPatterns).toContain("p_top_pattern text, p_bottom_pattern text");
    expect(rowPatterns).toContain("0.75 + unit_start * 24.775");
    expect(rowPatterns).toContain("unit_count * 24.175");
    expect(rowPatterns).toContain("unit_count * 25000");
  });
  it("identifies attention counts without inventing values", () => {
    expect(mailerNeedsAttention({ attention_count: 0 })).toBe(false);
    expect(mailerNeedsAttention({ attention_count: 2 })).toBe(true);
  });
});
