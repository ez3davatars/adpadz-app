import { Columns2, PanelsTopLeft, Rows2 } from "lucide-react";
import { useState, type ReactNode } from "react";

export type CreativeCompareMode = "side-by-side" | "split" | "toggle";

type CreativeCompareViewProps = {
  leftLabel: string;
  rightLabel: string;
  left: ReactNode;
  right: ReactNode;
  leftAspectRatio?: string;
  rightAspectRatio?: string;
  initialMode?: CreativeCompareMode;
};

export default function CreativeCompareView({
  leftLabel,
  rightLabel,
  left,
  right,
  leftAspectRatio = "4 / 3",
  rightAspectRatio = "4 / 3",
  initialMode = "side-by-side",
}: CreativeCompareViewProps) {
  const splitAvailable = leftAspectRatio === rightAspectRatio;
  const [mode, setMode] = useState<CreativeCompareMode>(
    initialMode === "split" && !splitAvailable ? "side-by-side" : initialMode,
  );
  const [showRight, setShowRight] = useState(true);
  const [split, setSplit] = useState(50);

  return (
    <div className="space-y-4" data-testid="creative-compare-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-white/10 bg-black/30 p-1" aria-label="Comparison view">
          <CompareModeButton active={mode === "side-by-side"} label="Side by side" icon={<Columns2 />} onClick={() => setMode("side-by-side")} className="hidden sm:inline-flex" />
          {splitAvailable && <CompareModeButton active={mode === "split"} label="Split" icon={<PanelsTopLeft />} onClick={() => setMode("split")} className="hidden sm:inline-flex" />}
          <CompareModeButton active={mode === "toggle"} label="Toggle" icon={<Rows2 />} onClick={() => setMode("toggle")} />
        </div>
        <p role="status" className="text-[10px] font-black text-[var(--text-muted)]">
          {leftLabel} <span className="px-1 text-neon">vs.</span> {rightLabel}
        </p>
      </div>

      {mode === "side-by-side" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ComparedCreative label={leftLabel} aspectRatio={leftAspectRatio}>{left}</ComparedCreative>
          <ComparedCreative label={rightLabel} aspectRatio={rightAspectRatio}>{right}</ComparedCreative>
        </div>
      )}

      {mode === "split" && (
        <div>
          <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-black" style={{ aspectRatio: leftAspectRatio }}>
            <div className="absolute inset-0">{left}</div>
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>{right}</div>
            <span className="absolute left-3 top-3 z-40 rounded-full bg-black/80 px-3 py-1 text-[9px] font-black">{rightLabel}</span>
            <span className="absolute right-3 top-3 z-40 rounded-full bg-black/80 px-3 py-1 text-[9px] font-black">{leftLabel}</span>
            <div className="pointer-events-none absolute inset-y-0 z-40 w-0.5 bg-neon shadow-[0_0_16px_rgba(176,255,0,0.55)]" style={{ left: `${split}%` }} />
          </div>
          <label className="mx-auto mt-4 block max-w-2xl text-[10px] font-black">
            <span className="mb-1 flex justify-between"><span>{rightLabel}</span><span>{leftLabel}</span></span>
            <input aria-label="Comparison split" type="range" min={10} max={90} value={split} onChange={event => setSplit(Number(event.target.value))} className="h-11 w-full accent-[var(--brand-primary)]" />
          </label>
        </div>
      )}

      {mode === "toggle" && (
        <div>
          <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-black" style={{ aspectRatio: showRight ? rightAspectRatio : leftAspectRatio }}>
            {showRight ? right : left}
          </div>
          <div className="mx-auto mt-3 grid max-w-md grid-cols-2 rounded-full border border-white/10 bg-black/30 p-1">
            <button type="button" aria-pressed={!showRight} onClick={() => setShowRight(false)} className={`min-h-11 rounded-full px-4 text-[10px] font-black ${!showRight ? "bg-neon text-black" : ""}`}>{leftLabel}</button>
            <button type="button" aria-pressed={showRight} onClick={() => setShowRight(true)} className={`min-h-11 rounded-full px-4 text-[10px] font-black ${showRight ? "bg-neon text-black" : ""}`}>{rightLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparedCreative({ label, aspectRatio, children }: { label: string; aspectRatio: string; children: ReactNode }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-center text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{label}</figcaption>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black" style={{ aspectRatio }}>{children}</div>
    </figure>
  );
}

function CompareModeButton({ active, label, icon, onClick, className = "" }: { active: boolean; label: string; icon: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`${className} min-h-11 items-center gap-1.5 rounded-full px-3 text-[9px] font-black ${active ? "bg-neon text-black" : "text-[var(--text-muted)]"}`}>
      <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>{label}
    </button>
  );
}
