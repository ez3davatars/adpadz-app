import { buildSocialFilename, getSocialFormat, type SocialFormatKey } from './campaignDistribution';
import {
  waitForCreativeFonts,
  waitForCreativeImage,
} from './creativeResourceWait';
export type SocialCreativeExportDependencies = {
  readStyle?: (element: Element) => CSSStyleDeclaration;
  fetchAsset?: typeof fetch;
};

export type PreparedSocialCreativeExport = {
  clone: HTMLElement;
  width: number;
  height: number;
};

/**
 * Clones the live renderer, freezes its computed presentation, and embeds every
 * image before rasterization. The live preview is never mutated. Missing
 * cross-origin assets reject the export instead of producing different art.
 */
export async function prepareSocialCreativeExportClone(
  element: HTMLElement,
  dependencies: SocialCreativeExportDependencies = {},
): Promise<PreparedSocialCreativeExport> {
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error('The saved creative must be visible before it can be exported.');
  }
  const clone = element.cloneNode(true) as HTMLElement;
  const readStyle = dependencies.readStyle ?? (node => window.getComputedStyle(node));
  inlineComputedStyles(element, clone, readStyle);
  clone.setAttribute('style', `${clone.getAttribute('style') ?? ''};width:${bounds.width}px;height:${bounds.height}px;`);
  await inlineCreativeImages(element, clone, dependencies.fetchAsset ?? fetch);
  rejectExternalStyleAssets(clone);
  return { clone, width: bounds.width, height: bounds.height };
}

export async function exportSocialCreativeElement(
  element: HTMLElement,
  format: SocialFormatKey,
  businessName: string,
  campaignName: string,
): Promise<void> {
  const preset = getSocialFormat(format);
  const bytes = await rasterizeCreativeElement(element, preset.width, preset.height);
  const blob = new Blob([bytes], { type: 'image/png' });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = downloadUrl;
    anchor.download = buildSocialFilename(businessName, campaignName, format);
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }
}

/**
 * Rasterizes the canonical live renderer into deterministic PNG bytes.
 * Production destinations reuse this path so they cannot silently substitute
 * a second implementation of the saved Creative Workshop treatment.
 */
export async function rasterizeCreativeElement(
  element: HTMLElement,
  outputWidth: number,
  outputHeight: number,
): Promise<Uint8Array> {
  await waitForCreativeFonts(
    document.fonts,
    'Creative fonts did not load before the export timeout; export stopped.',
  );
  if (!Number.isFinite(outputWidth) || !Number.isFinite(outputHeight)
    || outputWidth <= 0 || outputHeight <= 0) {
    throw new Error('The creative export dimensions are invalid.');
  }
  const prepared = await prepareSocialCreativeExportClone(element);
  const serialized = new XMLSerializer().serializeToString(prepared.clone);
  const svgSource = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${prepared.width}" height="${prepared.height}" viewBox="0 0 ${prepared.width} ${prepared.height}">`,
    `<foreignObject width="100%" height="100%">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${prepared.width}px;height:${prepared.height}px;overflow:hidden">${serialized}</div>`,
    '</foreignObject>',
    '</svg>',
  ].join('');
  const renderUrl = await blobToDataUrl(new Blob(
    [svgSource],
    { type: 'image/svg+xml;charset=utf-8' },
  ));
  const image = await loadImage(renderUrl);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(outputWidth);
  canvas.height = Math.round(outputHeight);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot create the campaign image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(new Error('Could not create the PNG.')),
    'image/png',
  ));
  return new Uint8Array(await blob.arrayBuffer());
}
function inlineComputedStyles(
  source: Element,
  clone: Element,
  readStyle: (element: Element) => CSSStyleDeclaration,
) {
  const computed = readStyle(source);
  const declarations: string[] = [];
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (!property) continue;
    const value = computed.getPropertyValue(property);
    if (!value) continue;
    const priority = computed.getPropertyPriority(property);
    declarations.push(`${property}:${value}${priority ? ` !${priority}` : ''}`);
  }
  clone.setAttribute('style', declarations.join(';'));
  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    const clonedChild = cloneChildren[index];
    if (clonedChild) inlineComputedStyles(child, clonedChild, readStyle);
  });
}

