import { Clock3, CopyPlus, Eye, GitCompareArrows, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  normalizeWorkshopState,
  resolveCreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import type { CampaignCreativeVersionRecord } from "../../lib/campaignCreativeHistory";
import { AdpadzButton } from "../adpadz-ui";

type CreativeHistoryDrawerProps = {
  open: boolean;
  entries: CampaignCreativeVersionRecord[];
  loading: boolean;
  loadingMore: boolean;
  error: string;
  hasMore: boolean;
  currentDestinationLabel: string;
  onClose: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onPreview: (entry: CampaignCreativeVersionRecord) => void;
  onCompare: (entry: CampaignCreativeVersionRecord) => void;
  onRestore: (entry: CampaignCreativeVersionRecord) => void;
  onDuplicate: (entry: CampaignCreativeVersionRecord) => void;
  renderThumbnail?: (entry: CampaignCreativeVersionRecord) => ReactNode;
};

export default function CreativeHistoryDrawer({
  open,
  entries,
  loading,
  loadingMore,
  error,
  hasMore,
  currentDestinationLabel,
  onClose,
  onLoadMore,
  onRetry,
  onPreview,
  onCompare,
  onRestore,
  onDuplicate,
  renderThumbnail,
}: CreativeHistoryDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => drawerRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="creative-history-title"
        tabIndex={-1}
        onKeyDown={event => trapFocus(event, drawerRef.current, onClose)}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-white/10 bg-[var(--bg-base)] shadow-2xl sm:max-w-[30rem]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neon">Saved states</p>
            <h2 id="creative-history-title" className="mt-1 text-xl font-black">Creative History</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Preview, compare, or safely restore a saved creative state.
            </p>
          </div>
          <AdpadzButton type="button" variant="icon" size="sm" aria-label="Close Creative History" onClick={onClose}>
            <X className="h-4 w-4" />
          </AdpadzButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && (
            <div role="status" className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-[var(--text-muted)]">
              Loading saved creative states…
            </div>
          )}
          {!loading && error && (
            <div role="alert" className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              <p>{error}</p>
              <AdpadzButton type="button" variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Retry history</AdpadzButton>
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
              <Clock3 className="mx-auto h-6 w-6 text-neon" />
              <h3 className="mt-3 text-sm font-black">Your next save starts history</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                Adpadz stores only materially different creative settings—never duplicate Campaign copy or production files.
              </p>
            </div>
          )}
          {!loading && entries.length > 0 && (
            <ol className="space-y-3" aria-label="Creative versions">
              {entries.map(entry => {
                const snapshot = normalizeWorkshopState(entry.settings_snapshot);
                const settings = entry.scope === "global"
                  ? snapshot.global
                  : resolveCreativeSettings(snapshot, entry.destination);
                const previewRatio = historyPreviewRatio(entry.destination, entry.format_key);
                return (
                  <li key={entry.id}>
                    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
                      <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 p-3">
                        <div className="flex h-[5.75rem] w-[5.75rem] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                          <div
                            className="overflow-hidden rounded-xl"
                            style={{
                              aspectRatio: String(previewRatio),
                              width: previewRatio >= 1 ? "100%" : "auto",
                              height: previewRatio >= 1 ? "auto" : "100%",
                            }}
                          >
                            {renderThumbnail?.(entry) ?? (
                              <div className="flex h-full items-center justify-center text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                {settings.template.replace("-", " ")}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <time className="block text-sm font-black" dateTime={entry.created_at}>
                            {formatVersionTime(entry.created_at)}
                          </time>
                          <p className="mt-1 truncate text-[10px] font-bold text-neon">
                            {destinationLabel(entry.destination)} · {formatLabel(entry.format_key)} · {templateLabel(entry.template_family)}
                          </p>
                          <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                            {entry.scope === "destination" ? "Destination override" : "Global settings"} · Saved by you
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.affects_print && <VersionPill>Print affected</VersionPill>}
                            {!entry.affects_print && <VersionPill>Digital only</VersionPill>}
                            {entry.created_override && <VersionPill>Override</VersionPill>}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-white/10 px-3 py-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">Changed</p>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                          {entry.change_summary?.length ? entry.change_summary.join(" · ") : "Saved creative settings"}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <HistoryAction icon={<Eye />} label="Preview" onClick={() => onPreview(entry)} />
                          <HistoryAction icon={<GitCompareArrows />} label="Compare" onClick={() => onCompare(entry)} />
                          <HistoryAction icon={<RotateCcw />} label="Restore" onClick={() => onRestore(entry)} />
                          <HistoryAction
                            icon={<CopyPlus />}
                            label={`Copy to ${currentDestinationLabel}`}
                            onClick={() => onDuplicate(entry)}
                          />
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
          {!loading && hasMore && (
            <AdpadzButton type="button" variant="secondary" size="sm" fullWidth className="mt-4" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? "Loading…" : "Load more history"}
            </AdpadzButton>
          )}
        </div>
      </aside>
    </div>
  );
}

function trapFocus(event: KeyboardEvent, container: HTMLElement | null, onClose: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    return;
  }
  if (event.key !== "Tab" || !container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hasAttribute("hidden"));
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (document.activeElement === container) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function HistoryAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-[10px] font-black transition hover:border-neon/40 hover:bg-neon/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
      onClick={onClick}
    >
      <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-neon">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function VersionPill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[var(--text-secondary)]">{children}</span>;
}

function destinationLabel(destination: string) {
  return {
    mailer: "Mailer",
    discovery: "Discovery",
    qr: "QR Landing",
    social: "Social",
  }[destination] ?? destination;
}

function formatLabel(format: string) {
  return format.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function templateLabel(template: string) {
  return template.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatVersionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  const day = sameDay ? "Today" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function historyPreviewRatio(destination: string, format: string) {
  if (destination === "mailer") return format === "combined" ? 16 / 9 : 4 / 3;
  if (destination === "qr") return 3 / 4;
  if (destination === "social") {
    if (format === "portrait") return 4 / 5;
    if (format === "landscape") return 1200 / 628;
    if (format === "story") return 9 / 16;
  }
  return 1;
}
