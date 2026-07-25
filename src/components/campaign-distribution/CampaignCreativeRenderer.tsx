import { forwardRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  getSocialFormat, type CampaignCreativeData, type SocialFormatKey, type SocialTemplateKey,
} from '../../lib/campaignDistribution';

type Props = {
  creative: CampaignCreativeData;
  format: SocialFormatKey;
  template: SocialTemplateKey;
  showQr: boolean;
  showExpiration: boolean;
  imageHref?: string | null;
  logoHref?: string | null;
  className?: string;
};

const CampaignCreativeRenderer = forwardRef<SVGSVGElement, Props>(function CampaignCreativeRenderer({
  creative, format, template, showQr, showExpiration, imageHref, logoHref, className,
}, ref) {
  const preset = getSocialFormat(format);
  const { width, height } = preset;
  const compact = height < 800;
  const portrait = height > width;
  const margin = Math.round(Math.min(width, height) * 0.065);
  const offer = creative.campaign.offer_title || creative.campaign.headline || creative.campaign.title;
  const headline = creative.campaign.headline || creative.campaign.title;
  const description = creative.campaign.offer_description || creative.campaign.description || '';
  const qrModules = useQrModules(showQr ? creative.campaignUrl : null);
  const resolvedImage = imageHref === undefined ? creative.campaignImageUrl : imageHref;
  const resolvedLogo = logoHref === undefined ? creative.businessLogoUrl : logoHref;
  const visualImageHeight = template === 'hero-visual' ? height * (portrait ? 0.56 : 0.64) : height * (compact ? 0.46 : 0.42);
  const contentTop = template === 'hero-visual' ? visualImageHeight - margin * 0.5 : margin;
  const contentWidth = width - margin * 2;
  const qrSize = compact ? 118 : 156;

  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img" aria-label={`${creative.campaign.title} ${preset.label} social creative`}>
      <title>{creative.campaign.title} {preset.label} social creative</title>
      <defs>
        <linearGradient id="creative-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={creative.primaryColor} stopOpacity={template === 'hero-visual' ? 0.05 : 0.18} />
          <stop offset="100%" stopColor={creative.primaryColor} stopOpacity="0.98" />
        </linearGradient>
        <clipPath id="creative-image-clip"><rect width={width} height={visualImageHeight} /></clipPath>
      </defs>
      <rect width={width} height={height} fill={creative.primaryColor} />
      {resolvedImage && (
        <image href={resolvedImage} width={width} height={visualImageHeight} preserveAspectRatio="xMidYMid slice" clipPath="url(#creative-image-clip)" />
      )}
      <rect width={width} height={Math.max(visualImageHeight, height * 0.72)} fill="url(#creative-shade)" />
      <path d={`M0 ${height - margin * 1.25} C${width * 0.28} ${height - margin * 2.25}, ${width * 0.62} ${height - margin * 0.2}, ${width} ${height - margin * 1.8} V${height} H0Z`} fill={creative.accentColor} opacity="0.12" />

      <g transform={`translate(${margin} ${contentTop})`}>
        <g>
          {resolvedLogo ? (
            <image href={resolvedLogo} width={compact ? 128 : 170} height={compact ? 62 : 82} preserveAspectRatio="xMinYMid meet" />
          ) : (
            <text y={compact ? 35 : 46} fill="white" fontFamily="Poppins, Arial, sans-serif" fontWeight="900" fontSize={compact ? 29 : 38}>{creative.businessName}</text>
          )}
          {resolvedLogo && <text x={compact ? 145 : 190} y={compact ? 38 : 50} fill="white" fontFamily="Poppins, Arial, sans-serif" fontWeight="800" fontSize={compact ? 23 : 30}>{creative.businessName}</text>}
        </g>

        <g transform={`translate(0 ${compact ? 86 : 118})`}>
          {template === 'brand-focus' && <text fill={creative.accentColor} fontFamily="Poppins, Arial, sans-serif" fontWeight="800" fontSize={compact ? 18 : 24} letterSpacing="3">LOCAL BUSINESS. LOCAL OFFER.</text>}
          <WrappedText text={template === 'offer-first' ? offer : headline} y={template === 'brand-focus' ? (compact ? 42 : 58) : 0} width={contentWidth - (showQr ? qrSize + margin : 0)} fontSize={template === 'offer-first' ? (compact ? 54 : portrait ? 82 : 72) : (compact ? 43 : 60)} lineHeight={1.02} maxLines={template === 'offer-first' ? 3 : 2} fill="white" />
          {template !== 'offer-first' && offer !== headline && <WrappedText text={offer} y={compact ? 112 : 150} width={contentWidth - (showQr ? qrSize + margin : 0)} fontSize={compact ? 27 : 40} lineHeight={1.12} maxLines={2} fill={creative.accentColor} />}
          {!compact && description && <WrappedText text={description} y={template === 'offer-first' ? (portrait ? 268 : 210) : 260} width={contentWidth - (showQr ? qrSize + margin : 0)} fontSize={27} lineHeight={1.25} maxLines={2} fill="#f3f4f1" />}
        </g>
      </g>

      <g transform={`translate(${margin} ${height - margin - (compact ? 42 : 64)})`}>
        <rect x="0" y={compact ? -42 : -54} width={Math.min(contentWidth - (showQr ? qrSize + 30 : 0), compact ? 300 : 420)} height={compact ? 58 : 74} rx={999} fill={creative.accentColor} />
        <text x={compact ? 150 : 210} y={compact ? -4 : -8} fill="#10150f" fontFamily="Poppins, Arial, sans-serif" fontWeight="900" fontSize={compact ? 21 : 27} textAnchor="middle">{creative.campaign.cta_label || 'Learn more'}</text>
        {showExpiration && creative.campaign.end_date && (
          <text y={compact ? 34 : 46} fill="white" opacity="0.82" fontFamily="Poppins, Arial, sans-serif" fontWeight="700" fontSize={compact ? 16 : 21}>
            Ends {formatDate(creative.campaign.end_date)}
          </text>
        )}
      </g>
      {showQr && qrModules && (
        <g transform={`translate(${width - margin - qrSize} ${height - margin - qrSize})`}>
          <rect width={qrSize} height={qrSize} rx={18} fill="white" />
          <QrModules modules={qrModules} size={qrSize} />
        </g>
      )}
    </svg>
  );
});

