import { type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { DevLayout, PlaceholderPage } from "./pages/dev/DevLayout";
import ComponentGallery from "./pages/dev/ComponentGallery";
import "./styles/collabgarden-ui.css";
import DirectoryPage from "./pages/directory/DirectoryPage";
import BusinessProfilePage from "./pages/profiles/BusinessProfilePage";
import CreatorProfilePage from "./pages/profiles/CreatorProfilePage";
import LoginPage, { LogoutPage } from "./pages/auth/LoginPage";
import { SiteHeader } from "./pages/auth/SiteHeader";
import SignupPage from "./pages/auth/SignupPage";
import LandingPage from "./pages/landing/LandingPage";
import CampaignListPage from "./pages/campaigns/CampaignListPage";
import NewCampaignPage from "./pages/campaigns/NewCampaignPage";
import EditCampaignPage from "./pages/campaigns/EditCampaignPage";
import BusinessDashboard from "./pages/dashboard/business/BusinessDashboard";
import BusinessCampaignsPage from "./pages/dashboard/business/BusinessCampaignsPage";
import BusinessAccountPage from "./pages/dashboard/business/BusinessAccountPage";
import BusinessReviewPage from "./pages/dashboard/business/BusinessReviewPage";
import CreatorDashboard from "./pages/dashboard/creator/CreatorDashboard";
import CreatorOpportunitiesPage from "./pages/dashboard/creator/CreatorOpportunitiesPage";
import CreatorAccountPage from "./pages/dashboard/creator/CreatorAccountPage";
import CreatorDeliverablesPage from "./pages/dashboard/creator/CreatorDeliverablesPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import { dashboardPath, readSession } from "./pages/auth/session";

function SiteFrame({
  className,
  mainClassName,
  children,
}: {
  className?: string;
  mainClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <SiteHeader />
      <main className={mainClassName}>{children}</main>
    </div>
  );
}

function PublicLayout() {
  const { pathname } = useLocation();
  const landing = pathname === "/";

  return (
    <SiteFrame
      className={landing ? "min-h-screen bg-[#f8f8f0]" : undefined}
      mainClassName={landing ? "landing-main" : undefined}
    >
      <Outlet />
    </SiteFrame>
  );
}

function DashboardShell() {
  return (
    <SiteFrame
      className="min-h-screen bg-[var(--cg-background)]"
      mainClassName="landing-main"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <Outlet />
      </div>
    </SiteFrame>
  );
}

function withLocation(to: string, search: string, hash: string) {
  return `${to}${search}${hash}`;
}

function SearchRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={withLocation(to, search, hash)} replace />;
}

function DashboardRedirect() {
  const { search, hash } = useLocation();
  const session = readSession();
  const to = session ? dashboardPath(session.role) : "/login";
  return <Navigate to={withLocation(to, search, hash)} replace />;
}

// Old in-page section links, such as /dashboard/business#campaigns.
function HashRedirect({
  paths,
  children,
}: {
  paths: Record<string, string>;
  children: ReactNode;
}) {
  const { hash, search } = useLocation();
  const next = paths[decodeURIComponent(hash.replace(/^#/, ""))];
  if (!next) return children;
  return <Navigate to={`${next}${search}`} replace />;
}

// Old /app links. Retired sections go to the live page. The rest stay under /dev.
function LegacyAppRedirect() {
  const { pathname, search, hash } = useLocation();
  if (pathname === "/app/dashboard") return <DashboardRedirect />;
  if (pathname === "/app/campaigns" || pathname.startsWith("/app/campaigns/")) {
    return <Navigate to={withLocation("/campaigns", search, hash)} replace />;
  }
  if (pathname === "/app/opportunities") {
    return <Navigate to={withLocation("/dashboard/creator/opportunities", search, hash)} replace />;
  }
  return <Navigate to={withLocation(`/dev${pathname}`, search, hash)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="dashboard/admin" element={<AdminDashboardPage />} />
      <Route path="dashboard/admin/:section" element={<AdminDashboardPage />} />

      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="discover" element={<DirectoryPage />} />
        <Route path="businesses/:id" element={<BusinessProfilePage />} />
        <Route path="creators/:id" element={<CreatorProfilePage />} />
        <Route path="campaigns" element={<CampaignListPage />} />
        <Route path="campaigns/new" element={<NewCampaignPage />} />
        <Route path="campaigns/:campaignId/edit" element={<EditCampaignPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="logout" element={<LogoutPage />} />
        <Route path="signup" element={<SignupPage />} />
        {/* Static routes such as /dashboard and /dev rank above this catch-all. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<DashboardShell />}>
        <Route
          path="dashboard/business"
          element={
            <HashRedirect
              paths={{
                campaigns: "/dashboard/business/campaigns",
                collaborations: "/dashboard/business/review",
                account: "/dashboard/business/account",
              }}
            >
              <BusinessDashboard />
            </HashRedirect>
          }
        />
        <Route path="dashboard/business/campaigns" element={<BusinessCampaignsPage />} />
        <Route path="dashboard/business/review" element={<BusinessReviewPage />} />
        <Route path="dashboard/business/account" element={<BusinessAccountPage />} />
        <Route
          path="dashboard/creator"
          element={
            <HashRedirect
              paths={{
                opportunities: "/dashboard/creator/opportunities",
                collaborations: "/dashboard/creator/deliverables",
                profile: "/dashboard/creator/account",
                settings: "/dashboard/creator/account",
              }}
            >
              <CreatorDashboard />
            </HashRedirect>
          }
        />
        <Route path="dashboard/creator/opportunities" element={<CreatorOpportunitiesPage />} />
        <Route path="dashboard/creator/deliverables" element={<CreatorDeliverablesPage />} />
        <Route path="dashboard/creator/account" element={<CreatorAccountPage />} />
      </Route>

      <Route path="dev/dashboard/business" element={<SearchRedirect to="/dashboard/business" />} />
      <Route path="dev/dashboard/creator" element={<SearchRedirect to="/dashboard/creator" />} />
      <Route path="dev/dashboard/admin" element={<SearchRedirect to="/dashboard/admin" />} />
      <Route path="dev/collaborations/creator" element={<SearchRedirect to="/dashboard/creator/deliverables" />} />
      <Route path="dev/collaborations/business" element={<SearchRedirect to="/dashboard/business/review" />} />
      <Route path="dev/app/dashboard" element={<DashboardRedirect />} />
      <Route path="dev/app/campaigns" element={<SearchRedirect to="/campaigns" />} />
      <Route path="dev/app/campaigns/:campaignId" element={<SearchRedirect to="/campaigns" />} />
      <Route path="dev/app/opportunities" element={<SearchRedirect to="/dashboard/creator/opportunities" />} />

      <Route path="dev" element={<DevLayout />}>
        <Route
          index
          element={
            <PlaceholderPage
              title="Development"
              note="Temporary workspace for routing checks and the component gallery."
            />
          }
        />
        <Route path="components" element={<ComponentGallery />} />
        <Route path="app/messages" element={<PlaceholderPage title="Messages" />} />
        <Route path="app/payments" element={<PlaceholderPage title="Payments / Earnings" />} />
        <Route path="app/profile" element={<PlaceholderPage title="Profile" />} />
        <Route path="*" element={<PlaceholderPage title="404 — Page Not Found" />} />
      </Route>

      <Route path="components" element={<Navigate to="/dev/components" replace />} />
      <Route path="app/*" element={<LegacyAppRedirect />} />
    </Routes>
  );
}
