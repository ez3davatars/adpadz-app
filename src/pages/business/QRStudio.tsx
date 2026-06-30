import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Upload,
  X,
  Sparkles,
} from 'lucide-react';
import CircularPadQR from '../../components/qr/CircularPadQR';
import { supabase } from '../../lib/supabase';
import type { QRFormState, QRLinkRecord, QRStylePreset } from '../../lib/qr/qrTypes';
import {
  buildShortUrl,
  createSlugFromTitle,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  formatDateTime,
  getPublicAppUrl,
  makeDownloadFilename,
  normalizeSlug,
  parseTags,
  shortUrlUsesLocalhostInProduction,
  validateHttpUrl,
} from '../../lib/qr/qrUtils';
import { buildSmartCardUrl, type BusinessCardRecord } from '../../lib/smartCards';

const DEFAULT_FORM: QRFormState = {
  title: 'Jacksonville Advertiser Flyer',
  slug: 'jacksonville-advertisers',
  destination_url: 'https://adpadz.co/advertise',
  destination_type: 'url',
  destination_id: '',
  campaign_name: 'Jacksonville Launch',
  purpose: 'Advertiser acquisition',
  source: 'printed flyer',
  medium: 'qr',
  tags: 'jacksonville, sales, advertiser',
  style_preset: 'circular-pad',
  top_ring_text: 'Adpadz Local Advertising Cooperative',
  bottom_ring_text: 'Support Local • Save Local • Discover More',
  center_label: 'Adpadz',
  foreground_color: '#111111',
  background_color: '#f1f1ef',
  accent_color: '#8EDB39',
  show_center_label: true,
  show_short_url: true,
  logo_data_url: '',
  center_frame_shape: 'rounded-rect',
  center_frame_stroke_color: '#111111',
  center_frame_fill_color: '#ffffff',
  rim_decoration: 'none',
  rim_band_color: '#f1f1ef',
  rim_text_color: '#111111',
  inner_field_color: '#ffffff',
  outer_border_color: '#111111',
  outer_background_type: 'none',
  outer_background_color: '#f1f1ef',
  outer_background_image_data_url: '',
  outer_background_image_opacity: 0.65,
  outer_background_image_fit: 'cover',
  outer_background_overlay_color: 'transparent',
  ornament_style: 'wave-premium',
  ornament_main_color: '#111111',
  ornament_accent_color: '#8EDB39',
  ornament_shadow_color: '#D8D8D2',
  ornament_opacity: 1,
};

const STYLE_OPTIONS: Array<{ value: QRStylePreset; label: string; description: string }> = [
  {
    value: 'circular-pad',
    label: 'Circular Pad QR',
    description: 'Premium double-ring badge with a framed logo area.',
  },
  {
    value: 'digital-pad',
    label: 'Digital Pad QR',
    description: 'Stronger Adpadz glow treatment for screens and decks.',
  },
  {
    value: 'standard',
    label: 'Standard QR',
    description: 'Plain fallback for small or difficult print placements.',
  },
];

