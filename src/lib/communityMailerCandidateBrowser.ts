import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { CampaignTemplateRenderer } from "../features/campaign-templates/CampaignTemplateRenderer";
import { normalizeCreativeSettings } from "../features/campaign-templates/creativeWorkshop";
import type { CampaignTemplateContent } from "../features/campaign-templates/types";
import QRStudioPreview from "../components/qr/QRStudioPreview";
import { normalizeQRStudioProductionArtwork } from "./qr/qrArtwork";
import { rasterizeCreativeElement } from "./socialCreativeExport";
import { supabase } from "./supabase";
import {
  candidateDisplayHeadline,
  type CandidateInput,
  type CandidatePackage,
  type CandidatePlacement,
  type CandidatePlacementRenderOptions,
  type CandidateRenderedPlacement,
  generateCommunityMailerCandidate,
} from "./communityMailerCandidate";
import { geometryForMailer } from "./communityMailerProductionContracts";
import {
  waitForCreativeFonts,
  waitForCreativeImage,
} from "./creativeResourceWait";

const loadImage = async (url: string) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await waitForCreativeImage(image, {
    failureMessage: "The exact creative raster could not be loaded.",
    timeoutMessage: "The exact creative raster did not load before the production timeout; candidate generation stopped.",
  });
  return image;
};

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) =>
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png")
);

async function renderCandidatePlacement(
  _input: CandidateInput,
  placement: CandidatePlacement,
  options: CandidatePlacementRenderOptions,
) {
  const settings = normalizeCreativeSettings(placement.creativeSettings || placement.templateSettings);
  const qrArtwork = normalizeQRStudioProductionArtwork(placement.qrArtwork);
  if (settings.showQr && !qrArtwork) {
    throw new Error(`${placement.slotKey} exact QR Studio artwork is unavailable.`);
  }
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${options.width}px`,
    height: `${options.height}px`,
    overflow: "hidden",
    containerType: "inline-size",
    zIndex: "-2147483648",
  });
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const content = candidateContent(placement);
    root.render(createElement(CampaignTemplateRenderer, {
      content,
      settings,
      destination: "mailer",
      physicalWidthInches: options.physicalWidthInches,
      qrBoxOverride: options.qrBox ?? undefined,
      qrArtwork: qrArtwork
        ? createElement(QRStudioPreview, {
            qr: qrArtwork,
            origin: placement.qrShortUrl ? new URL(placement.qrShortUrl).origin : undefined,
            size: Math.max(options.width, options.height),
          })
        : undefined,
    }));
    await nextPaint();
    await waitForImages(host, placement.slotKey);
    const renderedElement = host.firstElementChild;
    if (!(renderedElement instanceof HTMLElement) || host.childElementCount !== 1) {
      throw new Error(`${placement.slotKey} canonical creative renderer did not mount exactly once.`);
    }
    const bytes = await rasterizeCreativeElement(renderedElement, options.width, options.height);
    await assertVisibleCreativeRaster(bytes, placement.slotKey);
    return bytes;
  } finally {
    root.unmount();
    host.remove();
  }
}

async function assertVisibleCreativeRaster(bytes: Uint8Array, slotKey: string) {
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas rendering is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visibleCreativePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 8 && (pixels[index] < 248 || pixels[index + 1] < 248 || pixels[index + 2] < 248)) {
        visibleCreativePixels += 1;
      }
    }
    if (visibleCreativePixels < 16) {
      throw new Error(`${slotKey} canonical creative raster was blank; candidate generation stopped.`);
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
function candidateContent(placement: CandidatePlacement): CampaignTemplateContent {
  const campaign = {
    id: placement.campaignId,
    owner_id: "production-snapshot",
    title: placement.headline,
    headline: placement.headline,
    description: placement.description || "",
    offer_title: placement.offer || "",
    offer_description: placement.offerDetails || "",
    cta_label: placement.cta || "Learn more",
    cta_url: placement.qrDestination,
    status: "active",
    end_date: placement.expiration || null,
  };
  return {
    campaignId: placement.campaignId,
    businessName: placement.businessName,
    businessPhone: placement.phone || null,
    businessWebsite: placement.website || null,
    businessLogoUrl: placement.businessLogoUrl || null,
    imageUrl: placement.creativeUrl,
    headline: candidateDisplayHeadline(placement),
    description: placement.description || "",
    offer: placement.offer || "",
    offerDetails: placement.offerDetails || "",
    ctaLabel: placement.cta || "Learn more",
    destinationUrl: placement.qrShortUrl || null,
    expiration: placement.expiration || null,
    primaryColor: placement.primaryColor || "#14251b",
    accentColor: placement.accentColor || "#b6ff00",
    campaign,
  };
}

async function nextPaint() {
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await waitForCreativeFonts(
    document.fonts,
    "Creative fonts did not load before the production timeout; candidate generation stopped.",
  );
}

async function waitForImages(root: HTMLElement, slotKey: string) {
  await Promise.all(Array.from(root.querySelectorAll("img")).map(async image => {
    await waitForCreativeImage(image, {
      failureMessage: `${slotKey} has a bound creative image that failed to load; candidate generation stopped.`,
      timeoutMessage: `${slotKey} has a bound creative image that did not load before the production timeout; candidate generation stopped.`,
    });
  }));
}

export async function renderCommunityMailerPreview(
  input: CandidateInput,
  side: "front" | "back",
  renderedPlacements: readonly CandidateRenderedPlacement[],
) {
  const geometry = geometryForMailer(input.format);
  const scale = 0.25;
  const canvas = document.createElement("canvas");
  canvas.width = geometry.bleedPixels.width * scale;
  canvas.height = geometry.bleedPixels.height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const renderedByPlacement = new Map(renderedPlacements.map(item => [item.placementId, item]));
  for (const placement of input.placements.filter(item => item.side === side)) {
    const rendered = renderedByPlacement.get(placement.id);
    if (!rendered) throw new Error(`${placement.slotKey} exact creative raster is missing.`);
    const objectUrl = URL.createObjectURL(new Blob([rendered.bytes], { type: "image/png" }));
    try {
      const image = await loadImage(objectUrl);
      context.drawImage(
        image,
        placement.x / 100 * canvas.width,
        placement.y / 100 * canvas.height,
        placement.width / 100 * canvas.width,
        placement.height / 100 * canvas.height,
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, canvas.height - 18, canvas.width, 18);
  context.fillStyle = "#333333";
  context.font = "10px sans-serif";
  context.fillText(
    `PRODUCTION CANDIDATE - NOT PRINTER CERTIFIED - revision ${input.layoutRevision}`,
    6,
    canvas.height - 6,
  );
  return new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
}

export async function generateCandidateInBrowser(input: CandidateInput) {
  return generateCommunityMailerCandidate(input, {
    renderPlacement: renderCandidatePlacement,
    renderPreview: renderCommunityMailerPreview,
  });
}
export async function uploadCommunityMailerCandidate(
  candidate: CandidatePackage,
) {
  const uploaded: string[] = [];
  try {
    for (const file of candidate.files) {
      const path = `${candidate.storagePrefix}${file.name}`;
      const result = await supabase.storage
        .from("community-mailer-production")
        .upload(path, file.bytes, {
          contentType: file.contentType,
          upsert: false,
        });
      if (result.error) throw result.error;
      uploaded.push(path);
    }
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map((path) =>
      supabase.storage.from("community-mailer-production").remove([path])
    ));
    throw error;
  }
}
