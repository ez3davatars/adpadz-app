import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';

type RedirectStatus = 'loading' | 'not-found' | 'inactive' | 'error';

type PublicQRLink = {
  id: string;
  title: string;
  destination_url: string;
  status: string;
  expires_at: string | null;
};

export default function QRRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<RedirectStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function runRedirect() {
      if (!slug) {
        setStatus('not-found');
        return;
      }

      const { data, error } = await supabase
        .from('qr_links')
        .select('id,title,destination_url,status,expires_at')
        .eq('slug', slug)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setStatus('error');
        return;
      }

      if (!data) {
        setStatus('not-found');
        return;
      }

      const link = data as PublicQRLink;
      const expired = link.expires_at ? new Date(link.expires_at).getTime() < Date.now() : false;

      if (link.status !== 'active' || expired) {
        setStatus('inactive');
        return;
      }

      await supabase.from('qr_scan_events').insert({
        qr_link_id: link.id,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
        metadata: {
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: `${window.screen.width}x${window.screen.height}`,
        },
      });

      if (!cancelled) {
        window.location.replace(link.destination_url);
      }
    }

    void runRedirect();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="card-surface p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-neon/10 flex items-center justify-center mx-auto mb-4">
          {status === 'loading' ? <Loader2 className="w-7 h-7 text-neon animate-spin" /> : <QrCode className="w-7 h-7 text-neon" />}
        </div>

        {status === 'loading' && (
          <>
            <h1 className="text-xl font-bold">Opening Adpadz link...</h1>
            <p className="text-sm text-[var(--text-muted)] mt-2">Your scan is being routed to the right destination.</p>
          </>
        )}

        {status === 'not-found' && (
          <>
            <h1 className="text-xl font-bold">QR link not found</h1>
            <p className="text-sm text-[var(--text-muted)] mt-2">This Adpadz QR code does not exist or has not been published yet.</p>
            <Link to="/" className="btn-primary mt-5 text-sm px-5 py-2.5">Go to Adpadz</Link>
          </>
        )}

        {status === 'inactive' && (
          <>
            <h1 className="text-xl font-bold">QR link inactive</h1>
            <p className="text-sm text-[var(--text-muted)] mt-2">This Adpadz QR code has been paused, archived, or expired.</p>
            <Link to="/" className="btn-primary mt-5 text-sm px-5 py-2.5">Go to Adpadz</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold">Could not open QR link</h1>
            <p className="text-sm text-[var(--text-muted)] mt-2">Something went wrong while loading this Adpadz QR destination.</p>
            <Link to="/" className="btn-primary mt-5 text-sm px-5 py-2.5">Go to Adpadz</Link>
          </>
        )}
      </div>
    </main>
  );
}
