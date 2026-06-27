export interface Business {
  id: string;
  name: string;
  slug: string;
  industry: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  logoUrl: string;
  coverUrl: string;
  rating: number;
  reviewCount: number;
  followerCount: number;
  verified: boolean;
}

export interface Ad {
  id: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  headline: string;
  description: string;
  type: 'interactive' | 'static_image' | 'motion';
  interactiveType: 'tap_reveal' | 'scratch' | 'before_after' | 'swipe';
  imageUrl: string;
  ctaText: string;
  offerText: string;
  published: boolean;
  viewCount: number;
  interactionCount: number;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'paused' | 'ended';
  objective: string;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface Offer {
  id: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  title: string;
  description: string;
  discountType: 'percent' | 'fixed' | 'bogo' | 'free';
  discountValue: number;
  endDate: string;
  maxRedemptions: number;
  currentRedemptions: number;
  imageUrl: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  adId: string;
  adHeadline: string;
  createdAt: string;
}

export interface AnalyticsData {
  date: string;
  views: number;
  interactions: number;
  ctaClicks: number;
  leads: number;
}

export const mockBusiness: Business = {
  id: 'biz-001',
  name: 'Bella Pizza Kitchen',
  slug: 'bella-pizza-kitchen',
  industry: 'restaurant',
  description: 'Authentic wood-fired pizza in the heart of downtown. Family recipes passed down through generations.',
  phone: '(555) 234-5678',
  email: 'hello@bellapizza.com',
  address: '123 Main St',
  city: 'Austin',
  state: 'TX',
  logoUrl: 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=100',
  coverUrl: 'https://images.pexels.com/photos/1653877/pexels-photo-1653877.jpeg?auto=compress&cs=tinysrgb&w=800',
  rating: 4.8,
  reviewCount: 342,
  followerCount: 2180,
  verified: true,
};

export const mockAds: Ad[] = [
  {
    id: 'ad-001',
    businessId: 'biz-001',
    businessName: 'Bella Pizza Kitchen',
    businessLogo: 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=100',
    headline: "TODAY'S SPECIAL!",
    description: 'Tap to reveal our secret deal of the day. Limited time only!',
    type: 'interactive',
    interactiveType: 'tap_reveal',
    imageUrl: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=600',
    ctaText: 'Claim Offer',
    offerText: '25% OFF your next pizza order',
    published: true,
    viewCount: 12389,
    interactionCount: 8742,
    createdAt: '2026-06-15',
  },
  {
    id: 'ad-002',
    businessId: 'biz-002',
    businessName: 'Zen Wellness Spa',
    businessLogo: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=100',
    headline: 'SCRATCH & WIN',
    description: 'Scratch to reveal your exclusive spa discount!',
    type: 'interactive',
    interactiveType: 'scratch',
    imageUrl: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=600',
    ctaText: 'Book Now',
    offerText: 'FREE 30-min massage upgrade',
    published: true,
    viewCount: 8456,
    interactionCount: 5210,
    createdAt: '2026-06-12',
  },
  {
    id: 'ad-003',
    businessId: 'biz-003',
    businessName: 'AutoPro Detailing',
    businessLogo: 'https://images.pexels.com/photos/3354648/pexels-photo-3354648.jpeg?auto=compress&cs=tinysrgb&w=100',
    headline: 'BEFORE & AFTER',
    description: 'Swipe to see the transformation. Your car deserves this.',
    type: 'interactive',
    interactiveType: 'before_after',
    imageUrl: 'https://images.pexels.com/photos/3354648/pexels-photo-3354648.jpeg?auto=compress&cs=tinysrgb&w=600',
    ctaText: 'Get Quote',
    offerText: '$50 OFF full detail package',
    published: true,
    viewCount: 6892,
    interactionCount: 4311,
    createdAt: '2026-06-10',
  },
  {
    id: 'ad-004',
    businessId: 'biz-004',
    businessName: 'FitZone Gym',
    businessLogo: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=100',
    headline: 'TAP FOR FREE PASS',
    description: 'Your first week is on us. Tap to get started.',
    type: 'interactive',
    interactiveType: 'tap_reveal',
    imageUrl: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600',
    ctaText: 'Join Free',
    offerText: 'FREE 7-day trial pass',
    published: true,
    viewCount: 15200,
    interactionCount: 11043,
    createdAt: '2026-06-18',
  },
  {
    id: 'ad-005',
    businessId: 'biz-005',
    businessName: 'Bloom Flower Shop',
    businessLogo: 'https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?auto=compress&cs=tinysrgb&w=100',
    headline: 'SCRATCH YOUR BOUQUET DEAL',
    description: 'Every scratch wins! Reveal your flower discount.',
    type: 'interactive',
    interactiveType: 'scratch',
    imageUrl: 'https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?auto=compress&cs=tinysrgb&w=600',
    ctaText: 'Order Now',
    offerText: '20% OFF all bouquets this week',
    published: true,
    viewCount: 4521,
    interactionCount: 3102,
    createdAt: '2026-06-20',
  },
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'camp-001',
    name: 'Summer Pizza Deals',
    status: 'active',
    objective: 'offers',
    budget: 500,
    spent: 234.50,
    startDate: '2026-06-01',
    endDate: '2026-07-31',
    impressions: 12389,
    clicks: 2456,
    conversions: 189,
  },
  {
    id: 'camp-002',
    name: 'Grand Opening Week',
    status: 'active',
    objective: 'foot_traffic',
    budget: 1000,
    spent: 567.80,
    startDate: '2026-06-15',
    endDate: '2026-06-30',
    impressions: 23401,
    clicks: 4567,
    conversions: 312,
  },
  {
    id: 'camp-003',
    name: 'Holiday Special Menu',
    status: 'draft',
    objective: 'leads',
    budget: 750,
    spent: 0,
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    impressions: 0,
    clicks: 0,
    conversions: 0,
  },
  {
    id: 'camp-004',
    name: 'Loyalty Program Launch',
    status: 'paused',
    objective: 'leads',
    budget: 300,
    spent: 145.20,
    startDate: '2026-05-15',
    endDate: '2026-06-15',
    impressions: 8900,
    clicks: 1234,
    conversions: 67,
  },
  {
    id: 'camp-005',
    name: 'Spring Promo',
    status: 'ended',
    objective: 'visits',
    budget: 400,
    spent: 398.90,
    startDate: '2026-04-01',
    endDate: '2026-05-01',
    impressions: 19800,
    clicks: 3456,
    conversions: 234,
  },
];

