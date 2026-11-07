import { Link, useLocation } from "react-router";
import { CheckCircle, Handshake, Sparkles } from "lucide-react";
import {
  AppAvatar,
  AppButton,
  CampaignCard,
  type DashboardCampaignStatus,
  DashboardEmptyState,
  DashboardLayout,
  DashboardStatCard,
  OpportunityCard,
} from "../../components";

// Example records for the midterm demo. These are not loaded from the API.
const sampleOpportunities = [
  {
    businessName: "Sample Cafe",
    title: "Sample Weekend Brunch Feature",
    description:
      "Example opportunity for a local food creator to feature a weekend brunch.",
    location: "Essex County, NJ",
    category: "Food",
  },
  {
    businessName: "Sample Garden Shop",
    title: "Sample Spring Planter Feature",
    description:
      "Example opportunity for a creator to show a seasonal planter display.",
    location: "Bergen County, NJ",
    category: "Plants",
  },
  {
    businessName: "Sample Bookstore",
    title: "Sample Local Author Night",
    description:
      "Example opportunity for a creator to share a neighborhood author event.",
    location: "Hudson County, NJ",
    category: "Lifestyle",
  },
];

const sampleCollaborations: Array<{
  title: string;
  description: string;
  status: DashboardCampaignStatus;
  location: string;
  actionLabel: string;
}> = [
  {
    title: "Sample Weekend Brunch",
    description:
      "Example pending collaboration with Sample Cafe. This is demo data, not a saved partnership.",
    status: "Active",
    location: "Essex County, NJ",
    actionLabel: "View collaboration",
  },
  {
    title: "Sample Spring Planter Series",
    description:
      "Example completed collaboration with Sample Garden Shop. This is demo data, not a saved partnership.",
    status: "Completed",
    location: "Bergen County, NJ",
    actionLabel: "View summary",
  },
];

const sampleProfile = {
  name: "Sample Creator",
  niche: "Food & lifestyle",
  county: "Essex County, NJ",
  summary:
    "Example profile for a local creator who posts about neighborhood food spots. This is demo data, not a saved profile.",
};

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "collaborations", label: "My Collaborations" },
  { id: "profile", label: "My Profile" },
  { id: "settings", label: "Settings" },
] as const;

const linkClass =
  "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline";

function sectionClass(current: boolean) {
  return current
    ? "rounded-lg bg-[var(--cg-background)] px-3 py-2 text-sm font-medium text-[var(--cg-primary-dark)] no-underline"
    : "rounded-lg px-3 py-2 text-sm text-[var(--cg-muted)] no-underline hover:bg-[var(--cg-background)]";
}

export default function CreatorDashboardPage() {
  const { hash } = useLocation();
  const current = hash.replace("#", "") || "overview";

  return (
    <div className="flex flex-col gap-4">
      <p className="eyebrow">Sample data · Development only</p>
      <DashboardLayout
        title="Creator Dashboard"
        description="Sample dashboard for a local creator. The counts, opportunities, and collaborations on this page are example data for the demo, not live records."
        navigation={
          <div
            role="navigation"
            aria-label="Creator dashboard"
            className="flex flex-row flex-wrap gap-1 md:flex-col"
          >
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={{ hash: `#${item.id}` }}
                aria-current={current === item.id ? "page" : undefined}
                className={sectionClass(current === item.id)}
                onClick={() => {
                  document.getElementById(item.id)?.scrollIntoView();
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        }
      >
        <div className="flex flex-col gap-8">
          <section id="overview" className="scroll-mt-6 flex flex-col gap-5">
            <div>
              <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
                Welcome back, Sample Creator
              </h3>
              <p className="mt-1 text-sm">
                Review example opportunities and collaborations. Applying and
                editing a profile are not available in this demo yet.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardStatCard
                label="Available Opportunities"
                value={sampleOpportunities.length}
                icon={<Sparkles size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Pending Collaborations"
                value={1}
                icon={<Handshake size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Completed Collaborations"
                value={1}
                icon={<CheckCircle size={20} aria-hidden="true" />}
              />
            </div>
            <p className="text-xs">
              Example counts from the sample opportunities and collaborations
              on this page.
            </p>
          </section>

          <section id="opportunities" className="scroll-mt-6 flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
              Available Opportunities
            </h3>
            <p className="text-sm">
              These cards are examples. Applying from a sample card is not
              available.
            </p>
            <Link
              to="/campaigns"
              className="text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
            >
              Browse open campaigns
            </Link>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {sampleOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.title}
                  {...opportunity}
                  actionLabel="View opportunity"
                  actionDisabled
                />
              ))}
            </div>
            <div className="flex flex-col items-start gap-1">
              <Link to="/discover?type=business" className={linkClass}>
                Discover businesses
              </Link>
              <span className="text-xs text-[var(--cg-muted)]">
                Opens the business directory
              </span>
            </div>
          </section>

          <section
            id="collaborations"
            className="scroll-mt-6 flex flex-col gap-3"
          >
            <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
              My Collaborations
            </h3>
            <p className="text-sm">
              One example pending collaboration and one example completed
              collaboration. Pending uses the Active badge. Opening a
              collaboration is coming soon, so those buttons are disabled.
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {sampleCollaborations.map((collaboration) => (
                <CampaignCard
                  key={collaboration.title}
                  {...collaboration}
                  actionDisabled
                />
              ))}
            </div>
          </section>

          <section id="profile" className="scroll-mt-6 flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
              My Profile
            </h3>
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--cg-border)] bg-white p-5">
              <div className="flex items-center gap-3">
                <AppAvatar name={sampleProfile.name} />
                <div>
                  <strong className="text-lg text-[var(--cg-text)]">
                    {sampleProfile.name}
                  </strong>
                  <p className="text-sm">
                    {sampleProfile.niche} · {sampleProfile.county}
                  </p>
                </div>
              </div>
              <p className="text-sm">{sampleProfile.summary}</p>
              <div className="flex flex-col items-start gap-1">
                <AppButton isDisabled>Edit profile</AppButton>
                <span className="text-xs text-[var(--cg-muted)]">
                  Coming soon
                </span>
              </div>
            </div>
          </section>

          <section id="settings" className="scroll-mt-6 flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
              Settings
            </h3>
            <DashboardEmptyState message="Settings are coming soon. Creator account preferences are not available in this demo." />
          </section>
        </div>
      </DashboardLayout>
    </div>
  );
}
