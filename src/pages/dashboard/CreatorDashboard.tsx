import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { CheckCircle, Handshake, Sparkles } from "lucide-react";
import {
  AppAvatar,
  AppButton,
  AppNotice,
  DashboardEmptyState,
  DashboardStatCard,
  LoadingSkeleton,
  OpportunityCard,
} from "../../components";
import { AuthError, fetchAccount, type AccountProfile } from "../../api/auth";
import { getBusinesses, listOpenCampaigns, type BusinessSummary, type Campaign } from "../../api/campaigns";
import {
  countyNameForId,
  getCounties,
  getCreator,
  type County,
  type Creator,
} from "../../api/directory";
import {
  clearSession,
  dashboardPath,
  readSession,
  refreshSession,
  watchSession,
  type Session,
} from "../auth/session";

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

const offerLabels = {
  gifted: "Gifted",
  dining: "Dining",
  paid: "Paid",
} as const;

type AccountLoad =
  | { status: "pending" | "ready" }
  | { status: "error"; message: string };

type OpportunityLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; campaigns: Campaign[]; businesses: BusinessSummary[]; counties: County[] };

function sectionClass(current: boolean) {
  return current
    ? "rounded-xl bg-[var(--cg-background)] px-3 py-2 text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
    : "rounded-xl px-3 py-2 text-sm font-medium text-[var(--cg-muted)] no-underline hover:bg-[var(--cg-background)] hover:text-[var(--cg-primary-dark)]";
}

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function failureMessage(error: unknown) {
  if (error instanceof AuthError || error instanceof Error) return error.message || "Couldn't load this dashboard.";
  return "Couldn't load this dashboard.";
}

function formatDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateLabel(campaign: Campaign) {
  const start = formatDate(campaign.starts_on);
  const end = formatDate(campaign.ends_on);
  if (start && end) return `${start} - ${end}`;
  return start || end || "No dates listed";
}

function countyLabel(ids: number[], counties: County[]) {
  if (ids.length === 0) return "No county listed";
  const names = ids.flatMap((id) => {
    const name = countyNameForId(id, counties);
    return name ? [`${name} County, NJ`] : [];
  });
  if (names.length === 0) return ids.map((id) => `County ${id}`).join(", ");
  return names.join(", ");
}

function roleLabel(role: Session["role"]) {
  if (role === "creator") return "creator";
  if (role === "business") return "business";
  return "administrator";
}

function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-[var(--cg-primary-dark)]">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--cg-muted)]">{text}</p>
    </div>
  );
}

