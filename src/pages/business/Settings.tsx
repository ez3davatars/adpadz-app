import { Bell, Building2, CreditCard, Palette, Shield, User } from 'lucide-react';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzSection } from '../../components/adpadz-ui';

const settingsAreas = [
  { icon: Building2, title: 'Business Profile', description: 'Permanent business information belongs in the Business Hub and feeds Smart Cards, campaigns, QR destinations, and future outputs.', status: 'Foundation' },
  { icon: Palette, title: 'Brand System', description: 'Reusable colors, logo, cover imagery, gallery assets, and design defaults should be referenced by outputs.', status: 'Planned' },
  { icon: Bell, title: 'Notifications', description: 'Future alerts for leads, booking requests, offer claims, campaign changes, and QR activity.', status: 'Planned' },
  { icon: CreditCard, title: 'Billing', description: 'Future plan, subscription, usage limits, and upload entitlements.', status: 'Planned' },
  { icon: Shield, title: 'Access & Security', description: 'Future team access, roles, authentication, and audit controls.', status: 'Planned' },
  { icon: User, title: 'Owner Profile', description: 'Account preferences stay separate from permanent business profile data.', status: 'Planned' },
];

export default function BizSettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">Business Settings</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Settings are the permanent business layer. Campaigns and outputs reference this information instead of copying it.</p>
        </div>
        <AdpadzButton type="button" variant="secondary" size="lg" disabled>Saving coming soon</AdpadzButton>
      </div>

      <AdpadzSection eyebrow="Ownership" title="One business profile, many outputs" description="This page establishes where long-lived business information will live. Existing Smart Card settings remain unchanged until a deliberate migration moves shared fields into the Business Hub.">
        <div className="grid gap-3 lg:grid-cols-3">
          {['Business Hub owns permanent information', 'Campaign Engine owns promotions', 'Outputs render references'].map(item => (
            <AdpadzCard key={item} as="article" variant="flat" className="p-4">
              <Building2 className="mb-3 h-5 w-5 text-neon" />
              <p className="text-sm font-black">{item}</p>
            </AdpadzCard>
          ))}
        </div>
      </AdpadzSection>

      <div className="grid gap-3 lg:grid-cols-2">
        {settingsAreas.map(area => (
          <AdpadzCard key={area.title} as="article" variant="standard" className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neon/10 text-neon">
                <area.icon className="h-5 w-5" />
              </div>
              <AdpadzBadge variant="status">{area.status}</AdpadzBadge>
            </div>
            <h2 className="mt-4 text-lg font-black">{area.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{area.description}</p>
          </AdpadzCard>
        ))}
      </div>
    </div>
  );
}
