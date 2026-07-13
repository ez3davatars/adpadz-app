import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, FileText, Image, Link as LinkIcon, Loader2, Pencil, Plus, Save, Upload, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadSmartCardImage, type UploadProgress } from '../../lib/cloudflareImages';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzEmptyState, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';

type AssetRecord = {
  id: string;
  business_id: string | null;
  smart_card_id: string | null;
  owner_id: string | null;
  asset_type: string;
  title: string;
  description: string | null;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  provider: string | null;
  provider_asset_id: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  is_active: boolean;
};

type AssetForm = {
  title: string;
  description: string;
  asset_type: string;
  file_url: string;
  external_url: string;
  provider: string;
  provider_asset_id: string;
  mime_type: string;
  file_size_bytes: number | null;
};

const emptyForm: AssetForm = { title: '', description: '', asset_type: 'image', file_url: '', external_url: '', provider: '', provider_asset_id: '', mime_type: '', file_size_bytes: null };
const assetTypes = ['image', 'logo', 'cover', 'gallery', 'video', 'brochure', 'menu', 'virtual_tour', 'before_after', 'testimonial', 'coupon', 'document', 'other'];

export default function BizAssets() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAssets(() => cancelled);
    return () => { cancelled = true; };
  }, []);

  async function loadAssets(isCancelled: () => boolean = () => false) {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      const userId = authData.user?.id;
      if (!userId) throw new Error('Sign in to load the Asset Library.');

      const [businessResult, cardResult, assetResult] = await Promise.all([
        supabase.from('businesses').select('id').eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('business_cards').select('id,business_id').eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('business_marketing_assets').select('*').eq('owner_id', userId).order('sort_order', { ascending: true }).order('updated_at', { ascending: false }),
      ]);
      if (businessResult.error) throw new Error(businessResult.error.message);
      if (cardResult.error) throw new Error(cardResult.error.message);
      if (assetResult.error) throw new Error(assetResult.error.message);

      if (!isCancelled()) {
        setOwnerId(userId);
        setBusinessId(businessResult.data?.id || cardResult.data?.business_id || null);
        setCardId(cardResult.data?.id || null);
        setAssets((assetResult.data ?? []) as AssetRecord[]);
        setLoading(false);
      }
    } catch (loadError) {
      if (!isCancelled()) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load the Asset Library.');
        setLoading(false);
      }
    }
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  function editAsset(asset: AssetRecord) {
    setEditingId(asset.id);
    setForm({
      title: asset.title,
      description: asset.description || '',
      asset_type: asset.asset_type,
      file_url: asset.file_url || '',
      external_url: asset.external_url || '',
      provider: asset.provider || '',
      provider_asset_id: asset.provider_asset_id || '',
      mime_type: asset.mime_type || '',
      file_size_bytes: asset.file_size_bytes,
    });
    setMessage(null);
    setError(null);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function uploadFile(file: File | null) {
    if (!file) return;
    if (!cardId) {
      setError('Create a Business Profile before uploading hosted images. You can still save a web URL as an asset.');
      return;
    }
    setUploading(true);
    setUploadProgress(null);
    setError(null);
    try {
      const result = await uploadSmartCardImage({ file, cardId, imageType: 'gallery', onProgress: setUploadProgress });
      setForm(current => ({
        ...current,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
        asset_type: current.asset_type === 'video' ? 'image' : current.asset_type,
        file_url: result.imageUrl,
        provider: 'cloudflare_images',
        provider_asset_id: result.imageId,
        mime_type: file.type,
        file_size_bytes: file.size,
      }));
      setMessage('Image uploaded. Save the asset to add it to the Business Hub.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload this image.');
    } finally {
      setUploading(false);
    }
  }

  async function saveAsset() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!ownerId) throw new Error('Sign in before saving an asset.');
      if (!businessId) throw new Error('Save Business Settings before creating Business Hub assets.');
      if (!form.title.trim()) throw new Error('Asset title is required.');
      const fileUrl = normalizeOptionalUrl(form.file_url);
      const externalUrl = normalizeOptionalUrl(form.external_url);
      if (!fileUrl && !externalUrl) throw new Error('Add an uploaded file or a destination URL.');

      const payload = {
        business_id: businessId,
        smart_card_id: cardId,
        owner_id: ownerId,
        asset_type: form.asset_type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        file_url: fileUrl,
        external_url: externalUrl,
        thumbnail_url: fileUrl,
        provider: form.provider || null,
        provider_asset_id: form.provider_asset_id || null,
        mime_type: form.mime_type || null,
        file_size_bytes: form.file_size_bytes,
        is_active: true,
      };
      const result = editingId
        ? await supabase.from('business_marketing_assets').update(payload).eq('id', editingId).select('*').single()
        : await supabase.from('business_marketing_assets').insert(payload).select('*').single();
      if (result.error || !result.data) throw new Error(result.error?.message ?? 'Could not save the asset.');

      const { data: reloaded, error: reloadError } = await supabase.from('business_marketing_assets').select('*').eq('id', result.data.id).single();
      if (reloadError || !reloaded) throw new Error(reloadError?.message ?? 'Could not verify the saved asset.');
      setAssets(current => [reloaded as AssetRecord, ...current.filter(asset => asset.id !== reloaded.id)]);
      setEditingId(reloaded.id);
      setMessage('Asset saved to the Business Hub.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the asset.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveAsset(asset: AssetRecord) {
    setError(null);
    setMessage(null);
    const { data, error: archiveError } = await supabase.from('business_marketing_assets').update({ is_active: !asset.is_active }).eq('id', asset.id).select('*').single();
    if (archiveError || !data) {
      setError(archiveError?.message ?? 'Could not update the asset.');
      return;
    }
    setAssets(current => current.map(item => item.id === asset.id ? data as AssetRecord : item));
    setMessage(data.is_active ? 'Asset restored.' : 'Asset archived. Existing historical references are preserved.');
  }

  const activeCount = assets.filter(asset => asset.is_active).length;
  const imageCount = assets.filter(asset => ['image', 'logo', 'cover', 'gallery', 'before_after'].includes(asset.asset_type)).length;
  const documentCount = assets.filter(asset => ['document', 'brochure', 'menu'].includes(asset.asset_type)).length;
  const selectedPreview = form.file_url || form.external_url;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">Asset Library</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Upload or reference each asset once, then select it from Campaign Studio and customer-facing outputs.</p>
        </div>
        <AdpadzButton type="button" onClick={startNew} size="lg"><Plus className="h-4 w-4" /> Add Asset</AdpadzButton>
      </div>

      {(error || message) && <AdpadzCard variant="flat" className={`p-4 text-sm font-bold ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-neon/30 bg-neon/10 text-neon'}`} role={error ? 'alert' : 'status'}>{error || message}</AdpadzCard>}
      {!loading && !businessId && <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-100">Save your permanent Business Hub record before creating shared assets. <AdpadzButton href="/app/business/settings" variant="secondary" size="sm" className="ml-2">Open Settings</AdpadzButton></AdpadzCard>}

      <div className="grid gap-3 sm:grid-cols-3">
        <AdpadzMetricCard icon={Image} label="Active assets" value={String(activeCount)} detail="Available across Campaign Studio and profiles" />
        <AdpadzMetricCard icon={Video} label="Visual assets" value={String(imageCount)} detail="Images, covers, galleries, and comparisons" />
        <AdpadzMetricCard icon={FileText} label="Documents" value={String(documentCount)} detail="Menus, brochures, and documents" />
      </div>

      <div ref={editorRef}>
        <AdpadzSection eyebrow={editingId ? 'Edit asset' : 'New asset'} title="Reusable Business Hub asset" description="Hosted image uploads require a Business Profile so ownership can be verified. Any HTTPS asset can also be referenced by URL.">
          <div className="grid gap-6 xl:grid-cols-[1fr_0.55fr]">
            <div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title"><input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className="input-field" placeholder="Summer campaign hero" /></Field>
                <Field label="Type"><select value={form.asset_type} onChange={event => setForm(current => ({ ...current, asset_type: event.target.value }))} className="input-field">{assetTypes.map(type => <option key={type} value={type}>{formatType(type)}</option>)}</select></Field>
              </div>
              <Field label="Description" className="mt-4"><textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="input-field resize-y" rows={3} /></Field>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Hosted file URL"><input type="url" value={form.file_url} onChange={event => setForm(current => ({ ...current, file_url: event.target.value }))} className="input-field" placeholder="https://..." /></Field>
                <Field label="External destination URL"><input type="url" value={form.external_url} onChange={event => setForm(current => ({ ...current, external_url: event.target.value }))} className="input-field" placeholder="https://..." /></Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className={`btn-secondary cursor-pointer px-4 py-3 text-sm ${uploading ? 'pointer-events-none opacity-55' : ''}`}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploadProgress?.label || 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading || !cardId} onChange={event => void uploadFile(event.target.files?.[0] ?? null)} />
                </label>
                <AdpadzButton type="button" onClick={() => void saveAsset()} disabled={saving || !businessId}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Asset</AdpadzButton>
                {editingId && <AdpadzButton type="button" variant="ghost" onClick={startNew}>Clear</AdpadzButton>}
              </div>
              {uploading && uploadProgress && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-neon transition-all" style={{ width: `${uploadProgress.percentage}%` }} /></div>}
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              {selectedPreview && isImageLike(selectedPreview, form.asset_type) ? <img src={selectedPreview} alt="" className="aspect-square h-full w-full object-cover" /> : <div className="flex aspect-square flex-col items-center justify-center p-6 text-center text-[var(--text-muted)]"><LinkIcon className="h-8 w-8 text-neon" /><p className="mt-3 text-sm font-black">{selectedPreview ? 'Linked asset' : 'Asset preview'}</p><p className="mt-1 break-all text-[10px]">{selectedPreview || 'Upload an image or add a URL.'}</p></div>}
            </div>
          </div>
        </AdpadzSection>
      </div>

      <AdpadzSection eyebrow="Library" title="Saved assets">
        {loading ? <p className="flex items-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Loading assets...</p> : assets.length === 0 ? (
          <AdpadzEmptyState icon={<Image className="h-7 w-7" />} title="No assets yet" description="Add the first reusable image, video, document, menu, or campaign visual." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assets.map(asset => {
              const preview = asset.thumbnail_url || asset.file_url;
              return (
                <AdpadzCard key={asset.id} as="article" variant="flat" className={`overflow-hidden ${asset.is_active ? '' : 'opacity-60'}`}>
                  {preview && isImageLike(preview, asset.asset_type) ? <img src={preview} alt="" className="aspect-[16/8] w-full object-cover" /> : <div className="flex aspect-[16/8] items-center justify-center bg-white/[0.035]"><FileText className="h-8 w-8 text-neon" /></div>}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-black">{asset.title}</h2><p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatType(asset.asset_type)}</p></div><AdpadzBadge variant={asset.is_active ? 'verified' : 'status'}>{asset.is_active ? 'Active' : 'Archived'}</AdpadzBadge></div>
                    {asset.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">{asset.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-2"><AdpadzButton type="button" variant="secondary" size="sm" onClick={() => editAsset(asset)}><Pencil className="h-3.5 w-3.5" /> Edit</AdpadzButton><AdpadzButton type="button" variant="ghost" size="sm" onClick={() => void archiveAsset(asset)}><Archive className="h-3.5 w-3.5" /> {asset.is_active ? 'Archive' : 'Restore'}</AdpadzButton></div>
                  </div>
                </AdpadzCard>
              );
            })}
          </div>
        )}
      </AdpadzSection>
    </div>
  );
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">{label}</span>{children}</label>;
}

function normalizeOptionalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Asset URLs must be complete web addresses beginning with http:// or https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Asset URLs must use http:// or https://.');
  return parsed.toString();
}

function isImageLike(url: string, assetType: string): boolean {
  return ['image', 'logo', 'cover', 'gallery', 'before_after', 'testimonial', 'coupon'].includes(assetType) || /\.(?:png|jpe?g|webp)(?:\?|$)/i.test(url);
}

function formatType(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
