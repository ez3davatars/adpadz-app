import { describe, expect, it, vi } from "vitest";
import { prepareSocialCreativeExportClone } from "../socialCreativeExport";

describe("saved Social creative DOM export", () => {
  it("styles and embeds only a detached clone", async () => {
    const fixture = exportFixture("data:image/png;base64,AAAA");

    const result = await prepareSocialCreativeExportClone(fixture.live, {
      readStyle: () => styleDeclaration(),
      fetchAsset: vi.fn(),
    });

    expect(result.clone).toBe(fixture.clone);
    expect(result.width).toBe(540);
    expect(result.height).toBe(540);
    expect(fixture.liveSetAttribute).not.toHaveBeenCalled();
    expect(fixture.cloneSetAttribute).toHaveBeenCalled();
    expect(fixture.cloneImageSetAttribute).toHaveBeenCalledWith(
      "src",
      "data:image/png;base64,AAAA",
    );
  });

  it("allows self-contained SVG fragment references used by exact QR artwork", async () => {
    const fixture = exportFixture("data:image/png;base64,AAAA");
    await expect(prepareSocialCreativeExportClone(fixture.live, {
      readStyle: () => styleDeclaration("clip-path", "url(#qr-artwork-clip)"),
      fetchAsset: vi.fn(),
    })).resolves.toBeDefined();
  });
  it("fails loudly without mutating the live preview when an asset cannot be embedded", async () => {
    const fixture = exportFixture("https://assets.example.test/campaign.png");
    const fetchAsset = vi.fn().mockResolvedValue({ ok: false } as Response);

    await expect(prepareSocialCreativeExportClone(fixture.live, {
      readStyle: () => styleDeclaration(),
      fetchAsset,
    })).rejects.toThrow("could not be embedded safely");

    expect(fetchAsset).toHaveBeenCalledOnce();
    expect(fixture.liveSetAttribute).not.toHaveBeenCalled();
    expect(fixture.liveImageSetAttribute).not.toHaveBeenCalled();
  });
});

function styleDeclaration(property = "display", value = "block") {
  return {
    length: 1,
    item: () => property,
    getPropertyValue: () => value,
    getPropertyPriority: () => "",
  } as unknown as CSSStyleDeclaration;
}

function exportFixture(sourceUrl: string) {
  const liveSetAttribute = vi.fn();
  const liveImageSetAttribute = vi.fn();
  const cloneSetAttribute = vi.fn();
  const cloneImageSetAttribute = vi.fn();
  const cloneAttributes = new Map<string, string>();
  const liveImage = {
    tagName: "IMG",
    currentSrc: sourceUrl,
    getAttribute: (name: string) => name === "src" ? sourceUrl : null,
    setAttribute: liveImageSetAttribute,
  } as unknown as HTMLImageElement;
  const cloneImage = {
    tagName: "IMG",
    getAttribute: (name: string) => name === "src" ? sourceUrl : null,
    setAttribute: cloneImageSetAttribute,
    removeAttribute: vi.fn(),
  } as unknown as HTMLImageElement;
  const clone = {
    tagName: "DIV",
    children: [],
    setAttribute: (name: string, value: string) => {
      cloneAttributes.set(name, value);
      cloneSetAttribute(name, value);
    },
    getAttribute: (name: string) => cloneAttributes.get(name) ?? null,
    querySelectorAll: (selector: string) => selector === "img, image" ? [cloneImage] : [],
  } as unknown as HTMLElement;
  const live = {
    tagName: "DIV",
    children: [],
    cloneNode: () => clone,
    setAttribute: liveSetAttribute,
    getBoundingClientRect: () => ({ width: 540, height: 540 }),
    querySelectorAll: (selector: string) => selector === "img, image" ? [liveImage] : [],
  } as unknown as HTMLElement;

  return {
    live,
    clone,
    liveSetAttribute,
    liveImageSetAttribute,
    cloneSetAttribute,
    cloneImageSetAttribute,
  };
}
