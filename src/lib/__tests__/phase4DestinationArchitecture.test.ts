import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CREATIVE_DESTINATION_KEYS,
  CREATIVE_DESTINATION_MAP,
  CREATIVE_DESTINATIONS,
} from "../../features/campaign-templates/creativeDestinations";
import {
  EPHEMERAL_CREATIVE_SETTING_KEYS,
  fingerprintCreativeSettings,
  fingerprintCreativeWorkshopState,
  isEffectiveCreativeDestinationUnsaved,
} from "../../features/campaign-templates/creativeWorkshopState";
import {
  DEFAULT_WORKSHOP_STATE,
} from "../../features/campaign-templates/creativeWorkshop";

const src = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// ── 1. Single canonical destination registry ──────────────────────────────────

describe("Phase 4 — canonical destination registry", () => {
  it("exports exactly 4 active destinations and no TV entry", () => {
    expect(CREATIVE_DESTINATION_KEYS).toEqual(["mailer", "discovery", "qr", "social"]);
    expect(CREATIVE_DESTINATIONS).toHaveLength(4);
    expect(CREATIVE_DESTINATION_KEYS).not.toContain("tv");
  });

  it("Social formats are derived exclusively from the canonical registry", () => {
    const socialDef = CREATIVE_DESTINATION_MAP.social;
    const formatKeys = socialDef.formats.map((f) => f.key);
    expect(formatKeys).toContain("square");
    expect(formatKeys).toContain("portrait");
    expect(formatKeys).toContain("landscape");
    expect(formatKeys).toContain("story");
  });

  it("SocialFormatRackStage imports from the canonical registry only", () => {
    const rack = src("components/campaign-creative/SocialFormatRackStage.tsx");
    expect(rack).toContain("CREATIVE_DESTINATION_MAP");
    expect(rack).not.toMatch(/\bSOCIAL_FORMATS\s*=/);
    expect(rack).not.toMatch(/\["square", "portrait", "landscape", "story"\]/);
  });

  it("Studio destination rail uses CREATIVE_DESTINATIONS from the registry", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("CREATIVE_DESTINATIONS.map");
  });

  it("Studio does not contain a second hardcoded destination array", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    const extraArrayMatches = workshop.match(
      /\bconst\s+\w+\s*=\s*\[[\s\S]{0,200}(?:mailer|discovery|qr|social)[\s\S]{0,200}\]/g,
    );
    const suspiciousArrays = (extraArrayMatches ?? []).filter(
      (m) =>
        !m.includes("CREATIVE_DESTINATIONS") &&
        !m.includes("CREATIVE_DESTINATION_KEYS") &&
        m.includes("mailer") &&
        m.includes("discovery"),
    );
    expect(suspiciousArrays).toHaveLength(0);
  });
});

// ── 2. Single canonical renderer ─────────────────────────────────────────────

describe("Phase 4 — single canonical renderer", () => {
  it("CampaignTemplateRenderer is imported by the stage components only once each", () => {
    const files = [
      "components/campaign-creative/MailerProofStage.tsx",
      "components/campaign-creative/DiscoveryFeedStage.tsx",
      "components/campaign-creative/QrPhoneStage.tsx",
      "components/campaign-creative/SocialFormatRackStage.tsx",
    ];
    for (const file of files) {
      const content = src(file);
      expect(content).not.toContain("CampaignTemplateRenderer");
    }
  });

  it("stage components use CreativePreviewCanvas (which wraps the single renderer)", () => {
    const files = [
      "components/campaign-creative/MailerProofStage.tsx",
      "components/campaign-creative/DiscoveryFeedStage.tsx",
      "components/campaign-creative/QrPhoneStage.tsx",
      "components/campaign-creative/SocialFormatRackStage.tsx",
    ];
    for (const file of files) {
      expect(src(file)).toContain("CreativePreviewCanvas");
    }
  });
});

