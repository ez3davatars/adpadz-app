import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, Film, Image, Map, QrCode, ScrollText, Upload, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';

type AssetSummary = { asset_type: string; is_active: boolean };
type GallerySummary = { id: string; is_active: boolean };
type QrSummary = { id: string; status: string };

type AssetsState = {
  marketingAssets: AssetSummary[];
  gallery: GallerySummary[];
  qrLinks: QrSummary[];
  loading: boolean;
  error: string | null;
};

const assetCategories = [
  { label: 'Images', description: 'Logos, covers, gallery images, and product visuals.', icon: Image, source: 'Business Hub assets' },
  { label: 'Videos', description: 'Local spotlight clips, reels, and service videos.', icon: Video, source: 'Business Hub assets' },
  { label: 'Commercials', description: 'Future home for polished advertising creative.', icon: Film, source: 'Business Hub assets' },
  { label: 'QR Codes', description: 'QR destinations and printed campaign entry points.', icon: QrCode, source: 'QR Studio' },
  { label: 'Documents', description: 'PDFs, proof, guides, intake forms, and handouts.', icon: FileText, source: 'Business Hub assets' },
  { label: 'Menus', description: 'Restaurant, service, and offer menus.', icon: BookOpen, source: 'Business Hub assets' },
  { label: 'Flyers', description: 'Future print and local distribution assets.', icon: ScrollText, source: 'Business Hub assets' },
  { label: 'Brochures', description: 'Longer-form business and campaign collateral.', icon: Map, source: 'Business Hub assets' },
];

export default function BizAssets() {
  const [state, setState] = useState<AssetsState>({ marketingAssets: [], gallery: [], qrLinks: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to load assets.');

        const cardsResult = await supabase.from('business_cards').select('id').eq('owner_user_id', userId);
        if (cardsResult.error) throw new Error(cardsResult.error.message);
        const cardIds = (cardsResult.data ?? []).map(card => card.id as string);

        const [marketingResult, galleryResult, qrResult] = await Promise.allSettled([
          supabase.from('business_marketing_assets').select('asset_type,is_active').eq('owner_id', userId),
          cardIds.length > 0 ? supabase.from('business_card_gallery_items').select('id,is_active').in('card_id', cardIds) : Promise.resolve({ data: [], error: null }),
          supabase.from('qr_links').select('id,status').eq('owner_user_id', userId),
        ]);

        const rows = <T,>(result: PromiseSettledResult<{ data: T[] | null; error: unknown }>) => result.status === 'fulfilled' && !result.value.error ? (result.value.data ?? []) as T[] : [];
        if (!cancelled) {
          setState({ marketingAssets: rows<AssetSummary>(marketingResult), gallery: rows<GallerySummary>(galleryResult), qrLinks: rows<QrSummary>(qrResult), loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not load assets.' }));
      }
    }

    void loadAssets();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => {
    const activeMarketing = state.marketingAssets.filter(asset => asset.is_active);
    return {
      images: state.gallery.filter(item => item.is_active).length,
      videos: activeMarketing.filter(asset => asset.asset_type === 'video').length,
      documents: activeMarketing.filter(asset => ['document', 'brochure', 'menu'].includes(asset.asset_type)).length,
      qr: state.qrLinks.length,
    };
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">Asset Library</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Future home for every reusable business asset. Campaigns reference assets instead of duplicating them.</p>
        </div>
        <AdpadzButton type="button" variant="secondary" size="lg" disabled><Upload className="h-4 w-4" /> Uploads coming soon</AdpadzButton>
      </div>

      {state.error && <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">{state.error}</AdpadzCard>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdpadzMetricCard icon={Image} label="Images" value={String(totals.images)} detail="Smart Card gallery images currently in use" />
        <AdpadzMetricCard icon={Video} label="Videos" value={String(totals.videos)} detail="Spotlight and marketing videos" />
        <AdpadzMetricCard icon={FileText} label="Documents" value={String(totals.documents)} detail="Menus, brochures, PDFs, and guides" />
        <AdpadzMetricCard icon={QrCode} label="QR Codes" value={String(totals.qr)} detail="QR Studio assets connected to destinations" />
      </div>

      <AdpadzSection eyebrow="Asset Library" title="Reusable asset structure" description="Uploads are intentionally not implemented here yet. This page establishes the Business Hub categories that future uploads will feed.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {assetCategories.map(category => (
            <AdpadzCard key={category.label} as="article" variant="flat" className="p-4">
              <category.icon className="mb-4 h-6 w-6 text-neon" />
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black">{category.label}</h2>
                <AdpadzBadge variant="status">Planned</AdpadzBadge>
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{category.description}</p>
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{category.source}</p>
            </AdpadzCard>
          ))}
        </div>
      </AdpadzSection>
    </div>
  );
}

