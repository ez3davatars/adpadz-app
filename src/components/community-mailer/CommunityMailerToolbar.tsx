import { LayoutTemplate, Lock, Printer, Unlock } from "lucide-react";
import { AdpadzButton } from "../adpadz-ui";
import type {
  CommunityCardFormat,
  CommunityCardSide,
  CommunityMailerRowPattern,
} from "../../lib/communityCards";

export type { CommunityMailerRowPattern } from "../../lib/communityCards";

const patterns: Array<{ value: CommunityMailerRowPattern; label: string }> = [
  { value: "singles", label: "4 single spots" },
  { value: "double_left", label: "Double left + 2 singles" },
  { value: "double_center", label: "Single + double center + single" },
  { value: "double_right", label: "2 singles + double right" },
  { value: "double_pair", label: "2 double spots" },
  { value: "full", label: "1 full-width spot (4 combined)" },
];

export default function CommunityMailerToolbar({
  format,
  side,
  topPattern,
  bottomPattern,
  onTopPattern,
  onBottomPattern,
  onApply,
  locked,
  onToggleLock,
  onPrint,
  applying,
  legacy,
}: {
  format: CommunityCardFormat;
  side: CommunityCardSide;
  topPattern: CommunityMailerRowPattern;
  bottomPattern: CommunityMailerRowPattern;
  onTopPattern: (pattern: CommunityMailerRowPattern) => void;
  onBottomPattern: (pattern: CommunityMailerRowPattern) => void;
  onApply: () => void;
  locked: boolean;
  onToggleLock: () => void;
  onPrint: () => void;
  applying: boolean;
  legacy: boolean;
}) {
  const selectable = format === "postcard_9x12";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-2">
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 py-1.5">
        <LayoutTemplate className="h-4 w-4 text-neon" />
        <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">
          {side} rows
        </span>
        <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
          Top
          <select
            aria-label={`${side} top row layout`}
            className="bg-transparent text-xs font-black text-white outline-none"
            value={topPattern}
            disabled={!selectable || locked || applying}
            onChange={(event) =>
              onTopPattern(event.target.value as CommunityMailerRowPattern)}
          >
            {patterns.map((pattern) => (
              <option key={pattern.value} value={pattern.value}>
                {pattern.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
          Bottom
          <select
            aria-label={`${side} bottom row layout`}
            className="bg-transparent text-xs font-black text-white outline-none"
            value={bottomPattern}
            disabled={!selectable || locked || applying}
            onChange={(event) =>
              onBottomPattern(event.target.value as CommunityMailerRowPattern)}
          >
            {patterns.map((pattern) => (
              <option key={pattern.value} value={pattern.value}>
                {pattern.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AdpadzButton
        variant="secondary"
        disabled={!selectable || locked || applying}
        onClick={onApply}
      >
        <LayoutTemplate className="h-4 w-4" />
        {applying
          ? "Applying..."
          : legacy
          ? "Convert to fixed layout"
          : "Apply layout"}
      </AdpadzButton>
      <button
        type="button"
        onClick={onToggleLock}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-black"
      >
        {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        {locked ? "Layout locked" : "Lock layout"}
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-black"
      >
        <Printer className="h-4 w-4" />Print preview
      </button>
      <span
        className={`ml-auto text-xs font-black ${
          legacy ? "text-amber-300" : "text-neon"
        }`}
      >
        {legacy ? "Legacy freeform layout" : "Approved fixed template"}
      </span>
    </div>
  );
}