export default function QRStudio() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [form, setForm] = useState<QRFormState>(DEFAULT_FORM);
  const [links, setLinks] = useState<QRLinkRecord[]>([]);
  const [businessCards, setBusinessCards] = useState<BusinessCardRecord[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [publicAppUrl] = useState(getPublicAppUrl());
  const [advancedBaseUrlOpen, setAdvancedBaseUrlOpen] = useState(false);
  const [manualBaseUrl, setManualBaseUrl] = useState('');
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedSlug = useMemo(() => normalizeSlug(form.slug), [form.slug]);
  const baseUrl = useMemo(() => {
    const override = manualBaseUrl.trim();
    return advancedBaseUrlOpen && override ? override.replace(/\/+$/g, '') : publicAppUrl;
  }, [advancedBaseUrlOpen, manualBaseUrl, publicAppUrl]);
  const shortUrl = useMemo(() => buildShortUrl(normalizedSlug || 'demo', baseUrl), [baseUrl, normalizedSlug]);
  const shortLabel = useMemo(() => shortUrl.replace(/^https?:\/\//, ''), [shortUrl]);
  const selectedLink = useMemo(
    () => links.find(link => link.id === selectedLinkId) ?? null,
    [links, selectedLinkId],
  );
  const selectedBusinessCard = useMemo(
    () => businessCards.find(card => card.id === form.destination_id) ?? null,
    [businessCards, form.destination_id],
  );
  const effectiveDestinationUrl = useMemo(() => {
    return form.destination_type === 'business_card' && selectedBusinessCard
      ? buildSmartCardUrl(selectedBusinessCard.slug, baseUrl)
      : form.destination_url;
  }, [baseUrl, form.destination_type, form.destination_url, selectedBusinessCard]);
  const productionLocalhostError = useMemo(() => {
    return shortUrlUsesLocalhostInProduction(shortUrl)
      ? 'Production QR links cannot use localhost. Check VITE_PUBLIC_APP_URL.'
      : null;
  }, [shortUrl]);

  const shortLinkHostWarning = useMemo(() => {
    const shortLinkHost = getHostname(baseUrl);
    const destinationHost = getHostname(effectiveDestinationUrl);

    if (form.destination_type === 'url' && shortLinkHost && destinationHost && shortLinkHost === destinationHost) {
      return 'The short link should use the Adpadz domain, not the destination website.';
    }

    return null;
  }, [baseUrl, effectiveDestinationUrl, form.destination_type]);

  useEffect(() => {
    void loadLinks();
    void loadBusinessCards();
  }, []);

  async function loadLinks() {
    setLoadingLinks(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Sign in before loading QR links.');
      setLinks([]);
      setLoadingLinks(false);
      return;
    }

    const { data, error } = await supabase
      .from('qr_links')
      .select('*')
      .eq('owner_user_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setLinks([]);
    } else {
      setLinks((data ?? []) as QRLinkRecord[]);
    }

    setLoadingLinks(false);
  }

  async function loadBusinessCards() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setBusinessCards([]);
      return;
    }

    const { data, error } = await supabase
      .from('business_cards')
      .select('*')
      .eq('owner_user_id', authData.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      setBusinessCards([]);
    } else {
      setBusinessCards((data ?? []) as BusinessCardRecord[]);
    }
  }
  function updateField<K extends keyof QRFormState>(key: K, value: QRFormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function handleTitleChange(title: string) {
    setForm(current => ({
      ...current,
      title,
      slug: selectedLinkId ? current.slug : createSlugFromTitle(title),
    }));
  }

  function handleLogoUpload(file: File | null) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateField('logo_data_url', typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  }

  function handleOuterBackgroundImageUpload(file: File | null) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateField('outer_background_image_data_url', typeof reader.result === 'string' ? reader.result : '');
      updateField('outer_background_type', 'image');
    };
    reader.readAsDataURL(file);
  }

  function startNewLink() {
    setSelectedLinkId(null);
    setForm({
      ...DEFAULT_FORM,
      title: 'New Adpadz QR Link',
      slug: `adpadz-${Date.now().toString(36)}`,
    });
    setMessage(null);
    setError(null);
  }

  function editLink(link: QRLinkRecord) {
    setSelectedLinkId(link.id);
    setForm({
      title: link.title,
      slug: link.slug,
      destination_url: link.destination_url,
      destination_type: link.destination_type ?? 'url',
      destination_id: link.destination_id ?? '',
      campaign_name: link.campaign_name ?? '',
      purpose: link.purpose ?? '',
      source: link.source ?? '',
      medium: link.medium ?? 'qr',
      tags: (link.tags ?? []).join(', '),
      style_preset: link.style_preset,
      top_ring_text: link.top_ring_text ?? DEFAULT_FORM.top_ring_text,
      bottom_ring_text: link.bottom_ring_text ?? DEFAULT_FORM.bottom_ring_text,
      center_label: link.center_label ?? 'adpadz',
      foreground_color: link.foreground_color,
      background_color: link.background_color,
      accent_color: link.accent_color,
      show_center_label: link.show_center_label,
      show_short_url: link.show_short_url,
      logo_data_url: '',
      center_frame_shape: DEFAULT_FORM.center_frame_shape,
      center_frame_stroke_color: DEFAULT_FORM.center_frame_stroke_color,
      center_frame_fill_color: DEFAULT_FORM.center_frame_fill_color,
      rim_decoration: DEFAULT_FORM.rim_decoration,
      rim_band_color: link.background_color || DEFAULT_FORM.rim_band_color,
      rim_text_color: DEFAULT_FORM.rim_text_color,
      inner_field_color: DEFAULT_FORM.inner_field_color,
      outer_border_color: DEFAULT_FORM.outer_border_color,
      outer_background_type: DEFAULT_FORM.outer_background_type,
      outer_background_color: DEFAULT_FORM.outer_background_color,
      outer_background_image_data_url: '',
      outer_background_image_opacity: DEFAULT_FORM.outer_background_image_opacity,
      outer_background_image_fit: DEFAULT_FORM.outer_background_image_fit,
      outer_background_overlay_color: DEFAULT_FORM.outer_background_overlay_color,
      ornament_style: DEFAULT_FORM.ornament_style,
      ornament_main_color: DEFAULT_FORM.ornament_main_color,
      ornament_accent_color: DEFAULT_FORM.ornament_accent_color,
      ornament_shadow_color: DEFAULT_FORM.ornament_shadow_color,
      ornament_opacity: DEFAULT_FORM.ornament_opacity,
    });
    setMessage(null);
    setError(null);
  }

  async function saveLink() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const slug = normalizeSlug(form.slug);

    if (!slug) {
      setSaving(false);
      setError('Add a short slug before saving.');
      return;
    }

    if (form.destination_type === 'business_card' && !selectedBusinessCard) {
      setSaving(false);
      setError('Choose a smart card destination before saving.');
      return;
    }

    if (!validateHttpUrl(effectiveDestinationUrl)) {
      setSaving(false);
      setError('Destination URL must start with http:// or https://.');
      return;
    }

    if (productionLocalhostError) {
      setSaving(false);
      setError(productionLocalhostError);
      return;
    }

    const payload = {
      title: form.title.trim() || slug,
      slug,
      destination_url: effectiveDestinationUrl.trim(),
      destination_type: form.destination_type,
      destination_id: form.destination_type === 'business_card' ? form.destination_id : null,
      campaign_name: form.campaign_name.trim() || null,
      purpose: form.purpose.trim() || null,
      source: form.source.trim() || null,
      medium: form.medium.trim() || 'qr',
      tags: parseTags(form.tags),
      style_preset: form.style_preset,
      top_ring_text: form.top_ring_text.trim() || DEFAULT_FORM.top_ring_text,
      bottom_ring_text: form.bottom_ring_text.trim() || DEFAULT_FORM.bottom_ring_text,
      center_label: form.center_label.trim() || 'adpadz',
      foreground_color: form.foreground_color,
      background_color: form.background_color,
      accent_color: form.accent_color,
      show_center_label: form.show_center_label,
      show_short_url: form.show_short_url,
      status: 'active',
    };

    const query = selectedLinkId
      ? supabase.from('qr_links').update(payload).eq('id', selectedLinkId).select().single()
      : supabase.from('qr_links').insert(payload).select().single();

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else if (data) {
      const savedLink = data as QRLinkRecord;
      setSelectedLinkId(savedLink.id);
      setForm(current => ({ ...current, slug: savedLink.slug }));
      setMessage('QR link saved. The short link is now active.');
      await loadLinks();
    }

    setSaving(false);
  }

  async function copyShortLink() {
    if (productionLocalhostError) {
      setError(productionLocalhostError);
      return;
    }

    await navigator.clipboard.writeText(shortUrl);
    setMessage('Short link copied.');
  }

  function downloadSvg() {
    if (!svgRef.current) return;

    if (productionLocalhostError) {
      setError(productionLocalhostError);
      return;
    }

    downloadSvgElementAsSvg(svgRef.current, makeDownloadFilename(normalizedSlug, 'svg'));
  }

  function downloadPng() {
    if (!svgRef.current) return;

    if (productionLocalhostError) {
      setError(productionLocalhostError);
      return;
    }

    downloadSvgElementAsPng(svgRef.current, makeDownloadFilename(normalizedSlug, 'png'), 1);
  }

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-neon/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-neon" />
            </div>
            <span className="badge badge-active">First working feature</span>
          </div>
          <h1 className="text-2xl font-bold">Adpadz QR Studio</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">
            Create circular Pad QRs for Adpadz marketing, advertiser acquisition, community mailers, offers, and future campaign tracking.
          </p>
        </div>
        <button onClick={startNewLink} className="btn-primary text-sm px-5 py-2.5">
          <Plus className="w-4 h-4" /> New QR Link
        </button>
      </div>

      {(message || error) && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
            error ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-neon/30 bg-neon/10 text-neon'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_420px] gap-5">
        <div className="space-y-5">
          <div className="card-surface p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold">Link setup</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">The QR encodes the Adpadz short link. The destination can be changed later.</p>
              </div>
              {selectedLink && (
                <span className="text-xs text-[var(--text-muted)]">Saved {formatDateTime(selectedLink.updated_at)}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="QR title">
                <input
                  className="input-field"
                  value={form.title}
                  onChange={event => handleTitleChange(event.target.value)}
                  placeholder="Jacksonville Advertiser Flyer"
                />
              </Field>
              <Field label="Short slug">
                <input
                  className="input-field"
                  value={form.slug}
                  onChange={event => updateField('slug', normalizeSlug(event.target.value))}
                  placeholder="jacksonville-advertisers"
                />
              </Field>
              <Field label="Destination type">
                <select
                  className="input-field"
                  value={form.destination_type}
                  onChange={event => updateField('destination_type', event.target.value as QRFormState['destination_type'])}
                >
                  <option value="url">Website or landing page</option>
                  <option value="business_card">Smart Card</option>
                </select>
              </Field>
              {form.destination_type === 'business_card' ? (
                <Field label="Smart Card destination">
                  <select
                    className="input-field"
                    value={form.destination_id}
                    onChange={event => updateField('destination_id', event.target.value)}
                  >
                    <option value="">Choose a smart card</option>
                    {businessCards.map(card => (
                      <option key={card.id} value={card.id}>
                        {card.business_name}{card.is_published ? '' : ' (unpublished)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Scans open {selectedBusinessCard ? `/c/${selectedBusinessCard.slug}` : 'the selected public smart card'} and track QR analytics.
                  </p>
                </Field>
              ) : (
                <Field label="Destination URL">
                  <input
                    className="input-field"
                    value={form.destination_url}
                    onChange={event => updateField('destination_url', event.target.value)}
                    placeholder="https://aulicinoveteransclaims.com/"
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">Where visitors go after scanning.</p>
                </Field>
              )}
              <Field label="Short link base URL">
                <input
                  className={`input-field ${advancedBaseUrlOpen ? '' : 'opacity-80 cursor-not-allowed'}`}
                  value={advancedBaseUrlOpen ? manualBaseUrl : baseUrl}
                  onChange={event => setManualBaseUrl(event.target.value)}
                  readOnly={!advancedBaseUrlOpen}
                  placeholder="https://adpadz.co"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  This is the Adpadz short-link domain, not the advertiser destination website.
                </p>
                <button
                  type="button"
                  onClick={() => setAdvancedBaseUrlOpen(open => !open)}
                  className="btn-ghost text-xs mt-2 px-0"
                >
                  {advancedBaseUrlOpen ? 'Hide advanced override' : 'Advanced: override base URL'}
                </button>
              </Field>
              <Field label="Generated Adpadz short link">
                <div className="flex gap-2">
                  <input className="input-field" value={shortUrl} readOnly />
                  <button onClick={copyShortLink} className="btn-secondary px-4" aria-label="Copy short link">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {productionLocalhostError && (
                  <p className="text-[11px] text-red-300 mt-1">{productionLocalhostError}</p>
                )}
                {shortLinkHostWarning && !productionLocalhostError && (
                  <p className="text-[11px] text-amber-300 mt-1">{shortLinkHostWarning}</p>
                )}
              </Field>
            </div>
          </div>

          <div className="card-surface p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-neon" />
              <h2 className="text-sm font-semibold">Circular Pad QR design</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {STYLE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => updateField('style_preset', option.value)}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    form.style_preset === option.value
                      ? 'border-neon bg-neon/10'
                      : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-neon/50'
                  }`}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{option.description}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Top ring text">
                <input
                  className="input-field"
                  value={form.top_ring_text}
                  onChange={event => updateField('top_ring_text', event.target.value)}
                />
              </Field>
              <Field label="Bottom ring text">
                <input
                  className="input-field"
                  value={form.bottom_ring_text}
                  onChange={event => updateField('bottom_ring_text', event.target.value)}
                />
              </Field>
              <Field label="Center fallback label">
                <input
                  className="input-field"
                  value={form.center_label}
                  onChange={event => updateField('center_label', event.target.value.slice(0, 14))}
                />
              </Field>
              <Field label="Tags">
                <input
                  className="input-field"
                  value={form.tags}
                  onChange={event => updateField('tags', event.target.value)}
                  placeholder="jacksonville, sales, flyer"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <ColorField label="QR color" value={form.foreground_color} onChange={value => updateField('foreground_color', value)} />
              <ColorField label="Inner QR field" value={form.inner_field_color} onChange={value => updateField('inner_field_color', value)} />
              <ColorField label="Rim band" value={form.rim_band_color} onChange={value => updateField('rim_band_color', value)} />
              <ColorField label="Rim text" value={form.rim_text_color} onChange={value => updateField('rim_text_color', value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <ColorField label="Outer border" value={form.outer_border_color} onChange={value => updateField('outer_border_color', value)} />
              <ColorField label="Accent" value={form.accent_color} onChange={value => updateField('accent_color', value)} />
              <ColorField
                label="Center frame border"
                value={form.center_frame_stroke_color}
                onChange={value => updateField('center_frame_stroke_color', value)}
              />
              <ColorField
                label="Center frame fill"
                value={form.center_frame_fill_color}
                onChange={value => updateField('center_frame_fill_color', value)}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
              <h3 className="text-sm font-semibold mb-3">Premium ornaments</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Ornament style">
                  <select
                    className="input-field"
                    value={form.ornament_style}
                    onChange={event => updateField('ornament_style', event.target.value as QRFormState['ornament_style'])}
                  >
                    <option value="wave-premium">Wave premium</option>
                    <option value="none">None</option>
                  </select>
                </Field>
                <Field label={`Ornament opacity ${Math.round(form.ornament_opacity * 100)}%`}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={form.ornament_opacity}
                    onChange={event => updateField('ornament_opacity', Number(event.target.value))}
                    className="w-full accent-lime-400"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <ColorField
                  label="Ornament main"
                  value={form.ornament_main_color}
                  onChange={value => updateField('ornament_main_color', value)}
                />
                <ColorField
                  label="Ornament accent"
                  value={form.ornament_accent_color}
                  onChange={value => updateField('ornament_accent_color', value)}
                />
                <ColorField
                  label="Ornament shadow"
                  value={form.ornament_shadow_color}
                  onChange={value => updateField('ornament_shadow_color', value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field label="Logo upload">
                <div className="flex gap-2">
                  <label className="btn-secondary px-4 py-3 text-sm cursor-pointer flex-1 justify-center">
                    <Upload className="w-4 h-4" /> Upload logo
                    <input
                      type="file"
                      accept="image/*,.svg"
                      className="hidden"
                      onChange={event => handleLogoUpload(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {form.logo_data_url && (
                    <button
                      type="button"
                      onClick={() => updateField('logo_data_url', '')}
                      className="btn-secondary px-4"
                      aria-label="Remove logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Field>

              <Field label="Center frame shape">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('center_frame_shape', 'rounded-rect')}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      form.center_frame_shape === 'rounded-rect'
                        ? 'border-neon bg-neon/10 text-neon'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    Rounded
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('center_frame_shape', 'circle')}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      form.center_frame_shape === 'circle'
                        ? 'border-neon bg-neon/10 text-neon'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    Circle
                  </button>
                </div>
              </Field>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
              <h3 className="text-sm font-semibold mb-3">Outer background</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                {(['none', 'solid', 'gradient', 'image', 'pattern'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateField('outer_background_type', type)}
                    className={`px-3 py-2 rounded-xl border text-xs font-medium capitalize transition-colors ${
                      form.outer_background_type === type
                        ? 'border-neon bg-neon/10 text-neon'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    {type === 'none' ? 'Transparent' : type}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorField
                  label="Background color"
                  value={form.outer_background_color}
                  onChange={value => updateField('outer_background_color', value)}
                />
                <ColorField
                  label="Overlay color"
                  value={form.outer_background_overlay_color === 'transparent' ? '#ffffff' : form.outer_background_overlay_color}
                  onChange={value => updateField('outer_background_overlay_color', value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Field label="Background image">
                  <div className="flex gap-2">
                    <label className="btn-secondary px-4 py-3 text-sm cursor-pointer flex-1 justify-center">
                      <Upload className="w-4 h-4" /> Upload background
                      <input
                        type="file"
                        accept="image/*,.svg"
                        className="hidden"
                        onChange={event => handleOuterBackgroundImageUpload(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    {form.outer_background_image_data_url && (
                      <button
                        type="button"
                        onClick={() => updateField('outer_background_image_data_url', '')}
                        className="btn-secondary px-4"
                        aria-label="Remove background image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Image fit">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateField('outer_background_image_fit', 'cover')}
                      className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        form.outer_background_image_fit === 'cover'
                          ? 'border-neon bg-neon/10 text-neon'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      Cover
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('outer_background_image_fit', 'contain')}
                      className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        form.outer_background_image_fit === 'contain'
                          ? 'border-neon bg-neon/10 text-neon'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      Contain
                    </button>
                  </div>
                </Field>
              </div>

              <Field label={`Image opacity ${Math.round(form.outer_background_image_opacity * 100)}%`} className="mt-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={form.outer_background_image_opacity}
                  onChange={event => updateField('outer_background_image_opacity', Number(event.target.value))}
                  className="w-full accent-lime-400"
                />
              </Field>

              <div className="flex flex-wrap gap-3 mt-4">
                <Toggle
                  label="Transparent background"
                  checked={form.outer_background_type === 'none'}
                  onChange={checked => updateField('outer_background_type', checked ? 'none' : 'solid')}
                />
                <Toggle
                  label="No overlay"
                  checked={form.outer_background_overlay_color === 'transparent'}
                  onChange={checked => updateField('outer_background_overlay_color', checked ? 'transparent' : '#ffffff')}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <Toggle
                label="Show center logo"
                checked={form.show_center_label}
                onChange={value => updateField('show_center_label', value)}
              />
              <Toggle
                label="Show URL badge"
                checked={form.show_short_url}
                onChange={value => updateField('show_short_url', value)}
              />
            </div>
          </div>

          <div className="card-surface p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Campaign">
                <input className="input-field" value={form.campaign_name} onChange={event => updateField('campaign_name', event.target.value)} />
              </Field>
              <Field label="Purpose">
                <input className="input-field" value={form.purpose} onChange={event => updateField('purpose', event.target.value)} />
              </Field>
              <Field label="Source">
                <input className="input-field" value={form.source} onChange={event => updateField('source', event.target.value)} />
              </Field>
              <Field label="Medium">
                <input className="input-field" value={form.medium} onChange={event => updateField('medium', event.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card-surface p-5 sticky top-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Live preview</h2>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em]">High EC</span>
            </div>

            <div className="rounded-[2rem] bg-white p-3 shadow-2xl shadow-black/40">
              <CircularPadQR
                ref={svgRef}
                value={shortUrl}
                title={form.title}
                topText={form.top_ring_text}
                bottomText={form.bottom_ring_text}
                centerLabel={form.center_label || 'adpadz'}
                shortLabel={shortLabel}
                preset={form.style_preset}
                foregroundColor={form.foreground_color}
                backgroundColor={form.background_color}
                accentColor={form.accent_color}
                showCenterLabel={form.show_center_label}
                showShortLabel={form.show_short_url}
                logoDataUrl={form.logo_data_url}
                centerFrameShape={form.center_frame_shape}
                centerFrameStrokeColor={form.center_frame_stroke_color}
                centerFrameFillColor={form.center_frame_fill_color}
                rimDecoration={form.rim_decoration}
                rimBandColor={form.rim_band_color}
                rimTextColor={form.rim_text_color}
                innerFieldColor={form.inner_field_color}
                outerBorderColor={form.outer_border_color}
                outerBackgroundType={form.outer_background_type}
                outerBackgroundColor={form.outer_background_color}
                outerBackgroundImageDataUrl={form.outer_background_image_data_url}
                outerBackgroundImageOpacity={form.outer_background_image_opacity}
                outerBackgroundImageFit={form.outer_background_image_fit}
                outerBackgroundOverlayColor={form.outer_background_overlay_color}
                ornamentStyle={form.ornament_style}
                ornamentMainColor={form.ornament_main_color}
                ornamentAccentColor={form.ornament_accent_color}
                ornamentShadowColor={form.ornament_shadow_color}
                ornamentOpacity={form.ornament_opacity}
                className="w-full h-auto block"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={downloadPng} className="btn-primary text-sm px-4 py-2.5">
                <Download className="w-4 h-4" /> PNG
              </button>
              <button onClick={downloadSvg} className="btn-secondary text-sm px-4 py-2.5">
                <Download className="w-4 h-4" /> SVG
              </button>
            </div>

            <button onClick={saveLink} disabled={saving} className="btn-secondary w-full text-sm px-4 py-2.5 mt-3">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {selectedLinkId ? 'Save Changes' : 'Save Dynamic Link'}
            </button>

            {!selectedLinkId && (
              <p className="text-[11px] text-[var(--text-muted)] mt-3 leading-relaxed">
                Save the QR link before printing. The downloaded QR already encodes this short link, but the redirect only works after the link exists in Supabase.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card-surface p-5 mt-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">Saved QR links</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">These are ready for Adpadz internal marketing and future campaign attachment.</p>
          </div>
          <button onClick={() => void loadLinks()} className="btn-ghost text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {loadingLinks ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading QR links...
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center">
            <QrCode className="w-8 h-8 text-neon mx-auto mb-3" />
            <p className="text-sm font-medium">No saved QR links yet.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Create the first Adpadz Pad QR and use it on your sales material.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {links.map(link => (
              <button
                key={link.id}
                onClick={() => editLink(link)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  selectedLinkId === link.id
                    ? 'border-neon bg-neon/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-neon/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{link.title}</p>
                    <p className="text-xs text-neon mt-1 truncate">/q/{link.slug}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">{link.destination_url}</p>
                  </div>
                  <span className="badge badge-active capitalize">{link.status}</span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-4 text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-neon" /> {link.scan_count.toLocaleString()} scans
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> Updated {formatDateTime(link.updated_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={event => onChange(event.target.value)}
          className="h-12 w-14 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-1"
        />
        <input className="input-field" value={value} onChange={event => onChange(event.target.value)} />
      </div>
    </Field>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
        checked
          ? 'border-neon bg-neon/10 text-neon'
          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${checked ? 'bg-neon' : 'bg-[var(--text-muted)]'}`} />
      {label}
    </button>
  );
}








