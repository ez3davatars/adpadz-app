import { Save, User, Building2, Palette, Bell, CreditCard, Shield } from 'lucide-react';
import { mockBusiness } from '../../lib/mock-data';

export default function BizSettings() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Manage your business profile and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar nav */}
        <div className="space-y-1">
          {[
            { icon: Building2, label: 'Business Profile', active: true },
            { icon: User, label: 'Account' },
            { icon: Palette, label: 'Branding' },
            { icon: Bell, label: 'Notifications' },
            { icon: CreditCard, label: 'Billing' },
            { icon: Shield, label: 'Security' },
          ].map(item => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active ? 'bg-neon/10 text-neon' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          <div className="card-surface p-5">
            <h2 className="text-base font-semibold mb-5">Business Profile</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Business Name</label>
                  <input defaultValue={mockBusiness.name} className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Industry</label>
                  <select defaultValue={mockBusiness.industry} className="input-field">
                    <option value="restaurant">Restaurant / Food</option>
                    <option value="retail">Retail</option>
                    <option value="services">Professional Services</option>
                    <option value="health">Health & Wellness</option>
                    <option value="beauty">Beauty & Salon</option>
                    <option value="fitness">Fitness</option>
                    <option value="auto">Automotive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Description</label>
                <textarea defaultValue={mockBusiness.description} rows={3} className="input-field resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Phone</label>
                  <input defaultValue={mockBusiness.phone} className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Email</label>
                  <input defaultValue={mockBusiness.email} className="input-field" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Address</label>
                <input defaultValue={`${mockBusiness.address}, ${mockBusiness.city}, ${mockBusiness.state}`} className="input-field" />
              </div>

              <div className="pt-2">
                <button className="btn-primary text-sm px-5 py-2.5">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
