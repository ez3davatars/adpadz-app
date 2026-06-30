import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { isSupabaseConfigured, missingSupabaseEnvVars, supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Feed from './pages/consumer/Feed';
import AdView from './pages/consumer/AdView';
import BusinessProfile from './pages/consumer/BusinessProfile';
import RedeemOffer from './pages/consumer/RedeemOffer';
import QRRedirect from './pages/QRRedirect';
import SmartCardPublic from './pages/SmartCardPublic';
import BusinessLayout from './components/layout/BusinessLayout';
import BizDashboard from './pages/business/Dashboard';
import BizCreateAd from './pages/business/CreateAd';
import BizCampaigns from './pages/business/Campaigns';
import BizQRStudio from './pages/business/QRStudio';
import BizSmartCards from './pages/business/SmartCards';
import BizAnalytics from './pages/business/Analytics';
import BizAssets from './pages/business/Assets';
import BizServices from './pages/business/Services';
import BizLeads from './pages/business/Leads';
import BizSocial from './pages/business/Social';
import BizSettings from './pages/business/Settings';
import InstallPrompt from './components/ui/InstallPrompt';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return <MissingSupabaseConfig />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={session ? <Navigate to="/app/business/dashboard" /> : <AuthPage />} />

        <Route path="/q/:slug" element={<QRRedirect />} />
        <Route path="/c/:slug" element={<SmartCardPublic />} />

        {/* Consumer routes */}
        <Route path="/feed" element={<Feed />} />
        <Route path="/ad/:adId" element={<AdView />} />
        <Route path="/business/:slug" element={<BusinessProfile />} />
        <Route path="/redeem/:offerId" element={<RedeemOffer />} />

        {/* Business app routes */}
        <Route path="/app/business" element={session ? <BusinessLayout session={session} /> : <Navigate to="/auth" />}>
          <Route path="dashboard" element={<BizDashboard />} />
          <Route path="create-ad" element={<BizCreateAd />} />
          <Route path="campaigns" element={<BizCampaigns />} />
          <Route path="qr-studio" element={<BizQRStudio />} />
          <Route path="smart-cards" element={<BizSmartCards />} />
          <Route path="smart-cards/new" element={<BizSmartCards mode="new" />} />
          <Route path="smart-cards/:id/edit" element={<BizSmartCards mode="edit" />} />
          <Route path="analytics" element={<BizAnalytics />} />
          <Route path="assets" element={<BizAssets />} />
          <Route path="services" element={<BizServices />} />
          <Route path="leads" element={<BizLeads />} />
          <Route path="social" element={<BizSocial />} />
          <Route path="settings" element={<BizSettings />} />
          <Route index element={<Navigate to="dashboard" />} />
        </Route>

        <Route path="/dashboard" element={session ? <BusinessLayout session={session} /> : <Navigate to="/auth" />}>
          <Route path="smart-cards" element={<BizSmartCards />} />
          <Route path="smart-cards/new" element={<BizSmartCards mode="new" />} />
          <Route path="smart-cards/:id/edit" element={<BizSmartCards mode="edit" />} />
          <Route index element={<Navigate to="smart-cards" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  );
}

function MissingSupabaseConfig() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-lime-400/30 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400 text-black font-black">
          A
        </div>
        <h1 className="text-2xl font-bold">Supabase env vars are missing</h1>
        <p className="mt-2 text-sm text-neutral-300">
          Add these keys to a local .env file, then restart npm run dev.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-black p-4 text-sm text-lime-300">
{missingSupabaseEnvVars.map(name => `${name}=...`).join('\n')}
        </pre>
      </section>
    </main>
  );
}

