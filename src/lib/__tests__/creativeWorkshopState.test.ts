import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREATIVE_FORMATS,
  DEFAULT_CREATIVE_SETTINGS,
  DEFAULT_WORKSHOP_STATE,
  affectsPrint,
  createHistory,
  normalizeCreativeSettings,
  normalizeWorkshopState,
  redoHistory,
  resetCreativeDestination,
  resolveCreativeSettings,
  undoHistory,
  updateCreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  MIN_DIGITAL_QR_OPACITY,
  canHideCreativeQr,
  classifyCreativeChanges,
  createBeforeAfterProjection,
  createCreativeChangeSummary,
  createCreativeVersionSnapshot,
  enforceCreativeQrRestrictions,
  fingerprintCreativeSettings,
  fingerprintCreativeSnapshot,
  getCreativeElementLabel,
  getInspectorSectionForElement,
  isCreativeWorkshopUnsaved,
  isCreativeQrUsable,
  isCreativeQrUsableForCampaign,
  isEffectiveCreativeDestinationUnsaved,
  listMaterialCreativeChanges,
  parseCreativeVersionSnapshot,
  prepareCreativeSettingsForDestination,
  reconcileCreativeSelection,
  resetAllCreativeSettings,
  resetCreativeSectionInState,
  resetCreativeSettingsSection,
  sectionResetRequiresMailerQrPreservation,
  resolveEffectiveCreativeDestination,
  restoreCreativeVersion,
  restoreCreativeVersionState,
  restrictCreativeQrOpacity,
  serializeCreativeVersionSnapshot,
  shouldCreateCreativeVersion,
  stableSerializeCreativeValue,
  updateCreativeFormat,
} from "../../features/campaign-templates/creativeWorkshopState";

describe("Creative Workshop stable snapshots", () => {
  it("serializes object keys deterministically and fingerprints normalized settings", () => {
    expect(stableSerializeCreativeValue({ z: 1, a: { y: 2, x: 3 } }))
      .toBe(stableSerializeCreativeValue({ a: { x: 3, y: 2 }, z: 1 }));

    const settings = normalizeCreativeSettings({ overlayOpacity: 41 });
    const reordered = { ...settings, overlayOpacity: 41 };
    expect(fingerprintCreativeSettings(settings))
      .toBe(fingerprintCreativeSettings(reordered));
    expect(fingerprintCreativeSettings(settings))
      .not.toBe(fingerprintCreativeSettings({ ...settings, overlayOpacity: 42 }));
  });

  it("includes destination format and settings in a version fingerprint", () => {
    const mailer = createCreativeVersionSnapshot(DEFAULT_WORKSHOP_STATE, "mailer", "global");
    const combinedState = updateCreativeFormat(DEFAULT_WORKSHOP_STATE, "mailer", "combined");
    const combined = createCreativeVersionSnapshot(combinedState, "mailer", "global");
    expect(fingerprintCreativeSnapshot(mailer)).not.toBe(fingerprintCreativeSnapshot(combined));
  });

  it("round-trips canonical snapshots and safely rejects malformed history", () => {
    const source = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "destination", {
      imageAssetId: "asset-2",
      overlayOpacity: 70,
    });
    const snapshot = createCreativeVersionSnapshot(
      updateCreativeFormat(source, "social", "story"),
      "social",
      "destination",
    );
    expect(parseCreativeVersionSnapshot(serializeCreativeVersionSnapshot(snapshot))).toEqual(snapshot);
    expect(parseCreativeVersionSnapshot({
      destination: "social",
      destination_scope: "destination",
      format_key: "story",
      settings_snapshot: snapshot.settings,
    })).toEqual(snapshot);
    expect(parseCreativeVersionSnapshot("{not-json")).toBeNull();
    expect(parseCreativeVersionSnapshot({ destination: "other", settings: {} })).toBeNull();
  });

  it("deduplicates only against the latest saved version", () => {
    const versionA = createCreativeVersionSnapshot(DEFAULT_WORKSHOP_STATE, "mailer", "global");
    const versionB = {
      ...versionA,
      settings: { ...versionA.settings, imageZoom: 1.2 },
    };

    expect(shouldCreateCreativeVersion(versionA, {
      ...versionA,
      settings: { ...versionA.settings },
    })).toBe(false);
    expect(shouldCreateCreativeVersion(versionA, versionB)).toBe(true);
    expect(shouldCreateCreativeVersion(versionB, versionA)).toBe(true);
  });

  it("generates concise, field-level material change summaries", () => {
    const previous = createCreativeVersionSnapshot(DEFAULT_WORKSHOP_STATE, "mailer", "global");
    const next = {
      ...previous,
      formatKey: "combined" as const,
      settings: normalizeCreativeSettings({
        ...previous.settings,
        imageAssetId: "asset-new",
        imagePositionX: 22,
        imagePositionY: 71,
        imageZoom: 1.4,
        overlayOpacity: 72,
        qrId: "qr-new",
      }),
    };
    expect(listMaterialCreativeChanges(previous, next)).toEqual([
      "Format",
      "Image asset",
      "Image position",
      "Image zoom",
      "Overlay opacity",
      "QR selection",
    ]);
    expect(createCreativeChangeSummary(previous, next, 3))
      .toBe("Changed: Format, Image asset, Image position +3 more");
    expect(createCreativeChangeSummary(next, next)).toBe("No material changes");
  });
});