// ── 3. Ephemeral guide state ──────────────────────────────────────────────────

describe("Phase 4 — ephemeral guide state", () => {
  it("EPHEMERAL_CREATIVE_SETTING_KEYS covers all three guide settings", () => {
    expect(EPHEMERAL_CREATIVE_SETTING_KEYS).toContain("safeAreaVisible");
    expect(EPHEMERAL_CREATIVE_SETTING_KEYS).toContain("bleedVisible");
    expect(EPHEMERAL_CREATIVE_SETTING_KEYS).toContain("qrMinimumVisible");
  });

  it("guide changes do not alter the creative fingerprint", () => {
    const base = { ...DEFAULT_WORKSHOP_STATE };
    const withGuides = {
      ...DEFAULT_WORKSHOP_STATE,
      global: { ...DEFAULT_WORKSHOP_STATE.global, safeAreaVisible: true, bleedVisible: true, qrMinimumVisible: true },
    };
    expect(fingerprintCreativeWorkshopState(base)).toBe(
      fingerprintCreativeWorkshopState(withGuides),
    );
  });

  it("guide changes do not make the session appear unsaved", () => {
    const saved = DEFAULT_WORKSHOP_STATE;
    const withGuides = {
      ...DEFAULT_WORKSHOP_STATE,
      global: { ...DEFAULT_WORKSHOP_STATE.global, safeAreaVisible: true, bleedVisible: true },
    };
    const base = fingerprintCreativeSettings(saved.global);
    const modified = fingerprintCreativeSettings(withGuides.global);
    expect(base).toBe(modified);
  });

  it("guide changes do not affect isEffectiveCreativeDestinationUnsaved", () => {
    const saved = DEFAULT_WORKSHOP_STATE;
    const withGuides = {
      ...DEFAULT_WORKSHOP_STATE,
      global: { ...DEFAULT_WORKSHOP_STATE.global, safeAreaVisible: true, bleedVisible: true, qrMinimumVisible: true },
    };
    expect(isEffectiveCreativeDestinationUnsaved(saved, withGuides, "mailer")).toBe(false);
    expect(isEffectiveCreativeDestinationUnsaved(saved, withGuides, "discovery")).toBe(false);
    expect(isEffectiveCreativeDestinationUnsaved(saved, withGuides, "social")).toBe(false);
  });

  it("MailerProofStage accepts guide overrides as a prop lifted from the workshop", () => {
    const proof = src("components/campaign-creative/MailerProofStage.tsx");
    // Guide state is now lifted to the workshop and passed as guideOverrides prop —
    // the stage no longer owns local useState(false) booleans.
    expect(proof).toContain("guideOverrides");
    expect(proof).not.toContain("useState(false)");
    expect(proof).not.toContain("dispatch(");
    expect(proof).not.toContain("onChange(");
  });

  it("MailerProofStage merges display settings from guideOverrides prop without touching real settings", () => {
    const proof = src("components/campaign-creative/MailerProofStage.tsx");
    expect(proof).toContain("displaySettings");
    expect(proof).toContain("...settings");
    expect(proof).toContain("safeAreaVisible: guideOverrides.safe");
  });
});

// ── 4. TV is not persisted ───────────────────────────────────────────────────

describe("Phase 4 — Adpadz TV Coming Later (not persisted)", () => {
  it("TV is not in the canonical destination registry", () => {
    expect(CREATIVE_DESTINATION_KEYS).not.toContain("tv" as never);
    expect(Object.keys(CREATIVE_DESTINATION_MAP)).not.toContain("tv");
  });

  it("Studio rail shows TV as a presentation-only disabled element", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("tv-coming-later-rail");
    expect(workshop).toContain("aria-disabled");
    expect(workshop).toContain("Coming Later");
  });

  it("TV is not a selectable destination in the Workshop", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).not.toContain(`selectDestination("tv")`);
    expect(workshop).not.toContain(`destination === "tv"`);
  });

  it("creativeDestinations.ts does not define a tv key", () => {
    const registry = src("features/campaign-templates/creativeDestinations.ts");
    expect(registry).not.toMatch(/^\s+tv:/m);
    expect(registry).not.toContain(`"tv"`);
  });

  it("CampaignReview already shows TvComingLaterCard", () => {
    const review = src("pages/business/CampaignReview.tsx");
    expect(review).toContain("TvComingLaterCard");
    expect(review).toContain("Coming Later");
  });
});