export const mockOffers: Offer[] = [
  {
    id: 'offer-001',
    businessId: 'biz-001',
    businessName: 'Bella Pizza Kitchen',
    businessLogo: 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=100',
    title: '25% OFF Any Large Pizza',
    description: 'Valid on any large pizza with 2+ toppings. Dine-in or takeout.',
    discountType: 'percent',
    discountValue: 25,
    endDate: '2026-07-15',
    maxRedemptions: 500,
    currentRedemptions: 187,
    imageUrl: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 'offer-002',
    businessId: 'biz-002',
    businessName: 'Zen Wellness Spa',
    businessLogo: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=100',
    title: 'FREE Massage Upgrade',
    description: 'Book any 60-min massage, get upgraded to 90-min FREE.',
    discountType: 'free',
    discountValue: 0,
    endDate: '2026-07-01',
    maxRedemptions: 100,
    currentRedemptions: 43,
    imageUrl: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 'offer-003',
    businessId: 'biz-004',
    businessName: 'FitZone Gym',
    businessLogo: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=100',
    title: 'FREE 7-Day Trial',
    description: 'Full access to all equipment, classes, and amenities.',
    discountType: 'free',
    discountValue: 0,
    endDate: '2026-08-01',
    maxRedemptions: 200,
    currentRedemptions: 78,
    imageUrl: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
];

export const mockLeads: Lead[] = [
  { id: 'l1', name: 'Sarah Johnson', email: 'sarah@email.com', phone: '(555) 111-2233', source: 'ad', status: 'new', adId: 'ad-001', adHeadline: "TODAY'S SPECIAL!", createdAt: '2026-06-22T14:30:00Z' },
  { id: 'l2', name: 'Mike Chen', email: 'mike.c@email.com', phone: '(555) 444-5566', source: 'ad', status: 'contacted', adId: 'ad-001', adHeadline: "TODAY'S SPECIAL!", createdAt: '2026-06-21T09:15:00Z' },
  { id: 'l3', name: 'Emily Davis', email: 'emily.d@email.com', phone: '(555) 777-8899', source: 'ad', status: 'qualified', adId: 'ad-004', adHeadline: 'TAP FOR FREE PASS', createdAt: '2026-06-20T16:45:00Z' },
  { id: 'l4', name: 'James Wilson', email: 'jwilson@email.com', phone: '(555) 222-3344', source: 'ad', status: 'converted', adId: 'ad-002', adHeadline: 'SCRATCH & WIN', createdAt: '2026-06-19T11:20:00Z' },
  { id: 'l5', name: 'Lisa Park', email: 'lisa.park@email.com', phone: '(555) 666-7788', source: 'organic', status: 'new', adId: 'ad-003', adHeadline: 'BEFORE & AFTER', createdAt: '2026-06-22T08:00:00Z' },
  { id: 'l6', name: 'David Brown', email: 'dbrown@email.com', phone: '(555) 333-4455', source: 'ad', status: 'new', adId: 'ad-001', adHeadline: "TODAY'S SPECIAL!", createdAt: '2026-06-22T16:10:00Z' },
  { id: 'l7', name: 'Karen White', email: 'karenw@email.com', phone: '', source: 'ad', status: 'contacted', adId: 'ad-005', adHeadline: 'SCRATCH YOUR BOUQUET DEAL', createdAt: '2026-06-18T13:00:00Z' },
];

export const mockAnalytics: AnalyticsData[] = [
  { date: '2026-06-16', views: 1240, interactions: 890, ctaClicks: 234, leads: 12 },
  { date: '2026-06-17', views: 1456, interactions: 1023, ctaClicks: 289, leads: 18 },
  { date: '2026-06-18', views: 1890, interactions: 1345, ctaClicks: 412, leads: 24 },
  { date: '2026-06-19', views: 2100, interactions: 1567, ctaClicks: 478, leads: 31 },
  { date: '2026-06-20', views: 1780, interactions: 1234, ctaClicks: 356, leads: 19 },
  { date: '2026-06-21', views: 2340, interactions: 1789, ctaClicks: 523, leads: 28 },
  { date: '2026-06-22', views: 2560, interactions: 1956, ctaClicks: 601, leads: 35 },
];

export const savedOfferIds = new Set(['offer-001', 'offer-003']);
