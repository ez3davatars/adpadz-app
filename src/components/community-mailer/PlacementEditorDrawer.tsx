import { ExternalLink } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AdpadzButton } from "../adpadz-ui";
import type {
  AdminMailerDetail,
  AdminPlacement,
} from "../../lib/admin/communityMailers";
import { assignAdminMailerCampaign } from "../../lib/admin/communityMailers";

export default function PlacementEditorDrawer({
  placement,
  detail,
  onSave,
}: {
  placement: AdminPlacement;
  detail: AdminMailerDetail;
  onSave: (changes: Record<string, unknown>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState({
    label: placement.label,
    placement_tier: placement.placement_tier,
    status: placement.status,
    business_id: placement.business_id || "",
    campaign_id: placement.campaign_id || "",
    creative_asset_id: placement.creative_asset_id || "",
    qr_link_id: placement.qr_link_id || "",
    price_cents: String(placement.price_cents),
    discount_cents: String(placement.discount_cents),
    category: placement.category || "",
    offer_text: placement.offer_text || "",
    payment_status: placement.payment_status,
    proof_status: placement.proof_status,
    production_status: placement.production_status,
    is_featured: placement.is_featured,
    category_exclusive: placement.category_exclusive,
    public_creative_visible: placement.public_creative_visible,
    internal_notes: placement.internal_notes || "",
  });
  const assets = useMemo(
    () =>
      detail.assets.filter((asset) =>
        !value.business_id || asset.business_id === value.business_id
      ),
    [detail.assets, value.business_id],
  );
  const qrLinks = useMemo(
    () =>
      detail.qr_links.filter((link) =>
        !value.business_id || link.business_id === value.business_id
      ),
    [detail.qr_links, value.business_id],
  );
  const creative =
    detail.assets.find((asset) => asset.id === value.creative_asset_id)?.url ||
    placement.ad_image_url;
  async function submit() {
    setSaving(true);
    if (value.campaign_id && value.campaign_id !== placement.campaign_id) {
      const assignment = await assignAdminMailerCampaign(placement.id, value.campaign_id);
      if (assignment.error) throw assignment.error;
    }
    await onSave({
      ...value,
      price_cents: Number(value.price_cents),
      discount_cents: Number(value.discount_cents),
    });
    setSaving(false);
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-neon">
          Placement editor
        </p>
        <h2 className="text-xl font-black">{placement.label}</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Position and size come from the approved mailer template. Edit the
          advertiser, creative, pricing, and production details here.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs">
        <div>
          <span className="block text-[9px] font-black uppercase text-[var(--text-muted)]">
            Side
          </span>
          <b className="mt-1 block capitalize">{placement.side}</b>
        </div>
        <div>
          <span className="block text-[9px] font-black uppercase text-[var(--text-muted)]">
            Fixed size
          </span>
          <b className="mt-1 block">
            {placement.placement_type === "wide" ? "Double-width" : "Standard"}
          </b>
        </div>
      </div>
      <Field label="Placement label">
        <input
          className="input-field"
          value={value.label}
          onChange={(event) =>
            setValue((v) => ({ ...v, label: event.target.value }))}
        />
      </Field>
      <Field label="Business">
        <select
          className="input-field"
          value={value.business_id}
          onChange={(event) =>
            setValue((v) => ({
              ...v,
              business_id: event.target.value,
              creative_asset_id: "",
              qr_link_id: "",
            }))}
        >
          <option value="">Unassigned</option>
          {detail.businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <small className="mt-1 block text-[var(--text-muted)]">
          Prospect creation is not available in Mission Control Phase 1.
        </small>
      </Field>
      <Field label="Assigned Campaign">
        <select
          className="input-field"
          value={value.campaign_id}
          disabled={placement.is_locked || detail.mailer.layout_locked}
          onChange={(event) => setValue((v) => ({ ...v, campaign_id: event.target.value }))}
        >
          <option value="">No Campaign assigned</option>
          {detail.campaigns.filter((campaign) => campaign.business_id === value.business_id).map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.title} · {campaign.status}</option>
          ))}
        </select>
        <small className="mt-1 block text-[var(--text-muted)]">
          Campaign assignment is revision-bound and cannot change after production lock.
        </small>
      </Field>      <Field label="Creative asset">
        <select
          className="input-field"
          value={value.creative_asset_id}
          onChange={(event) =>
            setValue((v) => ({ ...v, creative_asset_id: event.target.value }))}
        >
          <option value="">Not selected</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.title}</option>
          ))}
        </select>
      </Field>
      {creative && (
        <a
          href={creative}
          target="_blank"
          rel="noreferrer"
          className="group relative block aspect-video overflow-hidden rounded-xl border border-white/10 bg-white"
        >
          <img
            src={creative}
            alt="Selected placement creative"
            className="h-full w-full object-contain"
          />
          <span className="absolute bottom-2 right-2 rounded bg-black/75 p-1">
            <ExternalLink className="h-3 w-3" />
          </span>
        </a>
      )}
      <Field label="QR campaign">
        <select
          className="input-field"
          value={value.qr_link_id}
          onChange={(event) =>
            setValue((v) => ({ ...v, qr_link_id: event.target.value }))}
        >
          <option value="">Not connected</option>
          {qrLinks.map((link) => (
            <option key={link.id} value={link.id}>{link.title}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select
            className="input-field"
            value={value.status}
            onChange={(event) =>
              setValue((v) => ({
                ...v,
                status: event.target.value as AdminPlacement["status"],
              }))}
          >
            {[
              "available",
              "reserved",
              "sold",
              "proof",
              "approved",
              "unavailable",
              "intake",
            ].map(
              (item) => <option key={item}>{item}</option>,
            )}
          </select>
        </Field>
        <Field label="Tier">
          <select
            className="input-field"
            value={value.placement_tier}
            onChange={(event) =>
              setValue((v) => ({ ...v, placement_tier: event.target.value }))}
          >
            {["standard", "premium", "featured", "system"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (cents)">
          <input
            className="input-field"
            type="number"
            min="0"
            value={value.price_cents}
            onChange={(event) =>
              setValue((v) => ({ ...v, price_cents: event.target.value }))}
          />
        </Field>
        <Field label="Discount (cents)">
          <input
            className="input-field"
            type="number"
            min="0"
            value={value.discount_cents}
            onChange={(event) =>
              setValue((v) => ({ ...v, discount_cents: event.target.value }))}
          />
        </Field>
      </div>
      <Field label="Category">
        <input
          className="input-field"
          value={value.category}
          onChange={(event) =>
            setValue((v) => ({ ...v, category: event.target.value }))}
        />
      </Field>
      <Field label="Offer">
        <textarea
          className="input-field min-h-20"
          value={value.offer_text}
          onChange={(event) =>
            setValue((v) => ({ ...v, offer_text: event.target.value }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment">
          <select
            className="input-field"
            value={value.payment_status}
            onChange={(event) =>
              setValue((v) => ({ ...v, payment_status: event.target.value }))}
          >
            {["not_started", "pending", "paid", "waived", "refunded"].map(
              (item) => <option key={item}>{item}</option>,
            )}
          </select>
        </Field>
        <Field label="Proof">
          <select
            className="input-field"
            value={value.proof_status}
            onChange={(event) =>
              setValue((v) => ({ ...v, proof_status: event.target.value }))}
          >
            {["not_started", "pending", "changes_requested", "approved"].map(
              (item) => <option key={item}>{item}</option>,
            )}
          </select>
        </Field>
      </div>
      <Field label="Production">
        <select
          className="input-field"
          value={value.production_status}
          onChange={(event) =>
            setValue((v) => ({ ...v, production_status: event.target.value }))}
        >
          {[
            "not_started",
            "creative_needed",
            "in_design",
            "proofing",
            "approved",
            "print_ready",
            "printed",
            "mailed",
          ].map((item) => <option key={item}>{item}</option>)}
        </select>
      </Field>
      <div className="grid gap-2 text-sm">
        <Check
          label="Featured sponsor"
          checked={value.is_featured}
          onChange={(checked) =>
            setValue((v) => ({ ...v, is_featured: checked }))}
        />
        <Check
          label="Category exclusive"
          checked={value.category_exclusive}
          onChange={(checked) =>
            setValue((v) => ({ ...v, category_exclusive: checked }))}
        />
        <Check
          label="Show creative publicly"
          checked={value.public_creative_visible}
          onChange={(checked) =>
            setValue((v) => ({ ...v, public_creative_visible: checked }))}
        />
      </div>
      <Field label="Internal notes">
        <textarea
          className="input-field min-h-24"
          value={value.internal_notes}
          onChange={(event) =>
            setValue((v) => ({ ...v, internal_notes: event.target.value }))}
        />
      </Field>
      <AdpadzButton fullWidth disabled={saving} onClick={() => void submit()}>
        {saving ? "Saving..." : "Save placement"}
      </AdpadzButton>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
function Check(
  { label, checked, onChange }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  },
) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
