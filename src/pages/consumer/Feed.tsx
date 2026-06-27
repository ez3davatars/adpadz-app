import { Link } from 'react-router-dom';
import { Heart, Share2, MapPin, Bookmark, Sparkles, Search } from 'lucide-react';
import { mockAds, mockOffers, savedOfferIds } from '../../lib/mock-data';
import { useState } from 'react';

export default function Feed() {
  const [saved, setSaved] = useState(savedOfferIds);
  const [filter, setFilter] = useState<string>('all');

  const filteredAds = filter === 'all'
    ? mockAds
    : mockAds.filter(a => a.interactiveType === filter);

  function toggleSave(id: string) {
    setSaved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b safe-top"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon flex items-center justify-center">
              <span className="text-black font-black text-xs">A</span>
            </div>
            <span className="font-bold text-sm">adpadz<span className="text-neon">.co</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors">
              <Search className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <Link to="/auth" className="text-xs text-neon font-medium">Sign In</Link>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
          {[
            { id: 'all', label: 'All Ads' },
            { id: 'tap_reveal', label: 'Tap to Reveal' },
            { id: 'scratch', label: 'Scratch Off' },
            { id: 'before_after', label: 'Before & After' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filter === f.id
                  ? 'bg-neon text-black'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Nearby Offers */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-neon" /> Hot Offers Near You
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {mockOffers.map(offer => (
              <Link
                key={offer.id}
                to={`/redeem/${offer.id}`}
                className="flex-shrink-0 w-48 card-surface p-3 hover:border-[var(--border-neon)] transition-all"
              >
                <img src={offer.imageUrl} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />
                <p className="text-xs font-semibold truncate">{offer.title}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{offer.businessName}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Ad Feed */}
        <div className="space-y-4">
          {filteredAds.map(ad => (
            <div key={ad.id} className="card-surface overflow-hidden">
              {/* Business header */}
              <div className="flex items-center gap-3 p-4 pb-3">
                <img src={ad.businessLogo} alt="" className="w-9 h-9 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <Link to={`/business/${ad.businessId}`} className="text-sm font-semibold hover:text-neon transition-colors">
                    {ad.businessName}
                  </Link>
                  <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Near you
                  </p>
                </div>
                <span className="badge badge-active text-[10px]">
                  {ad.interactiveType.replace('_', ' ')}
                </span>
              </div>

              {/* Ad content */}
              <Link to={`/ad/${ad.id}`}>
                <div className="relative aspect-[4/3] bg-[var(--bg-input)] overflow-hidden group">
                  <img src={ad.imageUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-xs text-neon uppercase tracking-wider font-medium mb-1">
                      {ad.interactiveType === 'tap_reveal' ? 'Tap to Reveal' : ad.interactiveType === 'scratch' ? 'Scratch Off' : 'Swipe'}
                    </p>
                    <h3 className="text-lg font-bold">{ad.headline}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{ad.description}</p>
                  </div>
                  {/* Neon interaction indicator */}
                  <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-neon/20 border border-neon/40 flex items-center justify-center animate-glow-pulse">
                    <Sparkles className="w-5 h-5 text-neon" />
                  </div>
                </div>
              </Link>

              {/* Actions */}
              <div className="flex items-center justify-between p-4 pt-3">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-neon transition-colors">
                    <Heart className="w-4 h-4" />
                    <span className="text-xs">{(ad.interactionCount / 1000).toFixed(1)}k</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-neon transition-colors">
                    <Share2 className="w-4 h-4" />
                    <span className="text-xs">Share</span>
                  </button>
                </div>
                <button
                  onClick={() => toggleSave(ad.id)}
                  className={`p-2 rounded-full transition-colors ${saved.has(ad.id) ? 'text-neon' : 'text-[var(--text-secondary)] hover:text-neon'}`}
                >
                  <Bookmark className="w-4 h-4" fill={saved.has(ad.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
