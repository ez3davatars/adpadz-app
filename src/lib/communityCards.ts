export type CommunityCardFormat = 'postcard_9x12' | 'community_card_6x11';
export type CommunityCardStatus = 'draft' | 'selling' | 'proof' | 'approved' | 'mailed' | 'archived';
export type CommunityCardSide = 'front' | 'back';
export type CommunityCardSlotStatus = 'available' | 'reserved' | 'sold' | 'intake' | 'proof' | 'approved';
export type CommunityCardPlacementType = 'featured' | 'standard' | 'mini' | 'adpadz';

export type CommunityCardRecord = {
  id: string;
  owner_id: string;
  title: string;
  market_name: string | null;
  format: CommunityCardFormat;
  layout_key: string;
  mailing_date: string | null;
  household_count: number | null;
  status: CommunityCardStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CommunityCardSlotRecord = {
  id: string;
  community_card_id: string;
  slot_key: string;
  label: string;
  placement_type: CommunityCardPlacementType;
  side: CommunityCardSide;
  x: number;
  y: number;
  width: number;
  height: number;
  price_cents: number;
  category: string | null;
  status: CommunityCardSlotStatus;
  advertiser_name: string | null;
  campaign_id: string | null;
  qr_link_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CommunityCardLayout = {
  key: string;
  name: string;
  description: string;
  format: CommunityCardFormat;
  slots: Array<Omit<CommunityCardSlotRecord, 'id' | 'community_card_id' | 'campaign_id' | 'qr_link_id' | 'advertiser_name' | 'category' | 'notes' | 'created_at' | 'updated_at'>>;
};

const baseSlot = (slot: Omit<CommunityCardLayout['slots'][number], 'status'>): CommunityCardLayout['slots'][number] => ({ ...slot, status: 'available' });

const postcard9x12Spotlight: CommunityCardLayout = {
  key: '9x12-spotlight', name: 'Local Spotlight', format: 'postcard_9x12',
  description: 'A dominant featured sponsor on the front, Adpadz discovery, and twelve sellable local placements on the back.',
  slots: [
    baseSlot({ slot_key: 'front-featured', label: 'Featured sponsor', placement_type: 'featured', side: 'front', x: 5, y: 8, width: 90, height: 57, price_cents: 60000 }),
    baseSlot({ slot_key: 'front-adpadz', label: 'Adpadz discovery', placement_type: 'adpadz', side: 'front', x: 5, y: 70, width: 90, height: 23, price_cents: 0 }),
    ...Array.from({ length: 12 }, (_, index) => baseSlot({
      slot_key: `back-standard-${index + 1}`, label: `Standard ${index + 1}`, placement_type: 'standard', side: 'back',
      x: 4 + (index % 3) * 31, y: 6 + Math.floor(index / 3) * 23, width: 29, height: 19, price_cents: 15000,
    })),
  ],
};

const postcard9x12Grid: CommunityCardLayout = {
  key: '9x12-community-grid', name: 'Community Grid', format: 'postcard_9x12',
  description: 'A balanced sixteen-placement community card with an Adpadz discovery panel and clear category inventory.',
  slots: [
    baseSlot({ slot_key: 'front-adpadz', label: 'Adpadz discovery', placement_type: 'adpadz', side: 'front', x: 4, y: 5, width: 92, height: 17, price_cents: 0 }),
    ...Array.from({ length: 8 }, (_, index) => baseSlot({
      slot_key: `front-standard-${index + 1}`, label: `Front ${index + 1}`, placement_type: 'standard', side: 'front',
      x: 4 + (index % 2) * 46, y: 27 + Math.floor(index / 2) * 17, width: 44, height: 13, price_cents: 15000,
    })),
    ...Array.from({ length: 8 }, (_, index) => baseSlot({
      slot_key: `back-standard-${index + 1}`, label: `Back ${index + 1}`, placement_type: 'standard', side: 'back',
      x: 4 + (index % 2) * 46, y: 6 + Math.floor(index / 2) * 23, width: 44, height: 19, price_cents: 15000,
    })),
  ],
};

const community6x11Feature: CommunityCardLayout = {
  key: '6x11-feature-grid', name: 'Feature + Grid', format: 'community_card_6x11',
  description: 'A compact format with one high-visibility featured sponsor and eight standard placements.',
  slots: [
    baseSlot({ slot_key: 'front-featured', label: 'Featured sponsor', placement_type: 'featured', side: 'front', x: 5, y: 7, width: 90, height: 42, price_cents: 45000 }),
    baseSlot({ slot_key: 'front-adpadz', label: 'Adpadz discovery', placement_type: 'adpadz', side: 'front', x: 5, y: 55, width: 90, height: 18, price_cents: 0 }),
    ...Array.from({ length: 4 }, (_, index) => baseSlot({
      slot_key: `front-standard-${index + 1}`, label: `Front ${index + 1}`, placement_type: 'standard', side: 'front',
      x: 5 + (index % 2) * 46, y: 78, width: 44, height: 15, price_cents: 10000,
    })),
    ...Array.from({ length: 4 }, (_, index) => baseSlot({
      slot_key: `back-standard-${index + 1}`, label: `Back ${index + 1}`, placement_type: 'standard', side: 'back',
      x: 5 + (index % 2) * 46, y: 8 + Math.floor(index / 2) * 43, width: 44, height: 34, price_cents: 10000,
    })),
  ],
};

const community6x11Directory: CommunityCardLayout = {
  key: '6x11-directory', name: 'Neighborhood Directory', format: 'community_card_6x11',
  description: 'A compact twelve-placement layout for repeat monthly neighborhood campaigns.',
  slots: [
    baseSlot({ slot_key: 'front-adpadz', label: 'Adpadz discovery', placement_type: 'adpadz', side: 'front', x: 5, y: 5, width: 90, height: 14, price_cents: 0 }),
    ...(['front', 'back'] as CommunityCardSide[]).flatMap(side => Array.from({ length: 6 }, (_, index) => baseSlot({
      slot_key: `${side}-standard-${index + 1}`, label: `${side === 'front' ? 'Front' : 'Back'} ${index + 1}`, placement_type: 'standard', side,
      x: 5 + (index % 2) * 46, y: (side === 'front' ? 25 : 7) + Math.floor(index / 2) * 23, width: 44, height: 18, price_cents: 10000,
    }))),
  ],
};

export const COMMUNITY_CARD_LAYOUTS = [postcard9x12Spotlight, postcard9x12Grid, community6x11Feature, community6x11Directory] as const;

export function getCommunityCardLayouts(format: CommunityCardFormat) {
  return COMMUNITY_CARD_LAYOUTS.filter(layout => layout.format === format);
}

export function getCommunityCardLayout(key: string) {
  return COMMUNITY_CARD_LAYOUTS.find(layout => layout.key === key) ?? postcard9x12Spotlight;
}

export function formatCommunityCardFormat(format: CommunityCardFormat) {
  return format === 'postcard_9x12' ? '9×12 Postcard' : '6×11 Community Card';
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}
