import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Share2, Bookmark, Sparkles, Zap, ExternalLink } from 'lucide-react';
import { mockAds } from '../../lib/mock-data';
import { useState } from 'react';

export default function AdView() {
  const { adId } = useParams();
  const ad = mockAds.find(a => a.id === adId) || mockAds[0];
  const [revealed, setRevealed] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b safe-top"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/feed" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full hover:bg-[var(--bg-hover)]">
              <Share2 className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <button className="p-2 rounded-full hover:bg-[var(--bg-hover)]">
              <Bookmark className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Business info */}
        <div className="flex items-center gap-3 px-4 py-4">
          <img src={ad.businessLogo} alt="" className="w-10 h-10 rounded-full object-cover" />
          <div>
            <Link to={`/business/${ad.businessId}`} className="text-sm font-semibold hover:text-neon transition-colors">
              {ad.businessName}
            </Link>
            <p className="text-[10px] text-[var(--text-muted)]">Sponsored</p>
          </div>
        </div>

        {/* Interactive Ad Area */}
        <div className="relative aspect-square mx-4 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border-neon)' }}>
          <img src={ad.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

          {!revealed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-xs text-neon uppercase tracking-widest font-semibold mb-4">
                {ad.interactiveType === 'tap_reveal' ? 'Tap to Reveal' : ad.interactiveType === 'scratch' ? 'Scratch to Reveal' : 'Swipe to Compare'}
              </p>
              <h2 className="text-2xl font-bold mb-3">{ad.headline}</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-xs">{ad.description}</p>

              <button
                onClick={() => setRevealed(true)}
                className="w-24 h-24 rounded-full bg-neon/20 border-2 border-neon flex items-center justify-center animate-glow-pulse hover:scale-110 transition-transform"
              >
                <Zap className="w-10 h-10 text-neon" />
              </button>
              <p className="text-xs text-[var(--text-muted)] mt-4">Tap anywhere to interact</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_0.4s_ease]">
              <div className="w-16 h-16 rounded-full bg-neon/20 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-neon" />
              </div>
              <p className="text-xs text-neon uppercase tracking-wider font-medium mb-2">You unlocked:</p>
              <h2 className="text-2xl font-bold mb-2">{ad.offerText}</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Show this to redeem at {ad.businessName}</p>
              <Link
                to={`/redeem/offer-001`}
                className="btn-primary text-sm px-6 py-3"
              >
                {ad.ctaText} <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Engagement */}
        <div className="px-4 py-4 flex items-center gap-6">
          <button
            onClick={() => setLiked(!liked)}
            className={`flex items-center gap-2 transition-colors ${liked ? 'text-neon' : 'text-[var(--text-secondary)] hover:text-neon'}`}
          >
            <Heart className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} />
            <span className="text-sm">{((ad.interactionCount + (liked ? 1 : 0)) / 1000).toFixed(1)}k</span>
          </button>
          <div className="text-xs text-[var(--text-muted)]">
            {ad.viewCount.toLocaleString()} views
          </div>
        </div>

        {/* More from this business */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-sm font-semibold mb-3">More from {ad.businessName}</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {mockAds.filter(a => a.id !== ad.id).slice(0, 3).map(other => (
              <Link key={other.id} to={`/ad/${other.id}`} className="flex-shrink-0 w-32">
                <div className="aspect-square rounded-xl overflow-hidden mb-2">
                  <img src={other.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-medium truncate">{other.headline}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
