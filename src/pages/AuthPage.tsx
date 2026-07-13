import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot' | 'recovery' | 'confirmation';

function recoveryUrl() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return query.get('recovery') === '1' || hash.get('type') === 'recovery';
}

function ConfirmationPending(props: {
  email: string;
  error: string;
  message: string;
  loading: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const { email, error, message, loading, onResend, onChangeEmail } = props;
  return (
    <main className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--bg-base)' }}>
      <section aria-labelledby="confirm-heading" className="w-full max-w-md text-center">
        <Mail className="mx-auto mb-5 h-10 w-10 text-neon" aria-hidden="true" />
        <h1 id="confirm-heading" className="text-xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account.</p>
        {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}
        {message && <p role="status" className="mt-5 text-sm text-neon">{message}</p>}
        <button type="button" onClick={onResend} disabled={loading} className="btn-primary mt-6 w-full py-3.5 text-sm">{loading ? 'Sending...' : 'Resend confirmation email'}</button>
        <button type="button" onClick={onChangeEmail} className="mt-4 text-sm text-neon hover:underline">Use a different email</button>
        <p className="mt-4 text-xs text-[var(--text-muted)]">Check your spam folder if it does not arrive.</p>
      </section>
    </main>
  );
}

function friendlyError(message: string, fallback: string) {
  if (/invalid login credentials/i.test(message)) return 'Check your email and password, then try again.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email before signing in. You can resend the email below.';
  if (/rate limit|too many requests|security purposes/i.test(message)) return 'Please wait a moment before trying again.';
  if (/expired|invalid.*token|otp/i.test(message)) return 'This link is invalid or expired. Request a new one and try again.';
  if (/fetch|network/i.test(message)) return 'Check your connection and try again.';
  return fallback;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(() => recoveryUrl() ? 'recovery' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');

  const isSignUp = mode === 'sign-up';
  const isForgot = mode === 'forgot';
  const isRecovery = mode === 'recovery';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setMode('recovery');
    });
    return () => subscription.unsubscribe();
  }, []);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (isRecovery && password !== confirmPassword) {
      setError('The passwords do not match. Please enter them again.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) await signUp();
      else if (isForgot) await requestReset();
      else if (isRecovery) await updatePassword();
      else await signIn();
    } catch (requestError) {
      if (import.meta.env.DEV) console.error('[AuthPage] authentication request failed', requestError);
      const detail = requestError instanceof Error ? requestError.message : '';
      setError(friendlyError(detail, 'We could not complete that request. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/app/business/dashboard`,
      },
    });
    if (authError) {
      setError(friendlyError(authError.message, 'We could not create your account. Review your details and try again.'));
    } else if (data.session) {
      navigate('/app/business/dashboard', { replace: true });
    } else {
      setConfirmationEmail(email.trim());
      setMode('confirmation');
      setPassword('');
    }
  }

  async function signIn() {
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!authError) {
      navigate('/app/business/dashboard', { replace: true });
      return;
    }
    if (/email not confirmed/i.test(authError.message)) {
      setConfirmationEmail(email.trim());
      setMode('confirmation');
    }
    setError(friendlyError(authError.message, 'We could not sign you in. Please try again.'));
  }

  async function requestReset() {
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/app/business/dashboard?recovery=1`,
    });
    if (authError) {
      setError(friendlyError(authError.message, 'We could not send the reset email. Please try again.'));
    } else {
      setMessage(`If an account exists for ${email.trim()}, a reset link is on its way.`);
    }
  }

  async function updatePassword() {
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setError(friendlyError(authError.message, 'We could not update your password. The recovery link may have expired.'));
    } else {
      navigate('/app/business/dashboard', { replace: true });
    }
  }

  async function resendConfirmation() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { error: authError } = await supabase.auth.resend({ type: 'signup', email: confirmationEmail, options: { emailRedirectTo: `${window.location.origin}/app/business/dashboard` } });
      if (authError) setError(friendlyError(authError.message, 'We could not resend the confirmation email. Please try again.'));
      else setMessage(`A new confirmation email was sent to ${confirmationEmail}.`);
    } catch {
      setError('We could not resend the confirmation email. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'confirmation') {
    return <ConfirmationPending email={confirmationEmail} error={error} message={message} loading={loading} onResend={() => void resendConfirmation()} onChangeEmail={() => changeMode('sign-up')} />;
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12" style={{ background: 'var(--bg-surface)' }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-neon/[0.04] rounded-full blur-[80px]" />
        </div>
        <div className="relative text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-neon flex items-center justify-center mx-auto mb-8">
            <span className="text-black font-black text-2xl">A</span>
          </div>
          <h2 className="text-2xl font-bold mb-3">Welcome to <span className="gradient-text">AdPadz</span></h2>
          <p className="text-[var(--text-secondary)] leading-relaxed text-sm">
            Build one local campaign, connect every customer experience, and follow the path from scan to lead.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-neon transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <h1 className="text-xl font-bold mb-1">
            {isSignUp ? 'Create your account' : isRecovery ? 'Choose a new password' : isForgot ? 'Reset your password' : 'Welcome back'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {isSignUp ? 'Build your connected local marketing workspace' : isRecovery ? 'Enter a new password for your account' : isForgot ? 'We will email you a secure reset link' : 'Sign in to manage your campaigns'}
          </p>

          {error && (
            <div role="alert" className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}
          {message && <div role="status" className="mb-5 p-3 rounded-xl bg-neon/10 border border-neon/20 text-neon text-sm">{message}</div>}

          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            {isSignUp && (
              <div>
                <label htmlFor="auth-name" className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    id="auth-name" name="name" autoComplete="name" type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe" className="input-field pl-10" required
                  />
                </div>
              </div>
            )}

            {!isRecovery && <div>
              <label htmlFor="auth-email" className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  id="auth-email" name="email" autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@business.com" className="input-field pl-10" required
                />
              </div>
            </div>}

            {!isForgot && <div>
              <label htmlFor="auth-password" className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{isRecovery ? 'New password' : 'Password'}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  id="auth-password" name="password" autoComplete={isSignUp || isRecovery ? 'new-password' : 'current-password'}
                  type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters" className="input-field pl-10 pr-10" required minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>}

            {isRecovery && (
              <div>
                <label htmlFor="auth-confirm-password" className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                  <input id="auth-confirm-password" name="confirm-password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter it again" className="input-field pl-10" required minLength={6} />
                </div>
              </div>
            )}

            {mode === 'sign-in' && <div className="text-right"><button type="button" onClick={() => changeMode('forgot')} className="text-xs font-medium text-neon hover:underline">Forgot password?</button></div>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? 'Creating account...' : isForgot ? 'Sending reset link...' : isRecovery ? 'Updating password...' : 'Signing in...'}
                </span>
              ) : (
                isSignUp ? 'Create Account' : isForgot ? 'Send reset link' : isRecovery ? 'Update password' : 'Sign In'
              )}
            </button>
          </form>

          {isForgot || isRecovery ? (
            <p className="mt-5 text-center text-sm"><button type="button" onClick={() => changeMode('sign-in')} className="text-neon hover:underline font-medium">Back to sign in</button></p>
          ) : (
            <>
              <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button type="button" onClick={() => changeMode(isSignUp ? 'sign-in' : 'sign-up')} className="text-neon hover:underline font-medium">{isSignUp ? 'Sign in' : 'Sign up'}</button>
              </p>
              <div className="my-5 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-white/10" /><span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">or explore first</span><span className="h-px flex-1 bg-white/10" /></div>
              <Link to="/demo/workspace" className="flex min-h-11 w-full items-center justify-center rounded-full border border-neon/30 bg-neon/[0.07] px-4 text-sm font-black text-neon transition hover:bg-neon/[0.12]">
                Open the guided demo
              </Link>
              <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">No sign-in - fictional sample data - reset anytime</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
