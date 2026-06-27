import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (err) setError(err.message);
      else navigate('/app/business/dashboard');
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else navigate('/app/business/dashboard');
    }
    setLoading(false);
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
            Create AI-powered interactive ads that engage your local audience and drive real business results.
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
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {isSignUp ? 'Start creating interactive ads in minutes' : 'Sign in to manage your campaigns'}
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe" className="input-field pl-10" required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@business.com" className="input-field pl-10" required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters" className="input-field pl-10 pr-10" required minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-neon hover:underline font-medium">
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
