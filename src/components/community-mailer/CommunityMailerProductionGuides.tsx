import { EDDM_12X9_PERCENTAGES } from "../../lib/communityMailerLayout";

export default function CommunityMailerProductionGuides() {
  const geometry = EDDM_12X9_PERCENTAGES;
  return (
    <div
      aria-hidden="true"
      className="community-mailer-production-guides pointer-events-none absolute inset-0 z-50"
    >
      <div className="absolute inset-0 border border-red-400/80 bg-red-500/10" />
      <Guide
        label="Trim 12 × 9"
        className="border-black/80"
        left={geometry.trimLeft}
        top={geometry.trimTop}
        width={geometry.trimWidth}
        height={geometry.trimHeight}
      />
      <Guide
        label="Safe area"
        className="border-cyan-400"
        left={geometry.safeLeft}
        top={geometry.safeTop}
        width={geometry.safeWidth}
        height={geometry.safeHeight}
      />
      <span className="absolute bottom-1 left-1 rounded bg-red-600 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-white">
        0.125 in bleed
      </span>
    </div>
  );
}

function Guide({
  label,
  className,
  left,
  top,
  width,
  height,
}: {
  label: string;
  className: string;
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  return (
    <div
      className={`absolute border border-dashed ${className}`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
    >
      <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-white">
        {label}
      </span>
    </div>
  );
}