function WrappedText({ text, x = 0, y, width, fontSize, lineHeight, maxLines, fill }: { text: string; x?: number; y: number; width: number; fontSize: number; lineHeight: number; maxLines: number; fill: string }) {
  const words = text.trim().split(/\s+/);
  const maxCharacters = Math.max(8, Math.floor(width / (fontSize * 0.56)));
  const lines: string[] = [];
  for (const word of words) {
    const current = lines[lines.length - 1] ?? '';
    if (!current || `${current} ${word}`.length <= maxCharacters) lines[Math.max(0, lines.length - 1)] = current ? `${current} ${word}` : word;
    else if (lines.length < maxLines) lines.push(word);
    else {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.â€¦]$/, '')}â€¦`;
      break;
    }
  }
  return (
    <text x={x} y={y} fill={fill} fontFamily="Poppins, Arial, sans-serif" fontWeight="900" fontSize={fontSize}>
      {lines.slice(0, maxLines).map((line, index) => <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? fontSize : fontSize * lineHeight}>{line}</tspan>)}
    </text>
  );
}

function useQrModules(value: string | null) {
  return useMemo(() => {
    if (!value) return null;
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' }) as { modules: { size: number; data: ArrayLike<number> } };
    return { count: qr.modules.size, data: Array.from(qr.modules.data, Boolean) };
  }, [value]);
}

function QrModules({ modules, size }: { modules: { count: number; data: boolean[] }; size: number }) {
  const quiet = 4;
  const moduleSize = (size * 0.84) / (modules.count + quiet * 2);
  const start = size * 0.08;
  return <g>{modules.data.map((dark, index) => dark ? <rect key={index} x={start + ((index % modules.count) + quiet) * moduleSize} y={start + (Math.floor(index / modules.count) + quiet) * moduleSize} width={moduleSize + 0.25} height={moduleSize + 0.25} fill="#111" /> : null)}</g>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default CampaignCreativeRenderer;
