export type CommunityCardFormat = 'postcard_9x12' | 'community_card_6x11';
export type CommunityCardSide = 'front' | 'back';
export type CommunityCardStatus = 'draft' | 'selling' | 'proof' | 'approved' | 'mailed' | 'archived';
export type CommunityCardSlotStatus = 'available' | 'reserved' | 'sold' | 'proof' | 'approved';

export type CommunityCardRecord = { id: string; owner_id: string; title: string; market_name: string | null; zone_name: string | null; public_slug: string; format: CommunityCardFormat; layout_key: string; mailing_date: string | null; household_count: number | null; status: CommunityCardStatus; sales_open: boolean; is_published: boolean; created_at: string; updated_at: string };
export type CommunityCardSlotRecord = { id: string; community_card_id: string; slot_key: string; label: string; side: CommunityCardSide; x: number; y: number; width: number; height: number; price_cents: number; status: CommunityCardSlotStatus; advertiser_name: string | null; ad_image_url: string | null; buyer_user_id: string | null; created_at: string; updated_at: string };
export type CommunityCardLayout = { key: string; name: string; format: CommunityCardFormat; description: string; sellable_spaces: number; slots: Array<Omit<CommunityCardSlotRecord, 'id' | 'community_card_id' | 'advertiser_name' | 'ad_image_url' | 'buyer_user_id' | 'created_at' | 'updated_at'>> };

const spot = (slot_key: string, label: string, side: CommunityCardSide, x: number, y: number): CommunityCardLayout['slots'][number] => ({ slot_key, label, side, x, y, width: 21.1, height: 38.9, price_cents: 25000, status: 'available' });

const nineByTwelve: CommunityCardLayout = {
  key: 'community-appreciation-9x12', name: 'Community Appreciation · 9×12', format: 'postcard_9x12', sellable_spaces: 16,
  description: 'Eight 2.75″ × 3.5″ spaces per side with a community title band and USPS mail panel reserved on the back.',
  slots: [
    ...[0, 1, 2, 3].map(i => spot(`front-top-${i + 1}`, `Front top ${i + 1}`, 'front', 4.5 + i * 22.8, 7)),
    ...[0, 1, 2, 3].map(i => spot(`front-bottom-${i + 1}`, `Front bottom ${i + 1}`, 'front', 4.5 + i * 22.8, 54)),
    ...[0, 1, 2, 3].map(i => spot(`back-top-${i + 1}`, `Back top ${i + 1}`, 'back', 4.5 + i * 22.8, 7)),
    ...[0, 1, 2, 3].map(i => spot(`back-bottom-${i + 1}`, `Back bottom ${i + 1}`, 'back', 4.5 + i * 22.8, 54)),
  ],
};
const sixByEleven: CommunityCardLayout = {
  key: 'community-appreciation-6x11', name: 'Community Appreciation · 6×11', format: 'community_card_6x11', sellable_spaces: 8,
  description: 'Four 2.75″ × 3.5″ spaces per side with the community title, sponsor line, and USPS mail panel reserved.',
  slots: [
    ...[0, 1, 2, 3].map(i => spot(`front-${i + 1}`, `Front ${i + 1}`, 'front', 4.5 + i * 22.8, 37)),
    ...[0, 1, 2, 3].map(i => spot(`back-${i + 1}`, `Back ${i + 1}`, 'back', 4.5 + i * 22.8, 37)),
  ],
};

export const COMMUNITY_CARD_LAYOUTS = [nineByTwelve, sixByEleven] as const;
export const getCommunityCardLayout = (key: string) => COMMUNITY_CARD_LAYOUTS.find(layout => layout.key === key) ?? nineByTwelve;
export const getCommunityCardLayouts = (format: CommunityCardFormat) => COMMUNITY_CARD_LAYOUTS.filter(layout => layout.format === format);
export const formatCommunityCardFormat = (format: CommunityCardFormat) => format === 'postcard_9x12' ? '9×12 postcard' : '6×11 community card';
export const formatCurrency = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
export const slotPrice = (count: number) => count * 25000;
