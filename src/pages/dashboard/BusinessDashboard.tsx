import { Link, useLocation } from "react-router";
import { CheckCircle, Handshake, Megaphone } from "lucide-react";
import {
  AppAvatar,
  AppButton,
  CampaignCard,
  type DashboardCampaignStatus,
  DashboardEmptyState,
  DashboardStatCard,
} from "../../components";

// Same example records as the development prototype. Not loaded from the API.
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
  { id: "account", label: "Account" },
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

export default function BusinessDashboard() {
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
            Welcome, Sample Business
          </h1>
          <p className="mt-2 text-base text-[var(--cg-muted)]">
            A sample workspace for campaigns and local creator partnerships.
            This page is not connected to an account, and the records below are
            examples.
          </p>
        </div>
        <div
          role="navigation"
          aria-label="Business dashboard"
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
        <p className="mt-3 text-xs text-[var(--cg-muted)]">
          Example counts from the sample campaigns on this page.
        </p>
      </section>

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-8">
          <section id="campaigns" className="scroll-mt-24">
            <SectionHeading
              title="My Campaigns"
              text="Three example campaigns. Opening or editing a campaign is coming soon, so those buttons are disabled."
            />
            <div className="grid grid-cols-1 gap-4">
              {sampleCampaigns.map((campaign) => (
                <CampaignCard key={campaign.title} {...campaign} actionDisabled />
              ))}
            </div>
          </section>

          <section id="collaborations" className="scroll-mt-24">
            <SectionHeading
              title="Collaborations"
              text="Partnerships with creators will show up here. There are no sample collaborations yet."
            />
            <DashboardEmptyState message="No collaborations yet. This sample empty state is where partnerships with creators will appear. Collaboration tracking is coming soon." />
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-72">
          <section id="account" className={`${panelClass} scroll-mt-24`}>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--cg-primary)] uppercase">
              Account
            </p>
            <div className="mt-3 flex items-center gap-3">
              <AppAvatar name="Sample Business" />
              <div>
                <strong className="text-[var(--cg-text)]">Sample Business</strong>
                <p className="text-sm text-[var(--cg-muted)]">Cafe</p>
                <p className="text-sm text-[var(--cg-muted)]">Essex County, NJ</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--cg-muted)]">
              Example account for the demo. This is not a signed-in business.
            </p>
            <div className="mt-4 flex flex-col items-start gap-1">
              <AppButton isDisabled>Edit account</AppButton>
              <span className="text-xs text-[var(--cg-muted)]">Coming soon</span>
            </div>
          </section>

          <section className={panelClass} aria-labelledby="business-actions">
            <h2
              id="business-actions"
              className="text-base font-semibold text-[var(--cg-primary-dark)]"
            >
              Quick actions
            </h2>
            <div className="mt-4 flex flex-col items-start gap-4">
              <div className="flex flex-col gap-1">
                <AppButton isDisabled>Create campaign</AppButton>
                <span className="text-xs text-[var(--cg-muted)]">Coming soon</span>
              </div>
              <div className="flex flex-col gap-1">
                <Link to="/discover?type=creator" className={linkClass}>
                  Find creators
                </Link>
                <span className="text-xs text-[var(--cg-muted)]">
                  Opens the creator directory
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
