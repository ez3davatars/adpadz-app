import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSafeAuthDestination, isRecoveryRequest } from '../lib/authRedirect';
import { logAuthError, mapAuthError } from '../lib/authErrors';
import {
  createAuthSubmissionGuard,
  getAuthCallbackUrl,
  normalizeAuthEmail,
  normalizeFullName,
  performSignIn,
  performSignup,
  requestPasswordReset,
  updateRecoveredPassword,
} from '../lib/authFlow';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot' | 'recovery' | 'confirmation';

function recoveryUrl() {
  return isRecoveryRequest(window.location.search, window.location.hash);
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

export default function AuthPage() {
  const navigate = useNavigate();
  const authDestination = getSafeAuthDestination(window.location.search);
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
  const [existingAccount, setExistingAccount] = useState(false);
  const submissionGuard = useRef(createAuthSubmissionGuard());

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
    setExistingAccount(false);
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!submissionGuard.current.acquire()) return;
    setError('');
    setMessage('');
    setExistingAccount(false);
    const normalizedEmail = normalizeAuthEmail(email);
    if (!isRecovery) setEmail(normalizedEmail);
    if (isSignUp && !normalizeFullName(fullName)) {
      setError('Enter your full name to create an account.');
      submissionGuard.current.release();
      return;
    }
    if (isRecovery && password !== confirmPassword) {
      setError('The passwords do not match. Please enter them again.');
      submissionGuard.current.release();
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) await signUp();
      else if (isForgot) await requestReset();
      else if (isRecovery) await updatePassword();
      else await signIn();
    } catch (requestError) {
      logAuthError('AuthPage', requestError);
      const mappedError = mapAuthError(requestError);
      if (mappedError === 'An account already exists for this email.') setExistingAccount(true);
      setError(mappedError);
    } finally {
      setLoading(false);
      submissionGuard.current.release();
    }
  }

  async function signUp() {
    const outcome = await performSignup(supabase.auth, {
      email,
      password,
      fullName,
      origin: window.location.origin,
      destination: authDestination,
    });
    setEmail(outcome.email);
    if (outcome.kind === 'existing') {
      setExistingAccount(true);
      setError('An account already exists for this email.');
    } else if (outcome.kind === 'session') {
      navigate(authDestination, { replace: true });
    } else {
      setConfirmationEmail(outcome.email);
      setMode('confirmation');
      setPassword('');
    }
  }

  async function signIn() {
    try {
      await performSignIn(supabase.auth, email, password);
      navigate(authDestination, { replace: true });
    } catch (authError) {
      if (/email not confirmed/i.test(authError instanceof Error ? authError.message : '')) {
        const normalizedEmail = normalizeAuthEmail(email);
        setConfirmationEmail(normalizedEmail);
        setMode('confirmation');
      }
      throw authError;
    }
  }

  async function requestReset() {
    const normalizedEmail = await requestPasswordReset(supabase.auth, email, window.location.origin);
    setEmail(normalizedEmail);
    setMessage(`If an account exists for ${normalizedEmail}, a reset link is on its way.`);
  }

  async function updatePassword() {
    await updateRecoveredPassword(supabase.auth, password);
    navigate('/app/business/dashboard', { replace: true });
  }
  async function resendConfirmation() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { error: authError } = await supabase.auth.resend({ type: 'signup', email: confirmationEmail, options: { emailRedirectTo: getAuthCallbackUrl(window.location.origin, authDestination) } });
      if (authError) throw authError;
      else setMessage(`A new confirmation email was sent to ${confirmationEmail}.`);
    } catch (requestError) {
      logAuthError('AuthPage.resend', requestError);
      setError(mapAuthError(requestError));
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
            <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <p>{error}</p>
              {existingAccount && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => changeMode('sign-in')} className="font-bold text-neon hover:underline">Sign in</button>
                  <button type="button" onClick={() => changeMode('forgot')} className="font-bold text-neon hover:underline">Reset password</button>
                </div>
              )}
            </div>
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
