import { type ReactNode } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router";
import { Button } from "@heroui/react";
import { Sprout } from "lucide-react";
import ComponentGallery from "./pages/ComponentGallery";
import CreatorDeliverablesPage from "./pages/collaborations/CreatorDeliverablesPage";
import BusinessReviewPage from "./pages/collaborations/BusinessReviewPage";
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
import BusinessDashboardPage from "./pages/dashboard/BusinessDashboardPage";
import CreatorDashboardPage from "./pages/dashboard/CreatorDashboardPage";
import BusinessDashboard from "./pages/dashboard/BusinessDashboard";
import CreatorDashboard from "./pages/dashboard/CreatorDashboard";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminPrototypePage from "./pages/admin/AdminPrototypePage";

// Shared public header. The dashboard shell adds a page width around the outlet.
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

// Public website. No development sidebar.
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

// User-facing dashboards. The shared header adds Dashboard for the signed-in role.
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

// Temporary development navigation.
const devSections = [
  {
    title: "Website",
    links: [
      ["Public website", "/"],
      ["Campaigns", "/campaigns"],
      ["New campaign", "/campaigns/new"],
    ],
  },
  {
    title: "Development",
    links: [
      ["Home", "/dev"],
      ["Components", "/dev/components"],
      ["Creator deliverables", "/dev/collaborations/creator"],
      ["Business review", "/dev/collaborations/business"],
      ["Dashboard", "/dev/app/dashboard"],
      ["Business dashboard", "/dev/dashboard/business"],
      ["Creator dashboard", "/dev/dashboard/creator"],
      ["Business page", "/dashboard/business"],
      ["Creator page", "/dashboard/creator"],
      ["Admin prototype", "/dev/dashboard/admin"],
      ["Admin dashboard", "/dashboard/admin"],
      ["Campaigns", "/dev/app/campaigns"],
      ["Campaign workspace", "/dev/app/campaigns/demo"],
      ["Opportunities", "/dev/app/opportunities"],
      ["Messages", "/dev/app/messages"],
      ["Payments", "/dev/app/payments"],
      ["Profile", "/dev/app/profile"],
    ],
  },
] as const;

function DevLayout() {
  return (
    <>
      <header>
        <strong>CollabGarden</strong>
        <span>Development</span>
      </header>

      <div className="shell">
        <nav aria-label="Development">
          {devSections.map((section) => (
            <div key={section.title}>
              <h2>{section.title}</h2>

              {section.links.map(([label, url]) => (
                <NavLink
                  key={url}
                  end
                  to={url}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}

// Generic placeholder page.
function Page({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <p className="eyebrow">Temporary page</p>

      <h1>{title}</h1>

      <p>{note ?? "Page layout and functionality will be added later."}</p>

      {/* Temporary component library and icon test */}
      {title === "Landing" && (
        <div className="mt-6 flex items-center gap-4">
          <Button
            variant="primary"
            onPress={() => window.alert("HeroUI and Lucide are working!")}
          >
            <Sprout size={18} />
            Test CollabGarden
          </Button>
        </div>
      )}
    </>
  );
}

// Temporary campaign workspace route.
function CampaignWorkspace() {
  const { campaignId } = useParams();

  return (
    <Page
      title="Campaign Workspace"
      note={`Campaign ID: ${campaignId}. Business/creator views will be defined later.`}
    />
  );
}

// Old /app links now live under /dev/app.
function LegacyAppRedirect() {
  const { pathname, search, hash } = useLocation();

  return <Navigate to={`/dev${pathname}${search}${hash}`} replace />;
}

// Application routes.
export default function App() {
  return (
    <Routes>
      <Route path="dashboard/admin" element={<AdminDashboardPage />} />
      <Route path="dashboard/admin/:section" element={<AdminDashboardPage />} />

      {/* Public website */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />

        <Route path="discover" element={<DirectoryPage />} />

        <Route path="businesses/:id" element={<BusinessProfilePage />} />

        <Route path="creators/:id" element={<CreatorProfilePage />} />

        <Route path="campaigns" element={<CampaignListPage />} />

        <Route path="campaigns/new" element={<NewCampaignPage />} />

        <Route path="login" element={<LoginPage />} />

        <Route path="logout" element={<LogoutPage />} />

        <Route path="signup" element={<SignupPage />} />

        <Route path="*" element={<Page title="404 — Page Not Found" />} />
      </Route>

      {/* User-facing dashboards. Development previews stay under /dev/dashboard. */}
      <Route element={<DashboardShell />}>
        <Route path="dashboard/business" element={<BusinessDashboard />} />
        <Route path="dashboard/creator" element={<CreatorDashboard />} />
      </Route>

      {/* Development workspace */}
      <Route path="dev" element={<DevLayout />}>
        <Route
          index
          element={
            <Page
              title="Development"
              note="Temporary workspace for routing checks and the component gallery."
            />
          }
        />

        <Route path="components" element={<ComponentGallery />} />

        <Route path="dashboard/business" element={<BusinessDashboardPage />} />

        <Route path="dashboard/creator" element={<CreatorDashboardPage />} />

        <Route path="collaborations/creator" element={<CreatorDeliverablesPage />} />

        <Route path="collaborations/business" element={<BusinessReviewPage />} />

        <Route path="dashboard/admin" element={<AdminPrototypePage />} />

        <Route
          path="app/dashboard"
          element={
            <Page
              title="Dashboard"
              note="Business and creator versions will be added after role handling is planned."
            />
          }
        />

        <Route path="app/campaigns" element={<Page title="Campaigns" />} />

        <Route
          path="app/campaigns/:campaignId"
          element={<CampaignWorkspace />}
        />

        <Route
          path="app/opportunities"
          element={<Page title="Opportunities" />}
        />

        <Route path="app/messages" element={<Page title="Messages" />} />

        <Route
          path="app/payments"
          element={<Page title="Payments / Earnings" />}
        />

        <Route path="app/profile" element={<Page title="Profile" />} />

        <Route path="*" element={<Page title="404 — Page Not Found" />} />
      </Route>

      {/* Old development links */}
      <Route
        path="components"
        element={<Navigate to="/dev/components" replace />}
      />

      <Route path="app/*" element={<LegacyAppRedirect />} />
    </Routes>
  );
}
