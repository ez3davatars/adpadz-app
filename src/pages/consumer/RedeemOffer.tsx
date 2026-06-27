import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { mockOffers } from '../../lib/mock-data';
import { useState } from 'react';

export default function RedeemOffer() {
  const { offerId } = useParams();
  const offer = mockOffers.find(o => o.id === offerId) || mockOffers[0];
  const [redeemed, setRedeemed] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = `ADPADZ-${offer.id.slice(-3).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const daysLeft = Math.ceil((new Date(offer.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  function handleCopy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <header className="sticky top-0 z-50 border-b safe-top"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/feed" className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm font-semibold">Redeem Offer</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Offer Card */}
        <div className="card-glass p-6 text-center">
          <img src={offer.businessLogo} alt="" className="w-14 h-14 rounded-full mx-auto object-cover mb-3" />
          <p className="text-xs text-[var(--text-muted)]">{offer.businessName}</p>
          <h1 className="text-xl font-bold mt-2">{offer.title}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xs mx-auto">{offer.description}</p>

          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--text-muted)]">
            <Clock className="w-3.5 h-3.5" />
            <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Expires soon'}</span>
          </div>

          <div className="mt-4 text-xs text-[var(--text-muted)]">
            {offer.maxRedemptions - offer.currentRedemptions} of {offer.maxRedemptions} remaining
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
            <div
              className="h-full rounded-full bg-neon transition-all"
              style={{ width: `${(offer.currentRedemptions / offer.maxRedemptions) * 100}%` }}
            />
          </div>
        </div>

        {/* Redeem section */}
        {!redeemed ? (
          <div className="mt-6 text-center">
            <button
              onClick={() => setRedeemed(true)}
              className="btn-primary text-base px-8 py-4 w-full"
            >
              Claim This Offer
            </button>
            <p className="text-xs text-[var(--text-muted)] mt-3">
              You may be asked to show this code at the business location.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="card-surface p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-neon mx-auto mb-3" />
              <p className="text-sm font-semibold text-neon">Offer Claimed!</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Show this code to redeem:</p>

              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="px-5 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-neon)] font-mono text-lg font-bold tracking-wider text-neon">
                  {code}
                </div>
                <button
                  onClick={handleCopy}
                  className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] hover:border-[var(--border-neon)] transition-colors"
                >
                  <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>
              {copied && <p className="text-xs text-neon mt-2">Copied!</p>}

              <p className="text-xs text-[var(--text-muted)] mt-4">
                Valid until {new Date(offer.endDate).toLocaleDateString()}
              </p>
            </div>

            <Link
              to={`/business/${offer.businessId}`}
              className="btn-secondary w-full mt-4 text-sm py-3"
            >
              Visit {offer.businessName} <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Image */}
        <div className="mt-6 rounded-2xl overflow-hidden">
          <img src={offer.imageUrl} alt="" className="w-full h-48 object-cover" />
        </div>
      </div>
    </div>
  );
}
