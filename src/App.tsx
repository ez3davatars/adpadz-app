import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, missingSupabaseEnvVars, supabase } from './lib/supabase';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DemoShowcase = lazy(() => import('./pages/DemoShowcase'));
const DemoWorkspace = lazy(() => import('./pages/DemoWorkspace'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Feed = lazy(() => import('./pages/consumer/Feed'));
const AdView = lazy(() => import('./pages/consumer/AdView'));
const RedeemOffer = lazy(() => import('./pages/consumer/RedeemOffer'));
const QRRedirect = lazy(() => import('./pages/QRRedirect'));
const SmartCardPublic = lazy(() => import('./pages/SmartCardPublic'));
const BusinessLayout = lazy(() => import('./components/layout/BusinessLayout'));
const BizDashboard = lazy(() => import('./pages/business/Dashboard'));
const BizCreateAd = lazy(() => import('./pages/business/CreateAd'));
const BizCampaigns = lazy(() => import('./pages/business/Campaigns'));
const CommunityAdOrders = lazy(() => import('./pages/business/CommunityAdOrders'));
const CommunityCardAdmin = lazy(() => import('./pages/admin/CommunityCardAdmin'));
const AdminRoute = lazy(() => import('./components/auth/AdminRoute'));
const CommunityCardPublic = lazy(() => import('./pages/CommunityCardPublic'));
const CampaignContentStudio = lazy(() => import('./pages/business/CampaignContentStudio'));
const BizQRStudio = lazy(() => import('./pages/business/QRStudio'));
const BizSmartCards = lazy(() => import('./pages/business/SmartCards'));
const BizAnalytics = lazy(() => import('./pages/business/Analytics'));
const BizAssets = lazy(() => import('./pages/business/Assets'));
const BizServices = lazy(() => import('./pages/business/Services'));
const BizLeads = lazy(() => import('./pages/business/Leads'));
const BizSocial = lazy(() => import('./pages/business/Social'));
const BizSettings = lazy(() => import('./pages/business/Settings'));
const BizBilling = lazy(() => import('./pages/business/Billing'));
const InstallPrompt = lazy(() => import('./components/ui/InstallPrompt'));

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error && import.meta.env.DEV) console.error('[App] session restore failed', error);
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) return <LoadingScreen label="Restoring your Adpadz workspace..." />;

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<LoadingScreen label="Opening Adpadz..." />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/examples" element={<DemoShowcase />} />
          <Route path="/demo" element={<Navigate to="/examples" replace />} />
          <Route path="/demo/workspace" element={<DemoWorkspace />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/auth" element={!isSupabaseConfigured ? <MissingSupabaseConfig /> : session ? <Navigate to="/app/business/dashboard" replace /> : <AuthPage />} />

          <Route path="/q/:slug" element={<QRRedirect />} />
          <Route path="/c/:slug" element={<SmartCardPublic />} />
          <Route path="/business/:slug" element={<SmartCardPublic />} />
          <Route path="/community-cards/:slug" element={<CommunityCardPublic />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/ad/:adId" element={<AdView />} />
          <Route path="/redeem/:offerId" element={<RedeemOffer />} />

          <Route path="/app/business" element={!isSupabaseConfigured ? <MissingSupabaseConfig /> : session ? <BusinessLayout session={session} /> : <Navigate to="/auth" replace />}>
            <Route path="dashboard" element={<BizDashboard />} />
            <Route path="create-ad" element={<BizCreateAd />} />
            <Route path="campaigns" element={<BizCampaigns />} />
            <Route path="community-cards" element={<Navigate to="../community-ads" replace />} />
            <Route path="community-ads" element={<CommunityAdOrders />} />
            <Route path="campaigns/:campaignId/edit" element={<BizCreateAd />} />
            <Route path="campaigns/:campaignId/content" element={<CampaignContentStudio />} />
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
            <Route path="billing" element={<BizBilling />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="/app/admin/community-cards" element={!isSupabaseConfigured ? <MissingSupabaseConfig /> : session ? <AdminRoute><CommunityCardAdmin /></AdminRoute> : <Navigate to="/auth?next=/app/admin/community-cards" replace />} />

          <Route path="/dashboard" element={!isSupabaseConfigured ? <MissingSupabaseConfig /> : session ? <BusinessLayout session={session} /> : <Navigate to="/auth" replace />}>
            <Route path="smart-cards" element={<BizSmartCards />} />
            <Route path="smart-cards/new" element={<BizSmartCards mode="new" />} />
            <Route path="smart-cards/:id/edit" element={<BizSmartCards mode="edit" />} />
            <Route index element={<Navigate to="smart-cards" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <InstallPrompt />
      </Suspense>
    </BrowserRouter>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg-base)] text-[var(--text-muted)]">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      <p className="text-xs font-bold">{label}</p>
    </div>
  );
}

function MissingSupabaseConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-lime-400/30 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400 font-black text-black">A</div>
        <h1 className="text-2xl font-bold">Supabase configuration is missing</h1>
        <p className="mt-2 text-sm text-neutral-300">Add these keys to a local .env file, then restart the development server.</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-black p-4 text-sm text-lime-300">{missingSupabaseEnvVars.map(name => `${name}=...`).join('\n')}</pre>
      </section>
    </main>
  );
}