describe("Creative Workshop formats and impact", () => {
  it("normalizes legacy state with safe per-destination format defaults", () => {
    const legacy = normalizeWorkshopState({ global: DEFAULT_CREATIVE_SETTINGS, overrides: {} });
    expect(legacy.formats).toEqual(DEFAULT_CREATIVE_FORMATS);
    expect(updateCreativeFormat(legacy, "social", "not-a-format").formats.social).toBe("square");
    expect(updateCreativeFormat(legacy, "social", "portrait").formats.social).toBe("portrait");
  });

  it("classifies Mailer format/settings changes as print-affecting", () => {
    const mailerFormat = updateCreativeFormat(DEFAULT_WORKSHOP_STATE, "mailer", "combined");
    expect(classifyCreativeChanges(DEFAULT_WORKSHOP_STATE, mailerFormat)).toMatchObject({
      impact: "print-affecting",
      affectsPrint: true,
      digitalOnly: false,
      destinations: ["mailer"],
    });
    expect(affectsPrint(DEFAULT_WORKSHOP_STATE, mailerFormat)).toBe(true);
  });

  it("classifies a Social-only format or override as digital-only", () => {
    const socialFormat = updateCreativeFormat(DEFAULT_WORKSHOP_STATE, "social", "story");
    expect(classifyCreativeChanges(DEFAULT_WORKSHOP_STATE, socialFormat)).toMatchObject({
      impact: "digital-only",
      affectsPrint: false,
      digitalOnly: true,
      destinations: ["social"],
    });

    const socialOverride = updateCreativeSettings(
      DEFAULT_WORKSHOP_STATE,
      "social",
      "destination",
      { contrast: 112 },
    );
    expect(classifyCreativeChanges(DEFAULT_WORKSHOP_STATE, socialOverride)).toMatchObject({
      impact: "digital-only",
      createsOverride: true,
      destinations: ["social"],
    });
  });
});

describe("Creative Workshop effective destination comparison", () => {
  it("keeps Current on the effective override when comparing a historical global version", () => {
    const current = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "destination", {
      imageZoom: 1.8,
      headlineSize: "large",
    });
    const historicalGlobal = createCreativeVersionSnapshot(current, "social", "global");
    const effective = resolveEffectiveCreativeDestination(current, "social");

    expect(historicalGlobal.scope).toBe("global");
    expect(historicalGlobal.settings.imageZoom).toBe(1);
    expect(effective.settings.imageZoom).toBe(1.8);
    expect(effective.settings.headlineSize).toBe("large");
    expect(isEffectiveCreativeDestinationUnsaved(current, current, "social")).toBe(false);

    const editedOverride = updateCreativeSettings(current, "social", "destination", {
      imageZoom: 2.1,
    });
    expect(isEffectiveCreativeDestinationUnsaved(current, editedOverride, "social")).toBe(true);
  });
});
describe("Creative Workshop direct selection", () => {
  it("routes each supported element to its contextual inspector", () => {
    expect(getCreativeElementLabel("qr")).toBe("QR code");
    expect(getInspectorSectionForElement("image")).toBe("Image");
    expect(getInspectorSectionForElement("overlay")).toBe("Overlay");
    expect(getInspectorSectionForElement("qr")).toBe("QR");
    expect(getInspectorSectionForElement("logo")).toBe("Branding");
    expect(getInspectorSectionForElement("headline")).toBe("Text");
    expect(getInspectorSectionForElement("sponsor-badge")).toBe("Visibility");
    expect(getInspectorSectionForElement(null)).toBeNull();
  });

  it("clears selection when the selected element becomes hidden", () => {
    expect(reconcileCreativeSelection("headline", {
      ...DEFAULT_CREATIVE_SETTINGS,
      showHeadline: false,
    })).toBeNull();
    expect(reconcileCreativeSelection("qr", {
      ...DEFAULT_CREATIVE_SETTINGS,
      showQr: false,
    })).toBeNull();
    expect(reconcileCreativeSelection("overlay", {
      ...DEFAULT_CREATIVE_SETTINGS,
      overlayEnabled: false,
    })).toBeNull();
    expect(reconcileCreativeSelection("image", DEFAULT_CREATIVE_SETTINGS)).toBe("image");
    expect(reconcileCreativeSelection("logo", DEFAULT_CREATIVE_SETTINGS, ["headline", "image"]))
      .toBeNull();
  });
});