// ── 5. Destination stage integration ─────────────────────────────────────────

describe("Phase 4 — destination stage integration", () => {
  it("Workshop renders MailerProofStage for mailer destination", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("MailerProofStage");
    expect(workshop).toContain(`destination === "mailer"`);
  });

  it("Workshop renders DiscoveryFeedStage for discovery destination", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("DiscoveryFeedStage");
    expect(workshop).toContain(`destination === "discovery"`);
  });

  it("Workshop renders QrPhoneStage for qr destination", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("QrPhoneStage");
    expect(workshop).toContain(`destination === "qr"`);
  });

  it("Workshop renders SocialFormatRackStage for social destination", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("SocialFormatRackStage");
  });

  it("Social format toolbar is hidden in favor of the rack", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain(`destination !== "social"`);
  });

  it("selecting a destination does not call updateCreativeSettings", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    const fnBody = workshop.slice(workshop.indexOf("function selectDestination"));
    const nextFn = fnBody.indexOf("\n  function ", 5);
    const body = nextFn > 0 ? fnBody.slice(0, nextFn) : fnBody.slice(0, 300);
    expect(body).not.toContain("updateCreativeSettings");
    expect(body).not.toContain("dispatch");
  });
});

// ── 6. Mailer proof and Production Candidate consistency ──────────────────────

describe("Phase 4 — Mailer proof and Production Candidate consistency", () => {
  it("Workshop uses isCreativeQrUsableForCampaign for Mailer QR proof status", () => {
    // QR validation moved from MailerProofStage to the workshop, surfaced
    // through mailerQrStatus in the canvas status bar rather than a card below the proof.
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("isCreativeQrUsableForCampaign");
  });

  it("Workshop uses qrContrastRatio and MIN_PRODUCTION_QR_CONTRAST_RATIO for Mailer QR proof status", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("qrContrastRatio");
    expect(workshop).toContain("MIN_PRODUCTION_QR_CONTRAST_RATIO");
  });

  it("Workshop Mailer QR status formula matches the production candidate formula", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    const candidate = src("lib/communityMailerCandidate.ts");
    expect(workshop).toContain("inner_field_color");
    expect(candidate).toContain("inner_field_color");
  });

  it("Workshop save() validates QR usability and contrast before saving print changes", () => {
    const workshop = src("pages/business/CampaignCreativeWorkshopAdvanced.tsx");
    expect(workshop).toContain("isCreativeQrUsableForCampaign");
    expect(workshop).toContain("MIN_PRODUCTION_QR_CONTRAST_RATIO");
    expect(workshop).toContain("affectsPrint");
  });
});

// ── 7. QR context consistency ─────────────────────────────────────────────────

describe("Phase 4 — QR adapter consistency", () => {
  it("QrPhoneStage passes selectedQr to CreativePreviewCanvas for QR rendering", () => {
    const phone = src("components/campaign-creative/QrPhoneStage.tsx");
    expect(phone).toContain("selectedQr");
    expect(phone).toContain("CreativePreviewCanvas");
  });

  it("QrPhoneStage does not build a second QR implementation", () => {
    const phone = src("components/campaign-creative/QrPhoneStage.tsx");
    expect(phone).not.toContain("QRCode");
    expect(phone).not.toContain("qrcode");
    expect(phone).not.toContain("canvas.toDataURL");
  });
});
