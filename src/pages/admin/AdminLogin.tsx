import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import AdpadzBrand from '../../components/AdpadzBrand';
import { AdpadzButton } from '../../components/adpadz-ui';
import { decideAdminRoute, getAdminAccess } from '../../lib/admin/adminAuth';
import { supabase } from '../../lib/supabase';
import '../../components/admin/MissionControl.css';

type AdminLoginProps = {
  session: Session | null;
};

type LoginMode = 'sign-in' | 'forgot' | 'recovery';

function isRecoveryUrl(): boolean {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return query.get('recovery') === '1' || hash.get('type') === 'recovery';
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Check your email and password, then try again.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email before signing in.';
  if (/rate limit|too many requests|security purposes/i.test(message)) return 'Please wait a moment before trying again.';
  if (/expired|invalid.*token|otp/i.test(message)) return 'This recovery link is invalid or expired. Request a new one.';
  if (/fetch|network/i.test(message)) return 'Check your connection and try again.';
  return 'Mission Control could not complete that request. Please try again.';
}

export default function AdminLogin({ session }: AdminLoginProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>(() => isRecoveryUrl() ? 'recovery' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Mission Control Sign In · Adpadz';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setMode('recovery');
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || mode === 'recovery') {
      setCheckingSession(false);
      return;
    }
    let cancelled = false;
    setCheckingSession(true);
    void getAdminAccess().then(access => {
      if (cancelled) return;
      setCheckingSession(false);
      const decision = decideAdminRoute(access.status, 'login');
      if (decision.action === 'redirect') navigate(decision.to, { replace: true });
      else if (access.status === 'error') setError(access.message);
    });
    return () => { cancelled = true; };
  }, [mode, navigate, session]);

  function changeMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmation('');
  }

  async function routeAfterAuthentication() {
    const access = await getAdminAccess();
    const decision = decideAdminRoute(access.status, 'login');
    if (decision.action === 'redirect') {
      navigate(decision.to, { replace: true });
      return;
    }
    if (access.status === 'error') setError(access.message);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (mode === 'recovery' && password !== confirmation) {
      setError('The passwords do not match. Enter them again.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/admin/login?recovery=1`,
        });
        if (resetError) throw resetError;
        setMessage(`If an account exists for ${email.trim()}, a secure reset link is on its way.`);
      } else if (mode === 'recovery') {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await routeAfterAuthentication();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        await routeAfterAuthentication();
      }
    } catch (requestError) {
      if (import.meta.env.DEV) console.error('[Mission Control] authentication request failed', requestError);
      const detail = requestError instanceof Error ? requestError.message : '';
      setError(friendlyAuthError(detail));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession && mode !== 'recovery') {
    return (
      <main className="mission-control-shell flex min-h-screen items-center justify-center p-6">
        <p role="status" className="text-sm font-bold text-[var(--text-secondary)]">Verifying your Mission Control session…</p>
      </main>
    );
  }

  const forgot = mode === 'forgot';
  const recovery = mode === 'recovery';

  return (
    <main className="mission-control-shell grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)]">
      <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14" aria-label="Mission Control introduction">
        <div>
          <AdpadzBrand />
          <div className="mission-control-rule mt-8 w-32" />
        </div>
        <div className="relative max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/[0.07] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-neon">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" /> Internal operations
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white xl:text-5xl">Mission Control</h1>
          <p className="mt-5 text-base leading-7 text-[var(--text-secondary)]">A protected operational workspace for the Adpadz team to monitor businesses, campaigns, leads, placements, and the work that needs attention.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-[var(--text-secondary)]">
            {['Verified administrator access', 'Live operational records', 'Role-based internal workspace', 'No public registration'].map(item => (
              <div key={item} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon" aria-hidden="true" /> {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Adpadz internal systems</p>
      </section>

      <section className="flex min-w-0 items-center justify-center px-4 py-8 safe-bottom safe-top sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
            <AdpadzBrand compact />
            <span className="rounded-full border border-neon/20 bg-neon/[0.07] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-neon">Mission Control</span>
          </div>

          <Link to="/" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-neon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Adpadz
          </Link>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neon">Secure administrator access</p>
          <h2 className="mt-2 text-3xl font-black text-white">
            {recovery ? 'Choose a new password' : forgot ? 'Recover your access' : 'Sign in to Mission Control'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {recovery ? 'Set a new password for your existing Adpadz account.' : forgot ? 'We will send a secure recovery link to your account email.' : 'Use your existing authorized Adpadz administrator account.'}
          </p>

          {error ? <div role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
          {message ? <div role="status" className="mt-6 rounded-2xl border border-neon/25 bg-neon/[0.08] p-4 text-sm text-neon">{message}</div> : null}

          <form onSubmit={handleSubmit} aria-busy={loading} className="mt-7 space-y-4">
            {!recovery ? (
              <div>
                <label htmlFor="admin-email" className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                  <input id="admin-email" name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="input-field min-h-12 pl-11" placeholder="admin@company.com" />
                </div>
              </div>
            ) : null}

            {!forgot ? (
              <div>
                <label htmlFor="admin-password" className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">{recovery ? 'New password' : 'Password'}</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                  <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={recovery ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={event => setPassword(event.target.value)} className="input-field min-h-12 pl-11 pr-12" />
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon">
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            ) : null}

            {recovery ? (
              <div>
                <label htmlFor="admin-password-confirmation" className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Confirm new password</label>
                <input id="admin-password-confirmation" name="password-confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="input-field min-h-12" />
              </div>
            ) : null}

            {!forgot && !recovery ? (
              <div className="text-right">
                <button type="button" onClick={() => changeMode('forgot')} className="min-h-11 text-xs font-bold text-neon hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon">Forgot password?</button>
              </div>
            ) : null}

            <AdpadzButton type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? 'Working…' : recovery ? 'Update password' : forgot ? 'Send recovery link' : 'Sign in securely'}
            </AdpadzButton>
          </form>

          {forgot || recovery ? (
            <button type="button" onClick={() => changeMode('sign-in')} className="mt-5 min-h-11 w-full text-sm font-semibold text-neon hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon">Back to administrator sign in</button>
          ) : null}
          <p className="mt-6 text-center text-xs leading-5 text-[var(--text-muted)]">Access is limited to active administrator accounts. There is no public registration for Mission Control.</p>
        </div>
      </section>
    </main>
  );
}