describe("Creative Workshop section resets and original treatment", () => {
  it("resets only the requested Image controls, including the Asset Library reference", () => {
    const edited = normalizeCreativeSettings({
      ...DEFAULT_CREATIVE_SETTINGS,
      imageAssetId: "asset-custom",
      imageFit: "contain",
      imagePositionX: 4,
      imageZoom: 2,
      brightness: 80,
      blur: 4,
      overlayOpacity: 87,
    });
    const reset = resetCreativeSettingsSection(edited, "image");
    expect(reset.imageAssetId).toBeNull();
    expect(reset.imageFit).toBe(DEFAULT_CREATIVE_SETTINGS.imageFit);
    expect(reset.imagePositionX).toBe(50);
    expect(reset.imageZoom).toBe(1);
    expect(reset.brightness).toBe(100);
    expect(reset.blur).toBe(0);
    expect(reset.overlayOpacity).toBe(87);
  });

  it("resets Overlay, QR, Text, Branding, Visibility, and Print Safety independently", () => {
    const edited = normalizeCreativeSettings({
      ...DEFAULT_CREATIVE_SETTINGS,
      overlayStyle: "radial",
      overlayOpacity: 91,
      qrId: "qr-custom",
      showQr: true,
      headlineSize: "large",
      textAlign: "right",
      textPanel: "solid",
      theme: "light",
      primaryColorOverride: "#123456",
      showLogo: false,
      showPhone: true,
      safeAreaVisible: true,
      bleedVisible: true,
      qrMinimumVisible: true,
      imageZoom: 1.7,
    });

    expect(resetCreativeSettingsSection(edited, "overlay")).toMatchObject({
      overlayStyle: DEFAULT_CREATIVE_SETTINGS.overlayStyle,
      overlayOpacity: DEFAULT_CREATIVE_SETTINGS.overlayOpacity,
      imageZoom: 1.7,
    });
    expect(resetCreativeSettingsSection(edited, "qr")).toMatchObject({ qrId: null, showQr: false });
    expect(resetCreativeSettingsSection(edited, "text")).toMatchObject({
      headlineSize: "medium",
      textAlign: "left",
      textPanel: "none",
    });
    expect(resetCreativeSettingsSection(edited, "branding")).toMatchObject({
      theme: "dark",
      primaryColorOverride: null,
    });
    expect(resetCreativeSettingsSection(edited, "visibility")).toMatchObject({
      showLogo: true,
      showPhone: false,
    });
    expect(resetCreativeSettingsSection(edited, "print-safety")).toMatchObject({
      safeAreaVisible: false,
      bleedVisible: false,
      qrMinimumVisible: false,
    });
  });
  it("identifies every section reset that can affect the required Mailer QR", () => {
    expect(sectionResetRequiresMailerQrPreservation("qr", "social", "global")).toBe(true);
    expect(sectionResetRequiresMailerQrPreservation("visibility", "social", "global")).toBe(true);
    expect(sectionResetRequiresMailerQrPreservation("qr", "mailer", "destination")).toBe(true);
    expect(sectionResetRequiresMailerQrPreservation("visibility", "mailer", "destination")).toBe(true);
    expect(sectionResetRequiresMailerQrPreservation("qr", "social", "destination")).toBe(false);
    expect(sectionResetRequiresMailerQrPreservation("image", "social", "global")).toBe(false);
  });

  it("does not let a global Visibility reset hide a selected Mailer QR", () => {
    const withPrintQr = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "mailer", "global", {
      qrId: "qr-print",
      showQr: true,
      showLogo: false,
    });
    const reset = resetCreativeSectionInState(withPrintQr, "mailer", "global", "visibility");
    expect(reset.global.showQr).toBe(true);
    expect(reset.global.showLogo).toBe(true);
  });
  it("resets a destination section to the global baseline without disturbing other override fields", () => {
    const global = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "global", {
      imageAssetId: "asset-global",
      imageZoom: 1.25,
    });
    const override = updateCreativeSettings(global, "social", "destination", {
      imageAssetId: "asset-social",
      imageZoom: 2.4,
      overlayOpacity: 84,
    });
    const reset = resetCreativeSectionInState(override, "social", "destination", "image");
    const settings = resolveCreativeSettings(reset, "social");
    expect(settings.imageAssetId).toBe("asset-global");
    expect(settings.imageZoom).toBe(1.25);
    expect(settings.overlayOpacity).toBe(84);
  });

  it("resets destination format and override together, and supports a complete reset", () => {
    const edited = updateCreativeFormat(
      updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "destination", { showLogo: false }),
      "social",
      "story",
    );
    const resetDestination = resetCreativeDestination(edited, "social");
    expect(resetDestination.overrides.social).toBeUndefined();
    expect(resetDestination.formats.social).toBe("square");
    expect(resetAllCreativeSettings()).toEqual(DEFAULT_WORKSHOP_STATE);
  });

  it("projects an original treatment without removing the template, asset, or visibility", () => {
    const adjusted = normalizeCreativeSettings({
      ...DEFAULT_CREATIVE_SETTINGS,
      template: "offer-first",
      imageAssetId: "asset-7",
      imageFit: "contain",
      imagePositionX: 12,
      imagePositionY: 75,
      imageZoom: 2,
      rotation: 4,
      brightness: 72,
      contrast: 145,
      saturation: 45,
      blur: 6,
      overlayEnabled: true,
      showHeadline: false,
    });
    const { before, after } = createBeforeAfterProjection(adjusted);
    expect(before).toMatchObject({
      template: "offer-first",
      imageAssetId: "asset-7",
      imageFit: "contain",
      imagePositionX: 50,
      imagePositionY: 50,
      imageZoom: 1,
      rotation: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      overlayEnabled: false,
      showHeadline: false,
    });
    expect(after).toEqual(adjusted);
    expect(reconcileCreativeSelection("overlay", before)).toBeNull();
    expect(reconcileCreativeSelection("overlay", after)).toBe("overlay");
  });
});

