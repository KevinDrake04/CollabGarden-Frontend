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
import { PublicNavbar } from "./components";
import ComponentGallery from "./pages/ComponentGallery";
import "./styles/collabgarden-ui.css";
import DirectoryPage from "./pages/directory/DirectoryPage";
import LoginPage from "./pages/auth/LoginPage";
import LandingPage from "./pages/landing/LandingPage";

const publicNavLinks = [
  { label: "Home", to: "/" },
  { label: "Discover", to: "/discover" },
];

// Public website. No development sidebar.
function PublicLayout() {
  const { pathname } = useLocation();
  const landing = pathname === "/";

  return (
    <div className={landing ? "min-h-screen bg-[#f8f8f0]" : undefined}>
      <header className="site-header">
        <PublicNavbar
          links={publicNavLinks}
          account={{ label: "Login", to: "/login" }}
          action={{ label: "Sign up", to: "/signup" }}
        />
      </header>

      <main className={landing ? "landing-main" : undefined}>
        <Outlet />
      </main>
    </div>
  );
}

// Temporary development navigation.
const devSections = [
  {
    title: "Website",
    links: [["Public website", "/"]],
  },
  {
    title: "Development",
    links: [
      ["Home", "/dev"],
      ["Components", "/dev/components"],
      ["Dashboard", "/dev/app/dashboard"],
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

// Temporary creator profile route.
function CreatorProfile() {
  const { creatorId } = useParams();

  return (
    <Page
      title="Creator Profile"
      note={`Creator ID: ${creatorId}. Profile details will be added later.`}
    />
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
      {/* Public website */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />

        <Route path="discover" element={<DirectoryPage />} />

        <Route path="creators/:creatorId" element={<CreatorProfile />} />

        <Route path="login" element={<LoginPage />} />

        <Route
          path="signup"
          element={<Page title="Sign Up / Role Selection" />}
        />

        <Route path="*" element={<Page title="404 — Page Not Found" />} />
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
