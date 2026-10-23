import { NavLink, Outlet, Route, Routes, useParams } from "react-router";
import { Button } from "@heroui/react";
import { Sprout } from "lucide-react";
import ComponentGallery from "./pages/ComponentGallery";
import "./styles/collabgarden-ui.css";

// Temporary navigation: all links are visible for routing tests.
const sections = [
  {
    title: "Public",
    links: [
      ["Home", "/"],
      ["Discover", "/discover"],
      ["Creator profile", "/creators/demo"],
      ["Log in", "/login"],
      ["Sign up", "/signup"],
    ],
  },
  {
    title: "App (temporary)",
    links: [
      ["Components", "/components"],
      ["Dashboard", "/app/dashboard"],
      ["Campaigns", "/app/campaigns"],
      ["Campaign workspace", "/app/campaigns/demo"],
      ["Opportunities", "/app/opportunities"],
      ["Messages", "/app/messages"],
      ["Payments", "/app/payments"],
      ["Profile", "/app/profile"],
    ],
  },
] as const;

// Shared layout for all temporary pages.
function Layout() {
  return (
    <>
      <header>
        <strong>CollabGarden</strong>
        <span>Routing draft</span>
      </header>

      <div className="shell">
        <nav aria-label="Temporary page navigation">
          {sections.map((section) => (
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

// Application routes.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public routes */}
        <Route path="components" element={<ComponentGallery />} />
        <Route index element={<Page title="Landing" />} />

        <Route path="discover" element={<Page title="Discover Creators" />} />

        <Route path="creators/:creatorId" element={<CreatorProfile />} />

        <Route path="login" element={<Page title="Log In" />} />

        <Route
          path="signup"
          element={<Page title="Sign Up / Role Selection" />}
        />

        {/* Application routes */}
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

        {/* Fallback */}
        <Route path="*" element={<Page title="404 — Page Not Found" />} />
      </Route>
    </Routes>
  );
}
