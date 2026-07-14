import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleDollarSign, ClipboardCheck, FilePlus2, Layers3, Loader2, MapPin, Megaphone, Plus, QrCode, Save, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';
import {
  formatCommunityCardFormat,
  formatCurrency,
  getCommunityCardLayout,
  getCommunityCardLayouts,
  type CommunityCardFormat,
  type CommunityCardRecord,
  type CommunityCardSlotRecord,
  type CommunityCardSlotStatus,
} from '../../lib/communityCards';

type CampaignChoice = { id: string; title: string; status: string };
type QRChoice = { id: string; title: string; slug: string; scan_count: number };
type BuilderState = { cards: CommunityCardRecord[]; slots: CommunityCardSlotRecord[]; campaigns: CampaignChoice[]; qrLinks: QRChoice[]; loading: boolean; error: string | null };

const emptyState: BuilderState = { cards: [], slots: [], campaigns: [], qrLinks: [], loading: true, error: null };
const cardStatuses: CommunityCardRecord['status'][] = ['draft', 'selling', 'proof', 'approved', 'mailed', 'archived'];
const slotStatuses: CommunityCardSlotStatus[] = ['available', 'reserved', 'sold', 'intake', 'proof', 'approved'];

export default function CommunityCards() {
  const [state, setState] = useState<BuilderState>(emptyState);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newCard, setNewCard] = useState({ title: '', market_name: '', format: 'postcard_9x12' as CommunityCardFormat, layout_key: '9x12-spotlight', household_count: '5000', mailing_date: '' });

  useEffect(() => { void load(); }, []);

  async function load() {
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error(authError?.message ?? 'Sign in to open the Card Manager.');
      const [cardsResult, campaignsResult, qrResult] = await Promise.all([
        supabase.from('community_cards').select('*').eq('owner_id', auth.user.id).order('updated_at', { ascending: false }),
        supabase.from('campaigns').select('id,title,status').eq('owner_id', auth.user.id).neq('status', 'expired').order('updated_at', { ascending: false }),
        supabase.from('qr_links').select('id,title,slug,scan_count').eq('owner_user_id', auth.user.id).eq('status', 'active').order('updated_at', { ascending: false }),
      ]);
      if (cardsResult.error) throw new Error(cardsResult.error.message);
      if (campaignsResult.error) throw new Error(campaignsResult.error.message);
      if (qrResult.error) throw new Error(qrResult.error.message);
      const cards = (cardsResult.data ?? []) as CommunityCardRecord[];
      const slotResult = cards.length ? await supabase.from('community_card_slots').select('*').in('community_card_id', cards.map(card => card.id)).order('side').order('y').order('x') : { data: [], error: null };
      if (slotResult.error) throw new Error(slotResult.error.message);
      setState({ cards, slots: (slotResult.data ?? []) as CommunityCardSlotRecord[], campaigns: (campaignsResult.data ?? []) as CampaignChoice[], qrLinks: (qrResult.data ?? []) as QRChoice[], loading: false, error: null });
      setSelectedCardId(current => current && cards.some(card => card.id === current) ? current : cards[0]?.id ?? null);
    } catch (error) {
      setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not load community cards.' }));
    }
  }

  const selectedCard = state.cards.find(card => card.id === selectedCardId) ?? null;
  const selectedSlots = useMemo(() => selectedCard ? state.slots.filter(slot => slot.community_card_id === selectedCard.id) : [], [selectedCard, state.slots]);
  const selectedSlot = selectedSlots.find(slot => slot.id === selectedSlotId) ?? null;
  const selectedLayout = selectedCard ? getCommunityCardLayout(selectedCard.layout_key) : null;
  const revenue = selectedSlots.filter(slot => slot.status !== 'available' && slot.placement_type !== 'adpadz').reduce((sum, slot) => sum + slot.price_cents, 0);
  const inventory = selectedSlots.filter(slot => slot.placement_type !== 'adpadz');
  const available = inventory.filter(slot => slot.status === 'available').length;
  const attachedQrs = selectedSlots.filter(slot => slot.qr_link_id).length;

  async function createCard() {
    const title = newCard.title.trim();
    if (!title) { setMessage('Give this community campaign a name first.'); return; }
    const layout = getCommunityCardLayout(newCard.layout_key);
    setCreating(true); setMessage(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error(authError?.message ?? 'Sign in before creating a card.');
      const { data: card, error: cardError } = await supabase.from('community_cards').insert({
        owner_id: auth.user.id, title, market_name: newCard.market_name.trim() || null, format: newCard.format, layout_key: layout.key,
        household_count: Number(newCard.household_count) || null, mailing_date: newCard.mailing_date || null,
      }).select('*').single();
      if (cardError || !card) throw new Error(cardError?.message ?? 'Could not create the community card.');
      const slots = layout.slots.map(slot => ({ ...slot, community_card_id: card.id }));
      const { error: slotError } = await supabase.from('community_card_slots').insert(slots);
      if (slotError) throw new Error(slotError.message);
      setCreating(false); setNewCard({ title: '', market_name: '', format: 'postcard_9x12', layout_key: '9x12-spotlight', household_count: '5000', mailing_date: '' });
      setMessage(`${card.title} is ready to build.`); await load(); setSelectedCardId(card.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create community card.'); setCreating(false); }
  }

  async function saveCard(values: Partial<CommunityCardRecord>) {
    if (!selectedCard) return;
    setSavingCard(true); setMessage(null);
    const { data, error } = await supabase.from('community_cards').update(values).eq('id', selectedCard.id).select('*').single();
    if (error || !data) setMessage(error?.message ?? 'Could not update the community card.');
    else { setState(current => ({ ...current, cards: current.cards.map(card => card.id === selectedCard.id ? data as CommunityCardRecord : card) })); setMessage('Card campaign saved.'); }
    setSavingCard(false);
  }

  async function saveSlot(values: Partial<CommunityCardSlotRecord>) {
    if (!selectedSlot) return;
    setSavingSlot(true); setMessage(null);
    const { data, error } = await supabase.from('community_card_slots').update(values).eq('id', selectedSlot.id).select('*').single();
    if (error || !data) setMessage(error?.message ?? 'Could not update this placement.');
    else { setState(current => ({ ...current, slots: current.slots.map(slot => slot.id === selectedSlot.id ? data as CommunityCardSlotRecord : slot) })); setMessage(`${data.label} saved.`); }
    setSavingSlot(false);
  }

  function updateNewFormat(format: CommunityCardFormat) {
    setNewCard(current => ({ ...current, format, layout_key: getCommunityCardLayouts(format)[0].key }));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Physical + digital distribution</p>
          <h1 className="text-2xl font-black sm:text-3xl">Community Card Manager</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">Build sellable local campaigns, connect every placement to Adpadz, and keep print inventory, proofs, and QR engagement in one workspace.</p>
        </div>
        <AdpadzButton type="button" onClick={() => document.getElementById('new-community-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Plus className="h-4 w-4" /> Build a card</AdpadzButton>
      </header>

      {state.error && <AdpadzCard role="alert" variant="flat" className="border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{state.error}</AdpadzCard>}
      {message && <AdpadzCard role="status" variant="flat" className="border-neon/30 bg-neon/10 p-4 text-sm font-bold text-neon">{message}</AdpadzCard>}

      <AdpadzSection eyebrow="Start a distribution campaign" title="Build a community card" description="Choose the physical format first. The layout creates the correct sellable placements, with print-safe positions already mapped.">
        <div id="new-community-card" className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign name"><input className="input-field" value={newCard.title} onChange={event => setNewCard(current => ({ ...current, title: event.target.value }))} placeholder="Jacksonville Local Spotlight — August" /></Field>
            <Field label="Neighborhood / market"><input className="input-field" value={newCard.market_name} onChange={event => setNewCard(current => ({ ...current, market_name: event.target.value }))} placeholder="Jacksonville, NC" /></Field>
            <Field label="Format"><select className="input-field" value={newCard.format} onChange={event => updateNewFormat(event.target.value as CommunityCardFormat)}><option value="postcard_9x12">9×12 Postcard</option><option value="community_card_6x11">6×11 Community Card</option></select></Field>
            <Field label="Target homes"><input className="input-field" type="number" min="1" value={newCard.household_count} onChange={event => setNewCard(current => ({ ...current, household_count: event.target.value }))} /></Field>
            <Field label="Mail date"><input className="input-field" type="date" value={newCard.mailing_date} onChange={event => setNewCard(current => ({ ...current, mailing_date: event.target.value }))} /></Field>
            <Field label="Layout"><select className="input-field" value={newCard.layout_key} onChange={event => setNewCard(current => ({ ...current, layout_key: event.target.value }))}>{getCommunityCardLayouts(newCard.format).map(layout => <option key={layout.key} value={layout.key}>{layout.name}</option>)}</select></Field>
          </div>
          <LayoutPreview layout={getCommunityCardLayout(newCard.layout_key)} side="front" compact />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p className="max-w-2xl text-xs text-[var(--text-muted)]">The card builder creates inventory only. A placement is connected to an existing campaign and QR link when it is sold—so your existing campaign content and scan tracking remain the source of truth.</p>
          <AdpadzButton type="button" onClick={() => void createCard()} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}{creating ? 'Creating...' : 'Create card'}</AdpadzButton>
        </div>
      </AdpadzSection>

      {state.loading ? <AdpadzCard className="flex items-center gap-2 p-5 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin text-neon" /> Loading your card inventory...</AdpadzCard> : state.cards.length === 0 ? <EmptyManager /> : <>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.cards.map(card => <button type="button" key={card.id} onClick={() => { setSelectedCardId(card.id); setSelectedSlotId(null); }} className={`rounded-[1.5rem] border p-4 text-left transition ${card.id === selectedCardId ? 'border-neon bg-neon/[0.07] shadow-[0_0_28px_rgba(182,255,0,.12)]' : 'border-white/10 bg-white/[0.025] hover:border-white/25'}`}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-neon">{formatCommunityCardFormat(card.format)}</p><h2 className="mt-1 font-black">{card.title}</h2></div><StatusBadge status={card.status} /></div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><MapPin className="h-3.5 w-3.5" /> {card.market_name || 'Market not set'} <span className="mx-1 text-white/20">•</span> {card.household_count?.toLocaleString() || '—'} homes</p>
          </button>)}
        </section>

        {selectedCard && <section className="space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-neon">Selected campaign</p><h2 className="text-2xl font-black">{selectedCard.title}</h2></div><div className="flex flex-wrap gap-2"><StatusBadge status={selectedCard.status} /><select aria-label="Update card workflow status" className="rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-black text-white" value={selectedCard.status} onChange={event => void saveCard({ status: event.target.value as CommunityCardRecord['status'] })}>{cardStatuses.map(status => <option key={status} value={status}>{sentence(status)}</option>)}</select></div></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AdpadzMetricCard icon={CircleDollarSign} label="Committed value" value={formatCurrency(revenue)} detail="Reserved or sold inventory" /><AdpadzMetricCard icon={Layers3} label="Available spots" value={String(available)} detail={`${inventory.length} sellable placements`} /><AdpadzMetricCard icon={QrCode} label="Connected QR links" value={String(attachedQrs)} detail="Existing QR Studio links" /><AdpadzMetricCard icon={ClipboardCheck} label="Ready for proof" value={String(inventory.filter(slot => slot.status === 'proof' || slot.status === 'approved').length)} detail="Proof or approval stage" /></div>

          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <AdpadzCard variant="flat" className="p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black">Visual inventory</p><p className="text-xs text-[var(--text-muted)]">Select a placement to manage its price, advertiser, campaign, and QR. Safe margin is shown inside the card.</p></div><div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide"><Legend color="bg-white/[.08]" label="Available" /><Legend color="bg-amber-400/30" label="Reserved" /><Legend color="bg-neon/30" label="Sold / production" /></div></div><div className="grid gap-5 xl:grid-cols-2"><LayoutPreview layout={selectedLayout!} side="front" slots={selectedSlots} selectedSlotId={selectedSlotId} onSelect={setSelectedSlotId} /><LayoutPreview layout={selectedLayout!} side="back" slots={selectedSlots} selectedSlotId={selectedSlotId} onSelect={setSelectedSlotId} /></div></AdpadzCard>
            {selectedSlot ? <SlotEditor key={selectedSlot.id} slot={selectedSlot} campaigns={state.campaigns} qrLinks={state.qrLinks} saving={savingSlot} onClose={() => setSelectedSlotId(null)} onSave={saveSlot} /> : <CardSettings card={selectedCard} saving={savingCard} onSave={saveCard} />}
          </div>
        </section>}
      </>}
    </div>
  );
}

function SlotEditor({ slot, campaigns, qrLinks, saving, onClose, onSave }: { slot: CommunityCardSlotRecord; campaigns: CampaignChoice[]; qrLinks: QRChoice[]; saving: boolean; onClose: () => void; onSave: (values: Partial<CommunityCardSlotRecord>) => Promise<void> }) {
  const [form, setForm] = useState({ advertiser_name: slot.advertiser_name || '', category: slot.category || '', price: String(slot.price_cents / 100), status: slot.status, campaign_id: slot.campaign_id || '', qr_link_id: slot.qr_link_id || '', notes: slot.notes || '' });
  return <AdpadzCard className="p-5" variant="glass"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-neon">{slot.placement_type} placement</p><h3 className="text-lg font-black">{slot.label}</h3></div><button type="button" onClick={onClose} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-white/[.08] hover:text-white" aria-label="Close placement editor"><X className="h-4 w-4" /></button></div><div className="mt-5 space-y-4"><Field label="Advertiser"><input className="input-field" value={form.advertiser_name} onChange={event => setForm(current => ({ ...current, advertiser_name: event.target.value }))} placeholder="Business name" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Price"><input className="input-field" type="number" min="0" value={form.price} onChange={event => setForm(current => ({ ...current, price: event.target.value }))} /></Field><Field label="Workflow"><select className="input-field" value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as CommunityCardSlotStatus }))}>{slotStatuses.map(status => <option key={status} value={status}>{sentence(status)}</option>)}</select></Field></div><Field label="Category exclusivity"><input className="input-field" value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} placeholder="e.g. HVAC, dentist, restaurant" /></Field><Field label="Connected campaign"><select className="input-field" value={form.campaign_id} onChange={event => setForm(current => ({ ...current, campaign_id: event.target.value }))}><option value="">Not attached yet</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title} · {sentence(campaign.status)}</option>)}</select></Field><Field label="Connected QR link"><select className="input-field" value={form.qr_link_id} onChange={event => setForm(current => ({ ...current, qr_link_id: event.target.value }))}><option value="">Not attached yet</option>{qrLinks.map(qr => <option key={qr.id} value={qr.id}>{qr.title} · {qr.scan_count} scans</option>)}</select></Field><Field label="Internal notes"><textarea className="input-field min-h-24 resize-y" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Offer, intake notes, proof feedback..." /></Field><div className="rounded-xl border border-neon/20 bg-neon/[.06] p-3 text-xs text-[var(--text-secondary)]"><QrCode className="mr-1 inline h-3.5 w-3.5 text-neon" /> Attach the same QR link used in the printed creative. Adpadz will report its actual scans through QR Studio; this manager does not invent performance data.</div><AdpadzButton type="button" fullWidth onClick={() => void onSave({ advertiser_name: form.advertiser_name.trim() || null, category: form.category.trim() || null, price_cents: Math.max(0, Math.round((Number(form.price) || 0) * 100)), status: form.status, campaign_id: form.campaign_id || null, qr_link_id: form.qr_link_id || null, notes: form.notes.trim() || null })} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving...' : 'Save placement'}</AdpadzButton></div></AdpadzCard>;
}

function CardSettings({ card, saving, onSave }: { card: CommunityCardRecord; saving: boolean; onSave: (values: Partial<CommunityCardRecord>) => Promise<void> }) { const [form, setForm] = useState({ market_name: card.market_name || '', mailing_date: card.mailing_date || '', household_count: String(card.household_count || '') }); return <AdpadzCard className="p-5" variant="glass"><p className="text-[10px] font-black uppercase tracking-[.18em] text-neon">Campaign controls</p><h3 className="mt-1 text-lg font-black">Card details</h3><div className="mt-5 space-y-4"><Field label="Market"><input className="input-field" value={form.market_name} onChange={event => setForm(current => ({ ...current, market_name: event.target.value }))} /></Field><Field label="Mailing date"><input className="input-field" type="date" value={form.mailing_date} onChange={event => setForm(current => ({ ...current, mailing_date: event.target.value }))} /></Field><Field label="Target homes"><input className="input-field" type="number" min="1" value={form.household_count} onChange={event => setForm(current => ({ ...current, household_count: event.target.value }))} /></Field><div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-[var(--text-muted)]"><Megaphone className="mr-1 inline h-3.5 w-3.5 text-neon" /> One connected campaign, one business profile, and one QR link make every sold placement part of the Adpadz local advertising network.</div><AdpadzButton type="button" fullWidth variant="secondary" onClick={() => void onSave({ market_name: form.market_name.trim() || null, mailing_date: form.mailing_date || null, household_count: Number(form.household_count) || null })} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving...' : 'Save campaign'}</AdpadzButton></div></AdpadzCard> }

function LayoutPreview({ layout, side, slots, selectedSlotId, onSelect, compact = false }: { layout: ReturnType<typeof getCommunityCardLayout>; side: 'front' | 'back'; slots?: CommunityCardSlotRecord[]; selectedSlotId?: string | null; onSelect?: (id: string) => void; compact?: boolean }) { const layoutSlots = layout.slots.filter(slot => slot.side === side); const matchingSlots = new Map((slots ?? []).map(slot => [slot.slot_key, slot])); return <div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[var(--text-muted)]">{side} side</p>{!compact && <span className="text-[10px] text-[var(--text-muted)]">Click a spot to edit</span>}</div><div className={`relative overflow-hidden rounded-[1.4rem] border border-neon/25 bg-[radial-gradient(circle_at_80%_10%,rgba(182,255,0,.14),transparent_35%),linear-gradient(135deg,#151515,#060606)] ${layout.format === 'postcard_9x12' ? 'aspect-[1.5/1]' : 'aspect-[1.83/1]'}`}><div className="pointer-events-none absolute inset-[3%] rounded-[1rem] border border-dashed border-white/15" /><div className="pointer-events-none absolute left-4 top-3 text-[9px] font-black uppercase tracking-[.2em] text-white/40">{formatCommunityCardFormat(layout.format)} · {side}</div>{layoutSlots.map(template => { const slot = matchingSlots.get(template.slot_key); const status = slot?.status ?? template.status; const selected = slot?.id === selectedSlotId; const content = <><span className="line-clamp-2 text-[9px] font-black leading-tight">{slot?.advertiser_name || template.label}</span><span className="mt-1 block text-[8px] opacity-65">{slot ? formatCurrency(slot.price_cents) : formatCurrency(template.price_cents)}</span></>; return <button key={template.slot_key} type="button" disabled={compact || !slot} onClick={() => slot && onSelect?.(slot.id)} className={`absolute overflow-hidden rounded-md border p-1 text-left transition ${slotColor(status)} ${selected ? 'ring-2 ring-neon ring-offset-1 ring-offset-black' : ''} ${compact ? 'cursor-default' : 'hover:scale-[1.025] hover:border-neon/70'}`} style={{ left: `${template.x}%`, top: `${template.y}%`, width: `${template.width}%`, height: `${template.height}%` }}>{content}</button>; })}</div></div> }

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{label}</span>{children}</label> }
function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]"><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span> }
function EmptyManager() { return <AdpadzCard variant="glass" className="p-10 text-center"><Sparkles className="mx-auto h-8 w-8 text-neon" /><h2 className="mt-4 text-xl font-black">Your first local distribution campaign starts here.</h2><p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-muted)]">Choose 9×12 for a large featured sponsor and more inventory, or 6×11 for a compact recurring neighborhood card. The builder keeps every placement ready for the Adpadz campaign, profile, and QR flow.</p></AdpadzCard> }
function StatusBadge({ status }: { status: string }) { return <AdpadzBadge variant="status" className="capitalize">{sentence(status)}</AdpadzBadge> }
function sentence(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()); }
function slotColor(status: CommunityCardSlotStatus) { if (status === 'available') return 'border-white/15 bg-white/[.06] text-white/80'; if (status === 'reserved') return 'border-amber-300/50 bg-amber-300/15 text-amber-100'; if (status === 'sold') return 'border-neon/60 bg-neon/20 text-neon'; return 'border-sky-300/50 bg-sky-300/15 text-sky-50'; }
