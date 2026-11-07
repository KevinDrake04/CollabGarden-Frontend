import { Link, useLocation } from "react-router";
import { CheckCircle, Handshake, Megaphone } from "lucide-react";
import {
  AppButton,
  CampaignCard,
  type DashboardCampaignStatus,
  DashboardEmptyState,
  DashboardLayout,
  DashboardStatCard,
} from "../../components";

// Example records for the midterm demo. These are not loaded from the API.
const sampleCampaigns: Array<{
  title: string;
  description: string;
  status: DashboardCampaignStatus;
  location: string;
  budget: string;
  date?: string;
  actionLabel: string;
}> = [
  {
    title: "Sample Fall Menu Launch",
    description:
      "Example active campaign for a seasonal menu with a local food creator.",
    status: "Active",
    location: "Essex County, NJ",
    budget: "Budget $400",
    date: "Due Nov 20",
    actionLabel: "View campaign",
  },
  {
    title: "Sample Spring Tasting",
    description: "Example draft campaign that has not been published.",
    status: "Draft",
    location: "Hudson County, NJ",
    budget: "Budget $250",
    actionLabel: "Edit draft",
  },
  {
    title: "Sample Summer Patio Series",
    description: "Example campaign that has already finished.",
    status: "Completed",
    location: "Bergen County, NJ",
    budget: "Budget $300",
    actionLabel: "View summary",
  },
];

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "My Campaigns" },
  { id: "collaborations", label: "Collaborations" },
  { id: "settings", label: "Settings" },
] as const;

const linkClass =
  "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline";

function sectionClass(current: boolean) {
  return current
    ? "rounded-lg bg-[var(--cg-background)] px-3 py-2 text-sm font-medium text-[var(--cg-primary-dark)] no-underline"
    : "rounded-lg px-3 py-2 text-sm text-[var(--cg-muted)] no-underline hover:bg-[var(--cg-background)]";
}

export default function BusinessDashboardPage() {
  const { hash } = useLocation();
  const current = hash.replace("#", "") || "overview";

  return (
    <div className="flex flex-col gap-4">
      <p className="eyebrow">Sample data · Development only</p>
      <DashboardLayout
        title="Business Dashboard"
        description="Sample dashboard for a local business. The counts and campaigns on this page are example data for the demo, not live records."
        navigation={
          <div
            role="navigation"
            aria-label="Business dashboard"
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
                Welcome, Sample Business
              </h3>
              <p className="mt-1 text-sm">
                Review example campaigns and the actions that will be available
                after this dashboard is connected.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardStatCard
                label="Active Campaigns"
                value={1}
                icon={<Megaphone size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Collaborations"
                value={0}
                icon={<Handshake size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Completed Campaigns"
                value={1}
                icon={<CheckCircle size={20} aria-hidden="true" />}
              />
            </div>
            <p className="text-xs">
              Example counts from the sample campaigns on this page.
            </p>

            <div id="quick-actions" className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
                Quick actions
              </h3>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap">
                <div className="flex flex-col gap-1">
                  <Link to="/campaigns/new" className={linkClass}>
                    Create campaign
                  </Link>
                  <span className="text-xs text-[var(--cg-muted)]">
                    Opens the campaign form
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <Link to="/discover?type=creator" className={linkClass}>
                    Find creators
                  </Link>
                  <span className="text-xs text-[var(--cg-muted)]">
                    Opens the creator directory
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <AppButton isDisabled>View profile</AppButton>
                  <span className="text-xs text-[var(--cg-muted)]">
                    Needs this account's business id
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section id="campaigns" className="scroll-mt-6 flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
              My Campaigns
            </h3>
            <p className="text-sm">
              These cards are examples. The sample buttons stay unavailable.
            </p>
            <Link
              to="/campaigns"
              className="text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
            >
              Browse open campaigns
            </Link>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {sampleCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.title}
                  {...campaign}
                  actionDisabled
                />
              ))}
            </div>
          </section>

          <section
            id="collaborations"
            className="scroll-mt-6 flex flex-col gap-3"
          >
            <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
              Collaborations
            </h3>
            <DashboardEmptyState message="No collaborations yet. This sample empty state is where partnerships with creators will appear. Collaboration tracking is coming soon." />
          </section>

          <section id="settings" className="scroll-mt-6 flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">
              Settings
            </h3>
            <DashboardEmptyState message="Settings are coming soon. Business profile and account preferences are not available in this demo." />
          </section>
        </div>
      </DashboardLayout>
    </div>
  );
}
