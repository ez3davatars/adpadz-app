import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Archive,
  Clock3,
  DollarSign,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Wrench,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { safeHttpUrl } from '../../lib/urls';
import {
  AdpadzBadge,
  AdpadzButton,
  AdpadzCard,
  AdpadzEmptyState,
  AdpadzMetricCard,
  AdpadzSection,
} from '../../components/adpadz-ui';

type ServiceRecord = {
  id: string;
  business_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price: number | string | null;
  currency: string | null;
  booking_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ServiceForm = {
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  currency: string;
  booking_url: string;
  sort_order: string;
  is_active: boolean;
};

type ServiceLibrary = {
  ownerId: string;
  businessId: string | null;
  services: ServiceRecord[];
};

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  duration_minutes: '',
  price: '',
  currency: 'USD',
  booking_url: '',
  sort_order: '0',
  is_active: true,
};

export default function BizServices() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialLibrary() {
      setLoading(true);
      setError(null);
      try {
        const library = await fetchServiceLibrary();
        if (!cancelled) {
          setOwnerId(library.ownerId);
          setBusinessId(library.businessId);
          setServices(library.services);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load the Service Library.');
          setLoading(false);
        }
      }
    }

    void loadInitialLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(
    () => services.filter(service => service.is_active).length,
    [services],
  );
  const pricedCount = useMemo(
    () => services.filter(service => service.price !== null).length,
    [services],
  );
  const averageDuration = useMemo(() => {
    const durations = services
      .map(service => service.duration_minutes)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    if (durations.length === 0) return 'Not set';
    return `${Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)} min`;
  }, [services]);

  async function reloadLibrary(): Promise<ServiceLibrary> {
    const library = await fetchServiceLibrary();
    setOwnerId(library.ownerId);
    setBusinessId(library.businessId);
    setServices(library.services);
    return library;
  }

  function startNew() {
    const nextSortOrder = services.reduce(
      (highest, service) => Math.max(highest, service.sort_order),
      -1,
    ) + 1;
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: String(nextSortOrder) });
    setError(null);
    setMessage(null);
    scrollToEditor();
  }

  function editService(service: ServiceRecord) {
    setEditingId(service.id);
    setForm(toServiceForm(service));
    setError(null);
    setMessage(null);
    scrollToEditor();
  }

  function scrollToEditor() {
    window.setTimeout(
      () => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }

  async function saveService() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!ownerId) throw new Error('Sign in before saving a service.');
      if (!businessId) throw new Error('Save Business Settings before creating shared services.');
      if (!form.name.trim()) throw new Error('Service name is required.');

      const durationMinutes = parseOptionalPositiveInteger(form.duration_minutes, 'Duration');
      const price = parseOptionalPrice(form.price);
      const currency = price === null ? null : normalizeCurrency(form.currency);
      const bookingUrl = normalizeOptionalBookingUrl(form.booking_url);
      const sortOrder = parseSortOrder(form.sort_order);
      const payload = {
        business_id: businessId,
        owner_id: ownerId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_minutes: durationMinutes,
        price,
        currency,
        booking_url: bookingUrl,
        is_active: form.is_active,
        sort_order: sortOrder,
      };

      const result = editingId
        ? await supabase
          .from('business_services')
          .update(payload)
          .eq('id', editingId)
          .eq('business_id', businessId)
          .select('id')
          .single()
        : await supabase
          .from('business_services')
          .insert(payload)
          .select('id')
          .single();

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? 'Could not save the service.');
      }

      const savedId = result.data.id as string;
      const wasEditing = Boolean(editingId);
      const reloaded = await reloadLibrary();
      const savedService = reloaded.services.find(service => service.id === savedId);
      if (!savedService) throw new Error('The service was saved but could not be reloaded.');

      setEditingId(savedId);
      setForm(toServiceForm(savedService));
      setMessage(wasEditing ? 'Service updated everywhere it is placed.' : 'Service added to the Business Hub.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the service.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleServiceActive(service: ServiceRecord) {
    setUpdatingId(service.id);
    setError(null);
    setMessage(null);

    try {
      const nextActive = !service.is_active;
      const { data, error: updateError } = await supabase
        .from('business_services')
        .update({ is_active: nextActive })
        .eq('id', service.id)
        .eq('business_id', service.business_id)
        .select('id')
        .single();
      if (updateError || !data) {
        throw new Error(updateError?.message ?? 'Could not update the service.');
      }

      const reloaded = await reloadLibrary();
      const refreshedService = reloaded.services.find(item => item.id === service.id);
      if (editingId === service.id && refreshedService) {
        setForm(toServiceForm(refreshedService));
      }
      setMessage(nextActive
        ? 'Service activated. Linked placements that are locally active are visible again.'
        : 'Service archived. It is unavailable for new placement and hidden on linked Smart Cards.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the service.');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">Service Library</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Maintain service details once, then place them on customer-facing Smart Cards.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdpadzButton href="/app/business/smart-cards" variant="secondary" size="lg">
            <Settings2 className="h-4 w-4" /> Manage Smart Card placement
          </AdpadzButton>
          <AdpadzButton type="button" onClick={startNew} size="lg" disabled={!businessId || loading}>
            <Plus className="h-4 w-4" /> Add Service
          </AdpadzButton>
        </div>
      </div>

      {(error || message) && (
        <AdpadzCard
          variant="flat"
          className={`p-4 text-sm font-bold ${error
            ? 'border-red-400/30 bg-red-500/10 text-red-100'
            : 'border-neon/30 bg-neon/10 text-neon'}`}
          role={error ? 'alert' : 'status'}
        >
          {error || message}
        </AdpadzCard>
      )}

      {!loading && !businessId && (
        <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-100">
          Save your permanent Business Hub record before creating reusable services.
          <AdpadzButton href="/app/business/settings" variant="secondary" size="sm" className="ml-2">
            Open Settings
          </AdpadzButton>
        </AdpadzCard>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <AdpadzMetricCard
          icon={Wrench}
          label="Active services"
          value={String(activeCount)}
          detail={`${services.length} total in the Business Hub`}
        />
        <AdpadzMetricCard
          icon={DollarSign}
          label="Priced services"
          value={String(pricedCount)}
          detail="Optional pricing shown in the shared library"
        />
        <AdpadzMetricCard
          icon={Clock3}
          label="Avg. duration"
          value={averageDuration}
          detail="Across services with a duration"
        />
      </div>

      <div ref={editorRef}>
        <AdpadzSection
          eyebrow={editingId ? 'Edit service' : 'New service'}
          title="Reusable Business Hub service"
          description="Name, description, duration, and availability automatically update linked Smart Card service rows."
        >
          <fieldset disabled={!businessId || saving} className="space-y-4 disabled:opacity-60">
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <Field label="Service name">
                <input
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  className="input-field"
                  placeholder="Consultation, haircut, detailing package"
                />
              </Field>
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.duration_minutes}
                  onChange={event => setForm(current => ({ ...current, duration_minutes: event.target.value }))}
                  className="input-field"
                  placeholder="60"
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                className="input-field min-h-24 resize-y"
                placeholder="What is included, who it is for, or what customers should expect."
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-[180px_130px_1fr_140px]">
              <Field label="Price (optional)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={event => setForm(current => ({ ...current, price: event.target.value }))}
                  className="input-field"
                  placeholder="49.00"
                />
              </Field>
              <Field label="Currency">
                <input
                  value={form.currency}
                  onChange={event => setForm(current => ({ ...current, currency: event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }))}
                  className="input-field uppercase"
                  maxLength={3}
                  placeholder="USD"
                  disabled={!form.price.trim()}
                />
              </Field>
              <Field label="Booking URL (optional)">
                <input
                  type="url"
                  value={form.booking_url}
                  onChange={event => setForm(current => ({ ...current, booking_url: event.target.value }))}
                  className="input-field"
                  placeholder="https://booking.example.com/service"
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.sort_order}
                  onChange={event => setForm(current => ({ ...current, sort_order: event.target.value }))}
                  className="input-field"
                />
              </Field>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))}
              />
              <span>
                <span className="block text-sm font-black">Service is active</span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  Archived services stay in the library and are hidden on linked Smart Cards without changing each card placement setting.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <AdpadzButton type="button" onClick={() => void saveService()} disabled={saving || !businessId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'Save Changes' : 'Save Service'}
              </AdpadzButton>
              {editingId && (
                <AdpadzButton type="button" variant="ghost" onClick={startNew} disabled={saving}>
                  Clear
                </AdpadzButton>
              )}
            </div>
          </fieldset>
        </AdpadzSection>
      </div>

      <AdpadzSection
        eyebrow="Library"
        title="Saved services"
        description="Edit shared details here. Open Smart Cards to choose customer-facing placement and order."
      >
        {loading ? (
          <p className="flex items-center text-sm text-[var(--text-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Loading services...
          </p>
        ) : services.length === 0 ? (
          <AdpadzEmptyState
            icon={<Wrench className="h-7 w-7" />}
            title="No services yet"
            description={businessId
              ? 'Add the first reusable service for this Business Hub.'
              : 'Create the Business Hub in Settings, then add reusable services here.'}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {services.map(service => (
              <AdpadzCard
                key={service.id}
                as="article"
                variant="flat"
                className={`p-4 ${service.is_active ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black">{service.name}</h2>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Order {service.sort_order + 1}
                    </p>
                  </div>
                  <AdpadzBadge variant={service.is_active ? 'verified' : 'status'}>
                    {service.is_active ? 'Active' : 'Archived'}
                  </AdpadzBadge>
                </div>

                {service.description && (
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {service.description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    <Clock3 className="h-3.5 w-3.5 text-neon" />
                    {service.duration_minutes ? `${service.duration_minutes} min` : 'Flexible duration'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    <DollarSign className="h-3.5 w-3.5 text-neon" />
                    {formatPrice(service.price, service.currency)}
                  </span>
                </div>

                {safeHttpUrl(service.booking_url) && (
                  <a
                    href={safeHttpUrl(service.booking_url) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-neon hover:underline"
                  >
                    Booking page <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <AdpadzButton type="button" variant="secondary" size="sm" onClick={() => editService(service)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </AdpadzButton>
                  <AdpadzButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void toggleServiceActive(service)}
                    disabled={updatingId === service.id}
                  >
                    {updatingId === service.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : service.is_active
                        ? <Archive className="h-3.5 w-3.5" />
                        : <RotateCcw className="h-3.5 w-3.5" />}
                    {service.is_active ? 'Archive' : 'Activate'}
                  </AdpadzButton>
                </div>
              </AdpadzCard>
            ))}
          </div>
        )}

        <AdpadzCard variant="flat" className="mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black">Ready to show these services to customers?</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Open a Smart Card to manage its service placement and public booking experience.
            </p>
          </div>
          <AdpadzButton href="/app/business/smart-cards" variant="secondary" size="sm">
            Open Smart Cards
          </AdpadzButton>
        </AdpadzCard>
      </AdpadzSection>
    </div>
  );
}

async function fetchServiceLibrary(): Promise<ServiceLibrary> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  const userId = authData.user?.id;
  if (!userId) throw new Error('Sign in to load the Service Library.');

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) return { ownerId: userId, businessId: null, services: [] };

  const { data: services, error: servicesError } = await supabase
    .from('business_services')
    .select('*')
    .eq('business_id', business.id)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });
  if (servicesError) throw new Error(servicesError.message);

  return {
    ownerId: userId,
    businessId: business.id,
    services: (services ?? []) as ServiceRecord[],
  };
}

function toServiceForm(service: ServiceRecord): ServiceForm {
  return {
    name: service.name,
    description: service.description ?? '',
    duration_minutes: service.duration_minutes ? String(service.duration_minutes) : '',
    price: service.price === null ? '' : String(service.price),
    currency: service.currency ?? 'USD',
    booking_url: service.booking_url ?? '',
    sort_order: String(service.sort_order),
    is_active: service.is_active,
  };
}

function parseOptionalPositiveInteger(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a whole number greater than zero.`);
  }
  return parsed;
}

function parseOptionalPrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (
    !/^(?:\d+|\d*\.\d{1,2})$/.test(trimmed)
    || !Number.isFinite(parsed)
    || parsed < 0
    || parsed > 9_999_999_999.99
  ) {
    throw new Error('Price must be a non-negative amount with no more than two decimal places.');
  }
  return parsed;
}

function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Currency must be a three-letter code such as USD.');
  }
  return currency;
}

function normalizeOptionalBookingUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Booking URL must be a complete web address beginning with http:// or https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Booking URL must use http:// or https://.');
  }
  return parsed.toString();
}

function parseSortOrder(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Display order must be a whole number of zero or greater.');
  }
  return parsed;
}

function formatPrice(price: number | string | null, currency: string | null): string {
  if (price === null) return 'Price not set';
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return 'Price not set';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency ?? 'USD',
    }).format(numericPrice);
  } catch {
    return `${currency ?? ''} ${numericPrice.toFixed(2)}`.trim();
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
