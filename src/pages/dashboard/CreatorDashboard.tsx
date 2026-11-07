import { Link, useLocation } from "react-router";
import { CheckCircle, Handshake, Sparkles } from "lucide-react";
import {
  AppAvatar,
  AppButton,
  CampaignCard,
  type DashboardCampaignStatus,
  DashboardEmptyState,
  DashboardStatCard,
  OpportunityCard,
} from "../../components";

// Same example records as the development prototype. Not loaded from the API.
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
    status: "Pending",
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

const panelClass =
  "rounded-2xl border border-[var(--cg-border)] bg-white p-5 shadow-sm";
const linkClass =
  "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline hover:bg-[var(--cg-primary-dark)]";

function sectionClass(current: boolean) {
  return current
    ? "rounded-xl bg-[var(--cg-background)] px-3 py-2 text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
    : "rounded-xl px-3 py-2 text-sm font-medium text-[var(--cg-muted)] no-underline hover:bg-[var(--cg-background)] hover:text-[var(--cg-primary-dark)]";
}

function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-[var(--cg-primary-dark)]">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--cg-muted)]">{text}</p>
    </div>
  );
}

export default function CreatorDashboard() {
  const { hash } = useLocation();
  const current = hash.replace("#", "") || "overview";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--cg-primary)] uppercase">
          Demo preview · Sample data
        </p>
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl">
            Welcome back, Sample Creator
          </h1>
          <p className="mt-2 text-base text-[var(--cg-muted)]">
            A sample workspace for opportunities and collaborations. This page
            is not connected to an account, and the records below are examples.
          </p>
        </div>
        <div
          role="navigation"
          aria-label="Creator dashboard"
          className="flex flex-wrap gap-1 rounded-2xl border border-[var(--cg-border)] bg-white p-1.5 shadow-sm"
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
      </div>

      <section id="overview" className="scroll-mt-24">
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
        <p className="mt-3 text-xs text-[var(--cg-muted)]">
          Example counts from the sample opportunities and collaborations on
          this page.
        </p>
      </section>

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-8">
          <section id="opportunities" className="scroll-mt-24">
            <SectionHeading
              title="Available Opportunities"
              text="Three example opportunities. Viewing details and applying are coming soon, so those buttons are disabled."
            />
            <div className="grid grid-cols-1 gap-4">
              {sampleOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.title}
                  {...opportunity}
                  actionLabel="View opportunity"
                  actionDisabled
                />
              ))}
            </div>
          </section>

          <section id="collaborations" className="scroll-mt-24">
            <SectionHeading
              title="My Collaborations"
              text="One example pending collaboration and one example completed collaboration. Opening a collaboration is coming soon, so those buttons are disabled."
            />
            <div className="grid grid-cols-1 gap-4">
              {sampleCollaborations.map((collaboration) => (
                <CampaignCard
                  key={collaboration.title}
                  {...collaboration}
                  actionDisabled
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-72">
          <section id="profile" className={`${panelClass} scroll-mt-24`}>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--cg-primary)] uppercase">
              My Profile
            </p>
            <div className="mt-3 flex items-center gap-3">
              <AppAvatar name={sampleProfile.name} />
              <div>
                <strong className="text-[var(--cg-text)]">
                  {sampleProfile.name}
                </strong>
                <p className="text-sm text-[var(--cg-muted)]">{sampleProfile.niche}</p>
                <p className="text-sm text-[var(--cg-muted)]">{sampleProfile.county}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--cg-muted)]">
              {sampleProfile.summary}
            </p>
            <div className="mt-4 flex flex-col items-start gap-1">
              <AppButton isDisabled>Edit profile</AppButton>
              <span className="text-xs text-[var(--cg-muted)]">Coming soon</span>
            </div>
          </section>

          <section className={panelClass} aria-labelledby="creator-actions">
            <h2
              id="creator-actions"
              className="text-base font-semibold text-[var(--cg-primary-dark)]"
            >
              Quick actions
            </h2>
            <div className="mt-4 flex flex-col items-start gap-1">
              <Link to="/discover?type=business" className={linkClass}>
                Discover businesses
              </Link>
              <span className="text-xs text-[var(--cg-muted)]">
                Opens the business directory
              </span>
            </div>
          </section>
        </aside>
      </div>

      <section id="settings" className="scroll-mt-24">
        <SectionHeading
          title="Settings"
          text="Account preferences are not available in this demo."
        />
        <DashboardEmptyState message="Settings are coming soon. Creator account preferences are not available in this demo." />
      </section>
    </div>
  );
}
