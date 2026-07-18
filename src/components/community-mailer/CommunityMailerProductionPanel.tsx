import { AlertTriangle, CheckCircle2, Download, LockKeyhole } from "lucide-react";
import { AdpadzButton } from "../adpadz-ui";
import {
  buildCommunityMailerExportManifest,
  type MailerPreflightInput,
  runCommunityMailerPreflight,
} from "../../lib/communityMailerProduction";

export default function CommunityMailerProductionPanel(
  { input, onSelectPlacement, onConfirm, onRecord }: {
    input: MailerPreflightInput;
    onSelectPlacement?: (placementId: string) => void;
    onConfirm?: (key: keyof MailerPreflightInput["manual"], value: boolean) => void;
    onRecord?: (result: ReturnType<typeof runCommunityMailerPreflight>) => void;
  },
) {
  const result = runCommunityMailerPreflight(input);
  function downloadManifest() {
    if (!result.passed) return;
    const manifest = buildCommunityMailerExportManifest(input, result);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `community-mailer-${input.mailerId}-r${input.layoutRevision}-manifest.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-neon">
            Production preflight
          </p>
          <h2 className="mt-1 text-lg font-black">
            {result.passed ? "Ready for export" : "Action required"}
          </h2>
        </div>
        <span className="text-xl font-black">{result.completionPercent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-neon"
          style={{ width: `${result.completionPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {result.blockingCount} blockers / {result.warningCount} warnings /{" "}
        {result.fingerprint}
      </p>
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {result.checks.map((check, index) => (
          <button
            type="button"
            key={`${check.code}-${check.placementId ?? index}`}
            onClick={() =>
              check.placementId && onSelectPlacement?.(check.placementId)}
            className="flex w-full gap-2 rounded-xl border border-white/10 p-3 text-left text-xs"
          >
            {check.passed
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-neon" />
              : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />}
            <span>
              <b>{check.label}</b>
              <span className="ml-2 uppercase text-[9px] text-[var(--text-muted)]">
                {check.verification}
              </span>
              <small className="mt-1 block text-[var(--text-muted)]">
                {check.detail}
              </small>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-white/10 p-3">
        {([
          ["postalAreaConfirmed", "Postal area checked"],
          ["printerSpecsConfirmed", "Printer specs confirmed"],
          ["colorProfileConfirmed", "Color profile confirmed"],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={input.manual[key]} onChange={(event) => onConfirm?.(key, event.target.checked)} disabled={!onConfirm} />
            {label}
          </label>
        ))}
      </div>
      {onRecord && <AdpadzButton fullWidth variant="secondary" className="mt-3" onClick={() => onRecord(result)}>Record preflight snapshot</AdpadzButton>}
      <AdpadzButton
        fullWidth
        className="mt-4"
        disabled={!result.passed}
        onClick={downloadManifest}
      >
        {result.passed
          ? <Download className="h-4 w-4" />
          : <LockKeyhole className="h-4 w-4" />}
        Export production manifest
      </AdpadzButton>
      <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
        This deterministic manifest records the locked layout and assets. It
        does not claim browser-verified CMYK, fonts, DPI, or printer acceptance.
      </p>
    </div>
  );
}
