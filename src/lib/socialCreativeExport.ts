import { buildSocialFilename, getSocialFormat, type SocialFormatKey } from './campaignDistribution';

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
  const image = await loadImage(URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' })));
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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not render the campaign image.')); };
    image.src = url;
  });
}