async function inlineCreativeImages(
  source: Element,
  clone: Element,
  fetchAsset: typeof fetch,
) {
  const sourceImages = Array.from(source.querySelectorAll('img, image'));
  const cloneImages = Array.from(clone.querySelectorAll('img, image'));
  await Promise.all(sourceImages.map(async (sourceImage, index) => {
    const cloneImage = cloneImages[index];
    if (!cloneImage) throw new Error('Could not prepare every saved creative image for export.');
    const sourceUrl = imageSource(sourceImage);
    if (!sourceUrl) return;
    if (sourceUrl.startsWith('data:')) {
      setImageSource(cloneImage, sourceUrl);
      return;
    }
    const baseUrl = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI;
    const absoluteUrl = new URL(sourceUrl, baseUrl).toString();
    let response: Response;
    try {
      response = await fetchAsset(absoluteUrl, { mode: 'cors', credentials: 'omit' });
    } catch {
      throw new Error('An image in the saved creative could not be embedded safely. Export was stopped.');
    }
    if (!response.ok) {
      throw new Error('An image in the saved creative could not be embedded safely. Export was stopped.');
    }
    setImageSource(cloneImage, await blobToDataUrl(await response.blob()));
  }));
}

function imageSource(element: Element): string | null {
  if (element.tagName.toLowerCase() === 'img') {
    const image = element as HTMLImageElement;
    return image.currentSrc || image.getAttribute('src');
  }
  return element.getAttribute('href') || element.getAttribute('xlink:href');
}

function setImageSource(element: Element, source: string) {
  if (element.tagName.toLowerCase() === 'img') {
    element.setAttribute('src', source);
    element.removeAttribute('srcset');
    element.removeAttribute('sizes');
    return;
  }
  element.setAttribute('href', source);
  element.removeAttribute('xlink:href');
}

function rejectExternalStyleAssets(root: Element) {
  for (const element of [root, ...Array.from(root.querySelectorAll('[style]'))]) {
    const style = element.getAttribute('style') ?? '';
    for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
      const value = match[2]?.trim();
      if (value && !value.startsWith('data:') && !value.startsWith('#')) {
        throw new Error('A background image in the saved creative could not be embedded safely. Export was stopped.');
      }
    }
  }
}

export async function exportSocialCreative(
  svg: SVGSVGElement,
  format: SocialFormatKey,
  businessName: string,
  campaignName: string,
): Promise<void> {
  const preset = getSocialFormat(format);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(preset.width));
  clone.setAttribute('height', String(preset.height));
  await inlineSvgImages(clone);
  const source = new XMLSerializer().serializeToString(clone);
  const renderUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  let image: HTMLImageElement;
  try {
    image = await loadImage(renderUrl);
  } finally {
    URL.revokeObjectURL(renderUrl);
  }
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot create the campaign image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, preset.width, preset.height);
  context.drawImage(image, 0, 0, preset.width, preset.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not create the PNG.')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildSocialFilename(businessName, campaignName, format);
  anchor.click();
  URL.revokeObjectURL(url);
}

async function inlineSvgImages(svg: SVGSVGElement): Promise<void> {
  await Promise.all(Array.from(svg.querySelectorAll('image')).map(async image => {
    const href = image.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    try {
      const response = await fetch(href, { mode: 'cors' });
      if (!response.ok) throw new Error();
      image.setAttribute('href', await blobToDataUrl(await response.blob()));
    } catch {
      image.remove();
    }
  }));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await waitForCreativeImage(image, {
    failureMessage: 'Could not render the campaign image.',
    timeoutMessage: 'The campaign image did not render before the export timeout; export stopped.',
  });
  return image;
}
