import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';

type RedirectStatus = 'loading' | 'not-found' | 'inactive' | 'error';
type RedirectResult = { ok?: boolean; status?: string; destination_url?: string };

export default function QRRedirect() {
  const { slug = '' } = useParams();
  const [status, setStatus] = useState<RedirectStatus>('loading');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function runRedirect() {
      if (!slug) {
        setStatus('not-found');
        return;
      }

      const { data, error } = await supabase.rpc('resolve_qr_redirect', {
        p_slug: slug,
        p_user_agent: navigator.userAgent,
        p_referrer: document.referrer || null,
      });
      if (cancelled) return;

      if (error) {
        if (import.meta.env.DEV) console.error('[QRRedirect] redirect resolution failed', error);
        setDetail('The QR service could not resolve this destination. Please try again.');
        setStatus('error');
        return;
      }

      const result = (data ?? {}) as RedirectResult;
      if (!result.ok || !result.destination_url) {
        setStatus(result.status === 'not_found' ? 'not-found' : 'inactive');
        return;
      }

      try {
        const destination = new URL(result.destination_url);
        if (!['http:', 'https:'].includes(destination.protocol)) throw new Error('Unsupported destination protocol.');
        window.location.replace(destination.toString());
      } catch (destinationError) {
        setDetail(destinationError instanceof Error ? destinationError.message : 'The saved destination is invalid.');
        setStatus('error');
      }
    }

    void runRedirect();
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-6">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neon/10">
          {status === 'loading' ? <Loader2 className="h-7 w-7 animate-spin text-neon" /> : <QrCode className="h-7 w-7 text-neon" />}
        </div>
        {status === 'loading' && <StatusCopy title="Opening Adpadz link..." body="Your scan is being recorded and routed to the current destination." />}
        {status === 'not-found' && <StatusCopy title="QR link not found" body="This Adpadz QR code does not exist or has not been published." />}
        {status === 'inactive' && <StatusCopy title="QR destination unavailable" body="This link, Business Profile, or campaign is paused, archived, expired, or not active yet." />}
        {status === 'error' && <StatusCopy title="Could not open QR link" body={detail || 'The QR service could not resolve this destination.'} />}
        {status !== 'loading' && <Link to="/" className="btn-primary mt-5 px-5 py-2.5 text-sm">Go to Adpadz</Link>}
      </div>
    </main>
  );
}

function StatusCopy({ title, body }: { title: string; body: string }) {
  return <><h1 className="text-xl font-black">{title}</h1><p className="mt-2 text-sm text-[var(--text-muted)]">{body}</p></>;
}
