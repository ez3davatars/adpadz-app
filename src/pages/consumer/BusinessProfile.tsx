import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Phone, Globe, CheckCircle2, Users } from 'lucide-react';
import { mockBusiness, mockAds, mockOffers } from '../../lib/mock-data';

export default function BusinessProfile() {
  const biz = mockBusiness; // Use mock regardless of slug for now

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b safe-top"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/feed" className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm font-semibold">{biz.name}</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {/* Cover */}
        <div className="relative h-44 sm:h-56">
          <img src={biz.coverUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)] via-transparent to-transparent" />
        </div>

        {/* Profile info */}
        <div className="px-4 -mt-12 relative z-10">
          <div className="flex items-end gap-4">
            <img src={biz.logoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border-4 border-[var(--bg-base)]" />
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">{biz.name}</h1>
                {biz.verified && <CheckCircle2 className="w-4 h-4 text-neon" />}
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-1">
                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />{biz.rating}</span>
                <span>{biz.reviewCount} reviews</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{biz.followerCount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-[var(--text-secondary)] mt-4 leading-relaxed">{biz.description}</p>

          {/* Contact */}
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <MapPin className="w-3.5 h-3.5" /> {biz.address}, {biz.city}, {biz.state}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Phone className="w-3.5 h-3.5" /> {biz.phone}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Globe className="w-3.5 h-3.5" /> {biz.email}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button className="btn-primary text-sm px-5 py-2.5">Follow</button>
            <button className="btn-secondary text-sm px-5 py-2.5">Contact</button>
          </div>
        </div>

        {/* Active Offers */}
        <div className="px-4 mt-8">
          <h2 className="text-sm font-semibold mb-3">Active Offers</h2>
          <div className="space-y-3">
            {mockOffers.filter(o => o.businessId === biz.id).map(offer => (
              <Link key={offer.id} to={`/redeem/${offer.id}`} className="block card-surface p-4 hover:border-[var(--border-neon)] transition-all">
                <div className="flex items-center gap-3">
                  <img src={offer.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{offer.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{offer.description}</p>
                    <p className="text-[10px] text-neon mt-1">
                      {offer.maxRedemptions - offer.currentRedemptions} remaining
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Ads */}
        <div className="px-4 mt-8 pb-8">
          <h2 className="text-sm font-semibold mb-3">Interactive Ads</h2>
          <div className="grid grid-cols-2 gap-3">
            {mockAds.filter(a => a.businessId === biz.id).map(ad => (
              <Link key={ad.id} to={`/ad/${ad.id}`} className="card-surface overflow-hidden hover:border-[var(--border-neon)] transition-all">
                <div className="aspect-square relative">
                  <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-xs font-bold truncate">{ad.headline}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{ad.viewCount.toLocaleString()} views</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