describe("Creative Workshop history restore and QR safety", () => {
  it("restores a version as one coherent unsaved undo entry", () => {
    const saved = DEFAULT_WORKSHOP_STATE;
    const historicalState = updateCreativeSettings(saved, "mailer", "destination", {
      imageZoom: 1.8,
      qrId: "qr-print",
      showQr: true,
    });
    const snapshot = createCreativeVersionSnapshot(historicalState, "mailer", "destination");
    const restored = restoreCreativeVersion(createHistory(saved), snapshot);
    expect(restored.past).toHaveLength(1);
    expect(restored.future).toHaveLength(0);
    expect(resolveCreativeSettings(restored.present, "mailer").imageZoom).toBe(1.8);
    expect(isCreativeWorkshopUnsaved(saved, restored.present)).toBe(true);
    expect(undoHistory(restored).present).toEqual(saved);
    expect(redoHistory(undoHistory(restored)).present).toEqual(restored.present);
  });

  it("classifies a Mailer restore as print-affecting and a Social override restore as digital-only", () => {
    const saved = DEFAULT_WORKSHOP_STATE;
    const mailerSnapshot = createCreativeVersionSnapshot(
      updateCreativeSettings(saved, "mailer", "destination", { imageZoom: 1.5 }),
      "mailer",
      "destination",
    );
    const restoredMailer = restoreCreativeVersion(createHistory(saved), mailerSnapshot).present;
    expect(classifyCreativeChanges(saved, restoredMailer).impact).toBe("print-affecting");

    const socialSnapshot = createCreativeVersionSnapshot(
      updateCreativeSettings(saved, "social", "destination", { imageZoom: 1.5 }),
      "social",
      "destination",
    );
    const restoredSocial = restoreCreativeVersion(createHistory(saved), socialSnapshot).present;
    expect(classifyCreativeChanges(saved, restoredSocial)).toMatchObject({
      impact: "digital-only",
      affectsPrint: false,
      destinations: ["social"],
    });
  });

  it("restores a recorded destination reset without recreating an override", () => {
    const current = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "destination", {
      imageZoom: 1.7,
    });
    const snapshot = {
      ...createCreativeVersionSnapshot(DEFAULT_WORKSHOP_STATE, "social", "destination"),
      hasDestinationOverride: false,
    };
    const restored = restoreCreativeVersionState(current, snapshot);
    expect(restored.overrides.social).toBeUndefined();
    expect(resolveCreativeSettings(restored, "social").imageZoom).toBe(1);
  });
  it("sanitizes copied history settings for the target destination", () => {
    const source = normalizeCreativeSettings({
      template: "featured-sponsor",
      qrId: "qr-selected",
      showQr: false,
    });
    expect(prepareCreativeSettingsForDestination(source, "social")).toMatchObject({
      template: DEFAULT_CREATIVE_SETTINGS.template,
      showQr: false,
    });
    expect(prepareCreativeSettingsForDestination(source, "mailer")).toMatchObject({
      template: "featured-sponsor",
      showQr: true,
    });
  });

  it("keeps a selected print QR visible and prevents unsafe print opacity", () => {
    const hiddenPrintQr = normalizeCreativeSettings({
      qrId: "qr-print",
      showQr: false,
    });
    expect(enforceCreativeQrRestrictions(hiddenPrintQr, "mailer").showQr).toBe(true);
    expect(enforceCreativeQrRestrictions(hiddenPrintQr, "social").showQr).toBe(false);
    expect(canHideCreativeQr("mailer")).toBe(false);
    expect(canHideCreativeQr("social")).toBe(true);
    expect(restrictCreativeQrOpacity("mailer", 20)).toBe(100);
    expect(restrictCreativeQrOpacity("social", 20)).toBe(MIN_DIGITAL_QR_OPACITY);
    expect(restrictCreativeQrOpacity("social", 82)).toBe(82);
  });
  it("accepts only owned, active, unexpired QR records for print saves", () => {
    const qr = {
      owner_user_id: "owner-1",
      status: "active",
      expires_at: null,
    };
    expect(isCreativeQrUsable(qr, "owner-1", 1_000)).toBe(true);
    expect(isCreativeQrUsable({ ...qr, owner_user_id: "owner-2" }, "owner-1", 1_000)).toBe(false);
    expect(isCreativeQrUsable({ ...qr, status: "paused" }, "owner-1", 1_000)).toBe(false);
    expect(isCreativeQrUsable({ ...qr, expires_at: "1970-01-01T00:00:00.500Z" }, "owner-1", 1_000)).toBe(false);
    expect(isCreativeQrUsable({ ...qr, expires_at: "not-a-date" }, "owner-1", 1_000)).toBe(false);
  });

  it("requires the effective Mailer QR to match its Campaign and business", () => {
    const campaign = {
      id: "campaign-1",
      ownerId: "owner-1",
      businessId: "business-1",
    };
    const campaignQr = {
      owner_user_id: "owner-1",
      business_id: "business-1",
      destination_type: "campaign",
      destination_id: "campaign-1",
      status: "active",
      expires_at: null,
      logo_data_url: "",
      outer_background_image_data_url: "",
      rim_band_image_data_url: "",
    };

    expect(isCreativeQrUsableForCampaign(campaignQr, campaign, 1_000)).toBe(true);
    expect(isCreativeQrUsableForCampaign({ ...campaignQr, business_id: "business-2" }, campaign, 1_000)).toBe(false);
    expect(isCreativeQrUsableForCampaign({ ...campaignQr, destination_type: "url" }, campaign, 1_000)).toBe(false);
    expect(isCreativeQrUsableForCampaign({ ...campaignQr, destination_id: "campaign-2" }, campaign, 1_000)).toBe(false);
    expect(isCreativeQrUsableForCampaign({ ...campaignQr, owner_user_id: "owner-2" }, campaign, 1_000)).toBe(false);
    expect(isCreativeQrUsableForCampaign({ ...campaignQr, status: "paused" }, campaign, 1_000)).toBe(false);
    expect(isCreativeQrUsableForCampaign({ ...campaignQr, expires_at: "1970-01-01T00:00:00.500Z" }, campaign, 1_000)).toBe(false);
    expect(isCreativeQrUsableForCampaign({ ...campaignQr, logo_data_url: "x".repeat(1_048_577) }, campaign, 1_000)).toBe(false);

    const digitalUrlQr = { ...campaignQr, destination_type: "url", destination_id: null };
    expect(isCreativeQrUsable(digitalUrlQr, campaign.ownerId, 1_000)).toBe(true);
  });
});
