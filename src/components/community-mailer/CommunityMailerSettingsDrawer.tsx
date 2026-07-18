import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AdminMailerDetail } from "../../lib/admin/communityMailers";
import { formatCommunityCardFormat } from "../../lib/communityCards";
import { AdpadzButton } from "../adpadz-ui";

export default function CommunityMailerSettingsDrawer({
  detail,
  storageKey,
  onClose,
  onDirtyChange,
  onSave,
}: {
  detail: AdminMailerDetail;
  storageKey: string;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (changes: Record<string, unknown>) => Promise<boolean>;
}) {
  const mailer = detail.mailer;
  const fallbackValue: SettingsDraft = {
    title: mailer.title,
    zone_name: mailer.zone_name || "",
    mailing_date: mailer.mailing_date || "",
    household_count: mailer.household_count == null
      ? ""
      : String(mailer.household_count),
    status: mailer.status,
    consumer_headline: mailer.consumer_headline || "",
    discovery_qr_link_id: mailer.discovery_qr_link_id || "",
  };
  const recoveredValue = readSettingsDraft(storageKey);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(Boolean(recoveredValue));
  const [value, setValue] = useState<SettingsDraft>(
    recoveredValue || fallbackValue,
  );
  function change<K extends keyof typeof value>(
    key: K,
    next: (typeof value)[K],
  ) {
    setValue((current) => {
      const changed = { ...current, [key]: next };
      writeSettingsDraft(storageKey, changed);
      return changed;
    });
    setDirty(true);
    onDirtyChange(true);
  }
  function requestClose() {
    if (
      !dirty ||
      window.confirm("Close campaign settings without saving your changes?")
    ) {
      removeSettingsDraft(storageKey);
      setDirty(false);
      onDirtyChange(false);
      onClose();
    }
  }
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  });
  async function submit() {
    setSaving(true);
    try {
      const saved = await onSave({
        title: value.title,
        zone_name: value.zone_name,
        mailing_date: value.mailing_date || null,
        household_count: value.household_count === ""
          ? null
          : Number(value.household_count),
        status: value.status,
        consumer_headline: value.consumer_headline,
        discovery_qr_link_id: value.discovery_qr_link_id || null,
      });
      if (saved) {
        removeSettingsDraft(storageKey);
        setDirty(false);
        onDirtyChange(false);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-mailer-settings-title"
      className="fixed inset-0 z-[90] flex justify-end bg-black/70"
    >
      <section className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#0b1a2e] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-neon">
              Low-frequency configuration
            </p>
            <h2
              id="community-mailer-settings-title"
              className="mt-1 text-2xl font-black"
            >
              Campaign settings
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close campaign settings"
            onClick={requestClose}
            className="rounded-full border border-white/10 p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Keep daily placement work on the canvas. Change campaign identity,
          schedule, and discovery settings here.
        </p>
        <div className="mt-6 space-y-4">
          <Field label="Campaign name">
            <input
              className="input-field"
              value={value.title}
              onChange={(event) => change("title", event.target.value)}
            />
          </Field>
          <Field label="Mailing zone">
            <input
              className="input-field"
              value={value.zone_name}
              onChange={(event) => change("zone_name", event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mailing date">
              <input
                type="date"
                className="input-field"
                value={value.mailing_date}
                onChange={(event) => change("mailing_date", event.target.value)}
              />
            </Field>
            <Field label="Homes reached">
              <input
                type="number"
                min="0"
                className="input-field"
                value={value.household_count}
                onChange={(event) =>
                  change("household_count", event.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Campaign status">
              <select
                className="input-field"
                value={value.status}
                onChange={(event) =>
                  change("status", event.target.value as typeof value.status)}
              >
                {["draft", "selling", "proof", "approved", "mailed", "archived"]
                  .map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Format">
              <div className="input-field flex items-center text-sm text-[var(--text-muted)]">
                {formatCommunityCardFormat(mailer.format)}
              </div>
            </Field>
          </div>
          <Field label="Consumer headline">
            <input
              className="input-field"
              value={value.consumer_headline}
              onChange={(event) =>
                change("consumer_headline", event.target.value)}
            />
          </Field>
          <Field label="Adpadz discovery QR">
            <select
              className="input-field"
              value={value.discovery_qr_link_id}
              onChange={(event) =>
                change("discovery_qr_link_id", event.target.value)}
            >
              <option value="">No discovery QR</option>
              {detail.qr_links.map((link) => (
                <option key={link.id} value={link.id}>{link.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sticky bottom-0 mt-8 border-t border-white/10 bg-[#0b1a2e] py-4">
          <AdpadzButton
            fullWidth
            disabled={saving || !dirty}
            onClick={() => void submit()}
          >
            {saving ? "Saving settings..." : "Save campaign settings"}
          </AdpadzButton>
        </div>
      </section>
    </div>
  );
}

type SettingsDraft = {
  title: string;
  zone_name: string;
  mailing_date: string;
  household_count: string;
  status: AdminMailerDetail["mailer"]["status"];
  consumer_headline: string;
  discovery_qr_link_id: string;
};

function readSettingsDraft(key: string): SettingsDraft | undefined {
  if (!key) return;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || "null");
    if (
      value && typeof value.title === "string" &&
      typeof value.zone_name === "string" &&
      typeof value.consumer_headline === "string"
    ) {
      return value as SettingsDraft;
    }
  } catch {
    removeSettingsDraft(key);
  }
}

function writeSettingsDraft(key: string, value: SettingsDraft) {
  if (!key) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The parent still warns about dirty state when storage is unavailable.
  }
}

function removeSettingsDraft(key: string) {
  if (!key) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else should fail because browser recovery storage is disabled.
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
