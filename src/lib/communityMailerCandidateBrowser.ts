import QRCode from "qrcode";
import { supabase } from "./supabase";
import {
  type CandidateInput,
  type CandidatePackage,
  generateCommunityMailerCandidate,
} from "./communityMailerCandidate";
import { geometryForMailer } from "./communityMailerProductionContracts";

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });

const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")),
      "image/png",
    )
  );

async function fetchPdfCreative(url: string) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`Creative asset failed: ${response.status}`);
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!contentType.includes("svg") && !url.toLowerCase().endsWith(".svg")) return bytes;

  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  const maximumEdge = 1800;
  const scale = Math.min(1, maximumEdge / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
}
export async function renderCommunityMailerPreview(
  input: CandidateInput,
  side: "front" | "back",
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
  for (const placement of input.placements.filter((item) => item.side === side)) {
    const x = placement.x / 100 * canvas.width;
    const y = placement.y / 100 * canvas.height;
    const width = placement.width / 100 * canvas.width;
    const height = placement.height / 100 * canvas.height;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    const image = await loadImage(placement.creativeUrl);
    const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * ratio;
    const drawHeight = image.naturalHeight * ratio;
    context.drawImage(
      image,
      x + (width - drawWidth) / 2,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    context.restore();
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, placement.qrDestination, {
      errorCorrectionLevel: "H",
      margin: 4,
      color: {
        dark: placement.qrForegroundColor || "#000000",
        light: placement.qrBackgroundColor || "#ffffff",
      },
    });
    const minimumQrPixels = geometry.qrMinimumInches * geometry.dpi * scale;
    const qrSize = Math.min(Math.max(minimumQrPixels, Math.min(width, height) * 0.22), width - 8, height - 8);
    context.drawImage(qrCanvas, x + width - qrSize - 4, y + height - qrSize - 4, qrSize, qrSize);
    context.strokeStyle = "#222222";
    context.lineWidth = 1;
    context.strokeRect(x, y, width, height);
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, canvas.height - 18, canvas.width, 18);
  context.fillStyle = "#333333";
  context.font = "10px sans-serif";
  context.fillText(
    `PRODUCTION CANDIDATE · NOT PRINTER CERTIFIED · revision ${input.layoutRevision}`,
    6,
    canvas.height - 6,
  );
  return new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
}

export async function generateCandidateInBrowser(input: CandidateInput) {
  return generateCommunityMailerCandidate(input, {

    fetchAsset: fetchPdfCreative,

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