export default function CreatorDashboard() {
  const { hash } = useLocation();
  const current = hash.replace("#", "") || "overview";
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [accountLoad, setAccountLoad] = useState<AccountLoad>(() =>
    readSession() ? { status: "pending" } : { status: "ready" },
  );
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [creatorMissing, setCreatorMissing] = useState(false);
  const [accountAttempt, setAccountAttempt] = useState(0);
  const [opportunities, setOpportunities] = useState<OpportunityLoad>({ status: "idle" });
  const [opportunityAttempt, setOpportunityAttempt] = useState(0);

  useEffect(() => watchSession(() => setSession(readSession())), []);

  useEffect(() => {
    const controller = new AbortController();
    const stored = readSession();
    if (!stored || stored.role !== "creator") {
      setAccount(null);
      setCreator(null);
      setCreatorMissing(false);
      setAccountLoad({ status: "ready" });
      return () => controller.abort();
    }

    setAccountLoad({ status: "pending" });
    refreshSession(controller.signal)
      .then(async (next) => {
        if (controller.signal.aborted) return;
        setSession(next);
        if (!next || next.role !== "creator") {
          setAccount(null);
          setCreator(null);
          setAccountLoad({ status: "ready" });
          return;
        }
        const profile = await fetchAccount(next.accessToken, controller.signal);
        if (controller.signal.aborted) return;
        setAccount(profile);
        if (profile.creatorId == null) {
          setCreator(null);
          setCreatorMissing(false);
          setAccountLoad({ status: "ready" });
          return;
        }
        try {
          const record = await getCreator(profile.creatorId, controller.signal);
          if (controller.signal.aborted) return;
          setCreator(record.creator_id === profile.creatorId ? record : null);
          setCreatorMissing(record.creator_id !== profile.creatorId);
        } catch (error) {
          if (controller.signal.aborted || isAbort(error)) return;
          setCreator(null);
          setCreatorMissing(true);
        }
        setAccountLoad({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof AuthError && error.status === 401) {
          clearSession();
          setSession(null);
          setAccount(null);
          setCreator(null);
          setAccountLoad({ status: "ready" });
          return;
        }
        setAccountLoad({ status: "error", message: failureMessage(error) });
      });
    return () => controller.abort();
  }, [accountAttempt]);

  useEffect(() => {
    if (!session || session.role !== "creator") {
      setOpportunities({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setOpportunities({ status: "loading" });
    Promise.all([
      listOpenCampaigns(controller.signal),
      getBusinesses(controller.signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return [] as BusinessSummary[];
      }),
      getCounties(controller.signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return [] as County[];
      }),
    ])
      .then(([campaigns, businesses, counties]) => {
        if (controller.signal.aborted) return;
        setOpportunities({
          status: "ready",
          campaigns: campaigns.filter((campaign) => campaign.status === "open"),
          businesses,
          counties,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setOpportunities({ status: "error", message: failureMessage(error) });
      });
    return () => controller.abort();
  }, [session, opportunityAttempt]);

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)]">Creator dashboard</h1>
        <AppNotice tone="info" message="Sign in with a creator account to see your account and open campaigns." />
        <Link to="/login" state={{ from: "/dashboard/creator" }} className={linkClass}>
          Log in
        </Link>
      </div>
    );
  }

  if (session.role !== "creator") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)]">Creator dashboard</h1>
        <AppNotice
          tone="info"
          message={`This dashboard is for creator accounts. You are signed in as a ${roleLabel(session.role)} account.`}
        />
        <Link to={dashboardPath(session.role)} className={linkClass}>
          Go to your dashboard
        </Link>
      </div>
    );
  }

  const displayName = creator?.display_name?.trim() || account?.displayName || session.email;
  const openCount = opportunities.status === "ready" ? opportunities.campaigns.length : null;
  const creatorCounty = creator ? countyNameForId(creator.county_id, opportunities.status === "ready" ? opportunities.counties : []) : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <div className="max-w-2xl">
          <h1 className="break-words text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-2 text-base text-[var(--cg-muted)]">
            {creator?.bio?.trim()
              || "This workspace uses your signed-in account. Performance metrics and saved collaborations are not available from the current API."}
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

      {accountLoad.status === "pending" && <p className="text-sm text-[var(--cg-muted)]">Checking this account...</p>}
      {accountLoad.status === "error" && (
        <div className="space-y-3">
          <AppNotice tone="error" message={accountLoad.message} />
          <AppButton variant="secondary" onPress={() => setAccountAttempt((value) => value + 1)}>
            Try again
          </AppButton>
        </div>
      )}

      <section id="overview" className="scroll-mt-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardStatCard
            label="Open campaigns"
            value={openCount ?? "-"}
            icon={<Sparkles size={20} aria-hidden="true" />}
          />
          <DashboardStatCard
            label="Pending collaborations"
            value="Coming soon"
            icon={<Handshake size={20} aria-hidden="true" />}
          />
          <DashboardStatCard
            label="Completed collaborations"
            value="Coming soon"
            icon={<CheckCircle size={20} aria-hidden="true" />}
          />
        </div>
        <p className="mt-3 text-xs text-[var(--cg-muted)]">
          Open campaigns counts the public campaign list. It is not a personal performance metric. Collaboration totals are coming soon.
        </p>
      </section>

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-8">
          <section id="opportunities" className="scroll-mt-24">
            <SectionHeading
              title="Available Opportunities"
              text="These are public open campaigns. They are not assigned collaborations, and applying from this page is not available."
            />
            <Link
              to="/campaigns"
              className="mb-4 inline-flex text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
            >
              Browse campaigns
            </Link>
            {opportunities.status === "loading" && (
              <div className="grid gap-4" aria-busy="true" aria-label="Loading open campaigns">
                <LoadingSkeleton lines={3} />
                <LoadingSkeleton lines={3} />
              </div>
            )}
            {opportunities.status === "error" && (
              <div className="space-y-3">
                <AppNotice tone="error" message={opportunities.message} />
                <AppButton variant="secondary" onPress={() => setOpportunityAttempt((value) => value + 1)}>
                  Try again
                </AppButton>
              </div>
            )}
            {opportunities.status === "ready" && opportunities.campaigns.length === 0 && (
              <DashboardEmptyState message="No open campaigns were returned." />
            )}
            {opportunities.status === "ready" && opportunities.campaigns.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {opportunities.campaigns.map((campaign) => {
                  const business = opportunities.businesses.find((item) => item.business_id === campaign.business_id);
                  const offer = campaign.offer_type ? offerLabels[campaign.offer_type] : "Open";
                  return (
                    <OpportunityCard
                      key={campaign.campaign_id}
                      businessName={business?.name || `Business ${campaign.business_id}`}
                      title={campaign.name}
                      description={campaign.description?.trim() || "No description was provided."}
                      location={`${countyLabel(campaign.county_ids, opportunities.counties)} · ${dateLabel(campaign)}`}
                      category={offer}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section id="collaborations" className="scroll-mt-24">
            <SectionHeading
              title="My Collaborations"
              text="The account response does not include saved partnerships."
            />
            <DashboardEmptyState message="Collaborations are coming soon. No collaboration history is available for this account." />
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-72">
          <section id="profile" className={`${panelClass} scroll-mt-24`}>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--cg-primary)] uppercase">
              My Profile
            </p>
            <div className="mt-3 flex items-center gap-3">
              <AppAvatar name={displayName} imageUrl={creator?.photo_url ?? undefined} />
              <div className="min-w-0">
                <strong className="break-words text-[var(--cg-text)]">{displayName}</strong>
                {creator?.niche && <p className="text-sm text-[var(--cg-muted)]">{creator.niche}</p>}
                {creatorCounty && <p className="text-sm text-[var(--cg-muted)]">{creatorCounty}</p>}
                {creator?.follower_range && (
                  <p className="text-sm text-[var(--cg-muted)]">{creator.follower_range}</p>
                )}
              </div>
            </div>
            <p className="mt-3 break-words text-sm text-[var(--cg-muted)]">{session.email}</p>
            {!creator && accountLoad.status === "ready" && (
              <p className="mt-3 text-sm text-[var(--cg-muted)]">
                {creatorMissing
                  ? "The creator profile for this account was not returned."
                  : "The account response does not include a creator profile. Niche, county, and photo are unavailable."}
              </p>
            )}
            <div className="mt-4 flex flex-col items-start gap-1">
              <AppButton isDisabled>Edit profile</AppButton>
              <span className="text-xs text-[var(--cg-muted)]">Coming soon</span>
            </div>
          </section>

          <section className={panelClass} aria-labelledby="creator-actions">
            <h2 id="creator-actions" className="text-base font-semibold text-[var(--cg-primary-dark)]">
              Quick actions
            </h2>
            <div className="mt-4 flex flex-col items-start gap-4">
              <div className="flex flex-col gap-1">
                <Link to="/campaigns" className={linkClass}>
                  Browse campaigns
                </Link>
                <span className="text-xs text-[var(--cg-muted)]">Opens the public campaign list</span>
              </div>
              <div className="flex flex-col gap-1">
                <Link to="/discover?type=business" className={linkClass}>
                  Discover businesses
                </Link>
                <span className="text-xs text-[var(--cg-muted)]">Opens the business directory</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section id="settings" className="scroll-mt-24">
        <SectionHeading title="Settings" text="Account preferences are not available yet." />
        <DashboardEmptyState message="Settings are coming soon." />
      </section>
    </div>
  );
}
