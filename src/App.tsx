import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, missingSupabaseEnvVars, supabase } from './lib/supabase';
import { getAuthSignInPath, getSafeAuthDestination, isRecoveryRequest } from './lib/authRedirect';
import { isPublicStandaloneRoute } from './lib/publicRoutes';

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
const BizCommunityCampaigns = lazy(() => import('./pages/business/CommunityCampaigns'));
const CommunityCardPublic = lazy(() => import('./pages/CommunityCardPublic'));
const CampaignShell = lazy(() => import('./components/campaign-shell/CampaignShell'));
const CampaignContentStudio = lazy(() => import('./pages/business/CampaignContentStudio'));
const CampaignCreativeWorkshop = lazy(() => import('./pages/business/CampaignCreativeWorkshop'));
const CampaignReview = lazy(() => import('./pages/business/CampaignReview'));
const CampaignDistribution = lazy(() => import('./pages/business/CampaignDistribution'));
const BizQRStudio = lazy(() => import('./pages/business/QRStudio'));
const BizSmartCards = lazy(() => import('./pages/business/SmartCards'));
const BizAnalytics = lazy(() => import('./pages/business/Analytics'));
const BizAssets = lazy(() => import('./pages/business/Assets'));
const BizServices = lazy(() => import('./pages/business/Services'));
const BizLeads = lazy(() => import('./pages/business/Leads'));
const BizSettings = lazy(() => import('./pages/business/Settings'));
const BizBilling = lazy(() => import('./pages/business/Billing'));
const InstallPrompt = lazy(() => import('./components/ui/InstallPrompt'));
const AdminGuard = lazy(() => import('./components/admin/AdminGuard'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminAccessDenied = lazy(() => import('./pages/admin/AdminAccessDenied'));
const AdminCommunityMailers = lazy(() => import('./pages/admin/AdminCommunityMailers'));
const AdminCommunityMailerDetail = lazy(() => import('./pages/admin/AdminCommunityMailerDetail'));

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

  const isPublicRoute = isPublicStandaloneRoute(window.location.pathname);
  if (loading && !isPublicRoute) return <LoadingScreen label="Restoring your session..." />;

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
          <Route
            path="/auth"
            element={<AuthenticationRoute session={session} />}
          />

          <Route path="/admin/login" element={!isSupabaseConfigured ? <MissingSupabaseConfig /> : <AdminLogin session={session} />} />
          <Route path="/admin/access-denied" element={!isSupabaseConfigured ? <MissingSupabaseConfig /> : <AdminAccessDenied session={session} />} />
          <Route path="/admin" element={!isSupabaseConfigured ? <MissingSupabaseConfig /> : <AdminGuard session={session} />}>
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="community-mailers" element={<AdminCommunityMailers />} />
              <Route path="community-mailers/:mailerId" element={<AdminCommunityMailerDetail />} />
              <Route path="community-mailers/:mailerId/placements" element={<AdminCommunityMailerDetail />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>

          <Route path="/q/:slug" element={<QRRedirect />} />
          <Route path="/c/:slug" element={<SmartCardPublic />} />
          <Route path="/business/:slug" element={<SmartCardPublic />} />
          <Route path="/community-cards/:slug" element={<CommunityCardPublic />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/ad/:adId" element={<AdView />} />
          <Route path="/redeem/:offerId" element={<RedeemOffer />} />

          <Route path="/app/business" element={<ProtectedBusinessRoute session={session} />}>
            <Route path="dashboard" element={<BizDashboard />} />
            <Route path="create-ad" element={<BizCreateAd />} />
            <Route path="campaigns" element={<BizCampaigns />} />
            <Route path="community-cards" element={<Navigate to="../community-campaigns" replace />} />
            <Route path="community-campaigns" element={<BizCommunityCampaigns />} />
            {/* One Campaign shell: Setup → Studio → Review → Publish. */}
            <Route path="campaigns/:campaignId" element={<CampaignShell />}>
              <Route path="setup" element={<BizCreateAd />} />
              <Route path="edit" element={<RedirectPreservingSearch to="../setup" />} />
              <Route path="content" element={<CampaignContentStudio />} />
              <Route path="creative" element={<CampaignCreativeWorkshop />} />
              <Route path="review" element={<CampaignReview />} />
              <Route path="distribution" element={<CampaignDistribution />} />
              <Route path="distribution/social" element={<CampaignDistribution />} />
              <Route index element={<Navigate to="setup" replace />} />
            </Route>
            <Route path="qr-studio" element={<BizQRStudio />} />
            <Route path="smart-cards" element={<BizSmartCards />} />
            <Route path="smart-cards/new" element={<BizSmartCards mode="new" />} />
            <Route path="smart-cards/:id/edit" element={<BizSmartCards mode="edit" />} />
            <Route path="analytics" element={<BizAnalytics />} />
            <Route path="assets" element={<BizAssets />} />
            <Route path="services" element={<BizServices />} />
            <Route path="leads" element={<BizLeads />} />
            <Route path="social" element={<Navigate to="../campaigns" replace />} />
            <Route path="settings" element={<BizSettings />} />
            <Route path="billing" element={<BizBilling />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="/dashboard" element={<ProtectedBusinessRoute session={session} />}>
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

function AuthenticationRoute({ session }: { session: Session | null }) {
  const location = useLocation();

  if (!isSupabaseConfigured) return <MissingSupabaseConfig />;
  if (session && !isRecoveryRequest(location.search, location.hash)) {
    return <Navigate to={getSafeAuthDestination(location.search)} replace />;
  }
  return <AuthPage />;
}

function ProtectedBusinessRoute({ session }: { session: Session | null }) {
  const location = useLocation();

  if (!isSupabaseConfigured) return <MissingSupabaseConfig />;
  if (session) return <BusinessLayout session={session} />;
  const destination = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={getAuthSignInPath(destination)} replace />;
}


/** Legacy deep links (for example /edit?section=media) keep their query intact. */
function RedirectPreservingSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
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
