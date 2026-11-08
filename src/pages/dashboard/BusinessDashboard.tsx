import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Handshake, List, Megaphone } from "lucide-react";
import {
  AppAvatar,
  AppButton,
  AppNotice,
  AppSelect,
  CampaignCard,
  type DashboardCampaignStatus,
  DashboardEmptyState,
  DashboardStatCard,
  LoadingSkeleton,
} from "../../components";
import { AuthError, verifiedBusinessIds } from "../../api/auth";
import {
  CampaignApiError,
  getBusinesses,
  listCampaigns,
  type Campaign,
  type DeliverableRequirement,
  type DeliverableType,
  type OfferType,
} from "../../api/campaigns";
import { getBusiness, getCounties, type Business, type County } from "../../api/directory";
import {
  dashboardPath,
  readSession,
  refreshSession,
  watchSession,
  type Session,
} from "../auth/session";

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

const offerLabels: Record<OfferType, string> = {
  gifted: "Gifted",
  dining: "Dining",
  paid: "Paid",
};

const requirementLabels: Record<DeliverableType, [string, string]> = {
  post: ["Post", "Posts"],
  story: ["Story", "Stories"],
  reel: ["Reel", "Reels"],
};

type CampaignLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      campaigns: Campaign[];
      counties: County[];
      profile: Business | null;
    };

function sectionClass(current: boolean) {
  return current
    ? "rounded-xl bg-[var(--cg-background)] px-3 py-2 text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
    : "rounded-xl px-3 py-2 text-sm font-medium text-[var(--cg-muted)] no-underline hover:bg-[var(--cg-background)] hover:text-[var(--cg-primary-dark)]";
}

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function failureMessage(error: unknown) {
  if (error instanceof CampaignApiError || error instanceof AuthError || error instanceof Error) {
    return error.message || "Couldn't load this dashboard.";
  }
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
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return "No dates listed";
}

function countyLabel(ids: number[], counties: County[]) {
  if (ids.length === 0) return "No county listed";
  const names = ids.flatMap((id) => {
    const match = counties.find((county) => county.county_id === id);
    return match ? [`${match.name} County, NJ`] : [];
  });
  if (names.length === 0) return ids.map((id) => `County ${id}`).join(", ");
  return names.join(", ");
}

function requirementsLabel(requirements: DeliverableRequirement[] | undefined) {
  if (!requirements || requirements.length === 0) return "";
  const parts: string[] = [];
  for (const requirement of requirements) {
    const labels = requirementLabels[requirement.deliverable_type];
    if (!labels) continue;
    const quantity = requirement.quantity;
    parts.push(`${quantity} ${quantity === 1 ? labels[0] : labels[1]}`);
  }
  return parts.join(", ");
}

function statusLabel(status: Campaign["status"]): DashboardCampaignStatus {
  if (status === "draft") return "Draft";
  if (status === "closed") return "Closed";
  return "Open";
}

function campaignNote(campaign: Campaign) {
  const offer = campaign.offer_type ? offerLabels[campaign.offer_type] : "";
  const requirements = requirementsLabel(campaign.deliverable_requirements);
  return [offer, requirements].filter(Boolean).join(" · ");
}

function roleLabel(role: Session["role"]) {
  if (role === "business") return "business";
  if (role === "creator") return "creator";
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

export default function BusinessDashboard() {
  const { hash } = useLocation();
  const current = hash.replace("#", "") || "overview";
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [accountState, setAccountState] = useState<"pending" | "ready" | "error">(() =>
    readSession() ? "pending" : "ready",
  );
  const [accountError, setAccountError] = useState("");
  const [accountAttempt, setAccountAttempt] = useState(0);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [names, setNames] = useState<Map<number, string>>(() => new Map());
  const [campaignLoad, setCampaignLoad] = useState<CampaignLoad>({ status: "idle" });
  const [campaignAttempt, setCampaignAttempt] = useState(0);

  const businessIds = session?.role === "business" ? verifiedBusinessIds(session) : [];
  const businessKey = businessIds.join(",");

  useEffect(() => watchSession(() => setSession(readSession())), []);

  useEffect(() => {
    const controller = new AbortController();
    const stored = readSession();
    if (!stored) {
      setSession(null);
      setAccountState("ready");
      setAccountError("");
      return () => controller.abort();
    }

    setAccountState("pending");
    setAccountError("");
    refreshSession(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setSession(next);
        setAccountState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof AuthError && error.status === 401) {
          setSession(null);
          setAccountState("ready");
          return;
        }
        setAccountState("error");
        setAccountError(failureMessage(error));
      });
    return () => controller.abort();
  }, [accountAttempt]);

  useEffect(() => {
    if (!session || session.role !== "business") {
      setSelectedBusinessId(null);
      return;
    }
    const ids = verifiedBusinessIds(session);
    setSelectedBusinessId((currentId) => {
      if (currentId != null && ids.includes(currentId)) return currentId;
      if (session.businessId != null && ids.includes(session.businessId)) return session.businessId;
      return ids[0] ?? null;
    });
  }, [session]);

  useEffect(() => {
    if (!session || session.role !== "business" || !businessKey) {
      setNames(new Map());
      return;
    }
    const ids = businessKey.split(",").map(Number);
    const controller = new AbortController();
    getBusinesses(controller.signal)
      .then((businesses) => {
        if (controller.signal.aborted) return;
        const next = new Map<number, string>();
        for (const business of businesses) {
          if (ids.includes(business.business_id) && business.name.trim()) {
            next.set(business.business_id, business.name.trim());
          }
        }
        setNames(next);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbort(error)) setNames(new Map());
      });
    return () => controller.abort();
  }, [session, businessKey]);

  useEffect(() => {
    if (accountState !== "ready" || !session || session.role !== "business") {
      setCampaignLoad({ status: "idle" });
      return;
    }
    const ids = verifiedBusinessIds(session);
    if (selectedBusinessId == null || !ids.includes(selectedBusinessId)) {
      setCampaignLoad({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const businessId = selectedBusinessId;
    setCampaignLoad({ status: "loading" });
    Promise.all([
      listCampaigns({ signal: controller.signal, token: session.accessToken }),
      getCounties(controller.signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return [] as County[];
      }),
      getBusiness(businessId, controller.signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return null;
      }),
    ])
      .then(([campaigns, counties, profile]) => {
        if (controller.signal.aborted) return;
        setCampaignLoad({
          status: "ready",
          campaigns: campaigns
            .filter((campaign) => campaign.business_id === businessId && ids.includes(campaign.business_id))
            .sort((left, right) => left.campaign_id - right.campaign_id),
          counties,
          profile: profile && profile.business_id === businessId ? profile : null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setCampaignLoad({ status: "error", message: failureMessage(error) });
      });
    return () => controller.abort();
  }, [accountState, session, selectedBusinessId, campaignAttempt]);

  function businessLabel(id: number) {
    return names.get(id) ?? `Business ${id}`;
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)]">Business dashboard</h1>
        <AppNotice tone="info" message="Sign in with a business account to see your business and campaigns." />
        <Link to="/login" state={{ from: "/dashboard/business" }} className={linkClass}>
          Log in
        </Link>
      </div>
    );
  }

  if (session.role !== "business") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)]">Business dashboard</h1>
        <AppNotice
          tone="info"
          message={`This dashboard is for business accounts. You are signed in as a ${roleLabel(session.role)} account.`}
        />
        <Link to={dashboardPath(session.role)} className={linkClass}>
          Go to your dashboard
        </Link>
      </div>
    );
  }

  const profile = campaignLoad.status === "ready" ? campaignLoad.profile : null;
  const selectedName = selectedBusinessId == null ? "your business" : profile?.name?.trim() || businessLabel(selectedBusinessId);
  const openCount = campaignLoad.status === "ready"
    ? campaignLoad.campaigns.filter((campaign) => campaign.status === "open").length
    : null;
  const returnedCount = campaignLoad.status === "ready" ? campaignLoad.campaigns.length : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl">
            {accountState === "ready" && selectedBusinessId != null ? `Welcome, ${selectedName}` : "Welcome"}
          </h1>
          <p className="mt-2 text-base text-[var(--cg-muted)]">
            {profile?.description?.trim()
              || "Campaigns on this page come from the campaign list for the selected business."}
          </p>
        </div>
        {accountState === "ready" && businessIds.length > 1 && (
          <div className="max-w-md">
            <AppSelect
              label="Business"
              name="dashboard-business"
              value={selectedBusinessId == null ? "" : String(selectedBusinessId)}
              onChange={(value) => {
                const id = Number(value);
                if (businessIds.includes(id)) setSelectedBusinessId(id);
              }}
              options={businessIds.map((id) => ({ value: String(id), label: businessLabel(id) }))}
              placeholder="Select a business"
              helper="Only businesses returned for this account can be selected."
            />
          </div>
        )}
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

      {accountState === "pending" && <p className="text-sm text-[var(--cg-muted)]">Checking this account...</p>}
      {accountState === "error" && (
        <div className="space-y-3">
          <AppNotice tone="error" message={accountError || "Couldn't confirm this account."} />
          <AppButton variant="secondary" onPress={() => setAccountAttempt((value) => value + 1)}>
            Try again
          </AppButton>
        </div>
      )}

      {accountState === "ready" && businessIds.length === 0 && (
        <AppNotice
          tone="info"
          message="This account is not linked to a business, so there are no campaigns to show."
        />
      )}

      {accountState === "ready" && businessIds.length > 0 && (
        <>
          <section id="overview" className="scroll-mt-24">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardStatCard
                label="Open campaigns"
                value={openCount ?? "-"}
                icon={<Megaphone size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Campaigns returned"
                value={returnedCount ?? "-"}
                icon={<List size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Collaborations"
                value="Coming soon"
                icon={<Handshake size={20} aria-hidden="true" />}
              />
            </div>
            <p className="mt-3 text-xs text-[var(--cg-muted)]">
              Counts use campaigns returned for the selected business. The campaign list has no business filter, so campaigns for other businesses are not shown. Draft and closed campaigns appear only when that response includes them. Budgets and collaboration totals are not available.
            </p>
          </section>

          <div className="flex flex-col items-start gap-8 lg:flex-row">
            <div className="flex w-full min-w-0 flex-1 flex-col gap-8">
              <section id="campaigns" className="scroll-mt-24">
                <SectionHeading
                  title="My Campaigns"
                  text="Names, statuses, offer types, dates, and deliverable requirements come from the campaign list for this business."
                />
                <Link
                  to="/campaigns"
                  className="mb-4 inline-flex text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
                >
                  Browse campaigns
                </Link>
                {campaignLoad.status === "loading" && (
                  <div className="grid gap-4" aria-busy="true" aria-label="Loading campaigns">
                    <LoadingSkeleton lines={3} />
                    <LoadingSkeleton lines={3} />
                  </div>
                )}
                {campaignLoad.status === "error" && (
                  <div className="space-y-3">
                    <AppNotice tone="error" message={campaignLoad.message} />
                    <AppButton variant="secondary" onPress={() => setCampaignAttempt((value) => value + 1)}>
                      Try again
                    </AppButton>
                  </div>
                )}
                {campaignLoad.status === "ready" && campaignLoad.campaigns.length === 0 && (
                  <DashboardEmptyState message="No campaigns were returned for this business." />
                )}
                {campaignLoad.status === "ready" && campaignLoad.campaigns.length > 0 && (
                  <div className="grid grid-cols-1 gap-4">
                    {campaignLoad.campaigns.map((campaign) => {
                      const note = campaignNote(campaign);
                      return (
                        <CampaignCard
                          key={campaign.campaign_id}
                          title={campaign.name}
                          description={campaign.description?.trim() || "No description was provided."}
                          status={statusLabel(campaign.status)}
                          location={countyLabel(campaign.county_ids, campaignLoad.counties)}
                          date={dateLabel(campaign)}
                          note={note || undefined}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              <section id="collaborations" className="scroll-mt-24">
                <SectionHeading
                  title="Collaborations"
                  text="Creator partnerships are not available from the current account or campaign responses."
                />
                <DashboardEmptyState message="Collaborations are coming soon. This account does not include a collaboration list." />
              </section>
            </div>

            <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-72">
              <section id="account" className={`${panelClass} scroll-mt-24`}>
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--cg-primary)] uppercase">
                  Account
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <AppAvatar name={selectedName} imageUrl={profile?.logo_url ?? undefined} />
                  <div className="min-w-0">
                    <strong className="text-[var(--cg-text)]">{selectedName}</strong>
                    {profile?.category && <p className="text-sm text-[var(--cg-muted)]">{profile.category}</p>}
                    {profile && (
                      <p className="text-sm text-[var(--cg-muted)]">
                        {countyLabel(profile.county_ids ?? [], campaignLoad.status === "ready" ? campaignLoad.counties : [])}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 break-words text-sm text-[var(--cg-muted)]">{session.email}</p>
                {profile == null && campaignLoad.status === "ready" && (
                  <p className="mt-2 text-sm text-[var(--cg-muted)]">
                    The public business profile was not returned. The name shown is the directory name when that list includes this business.
                  </p>
                )}
                <div className="mt-4 flex flex-col items-start gap-1">
                  <AppButton isDisabled>Edit account</AppButton>
                  <span className="text-xs text-[var(--cg-muted)]">Coming soon</span>
                </div>
              </section>

              <section className={panelClass} aria-labelledby="business-actions">
                <h2 id="business-actions" className="text-base font-semibold text-[var(--cg-primary-dark)]">
                  Quick actions
                </h2>
                <div className="mt-4 flex flex-col items-start gap-4">
                  <div className="flex flex-col gap-1">
                    <Link to="/campaigns/new" className={linkClass}>
                      Create campaign
                    </Link>
                    <span className="text-xs text-[var(--cg-muted)]">Opens the campaign form</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Link to="/discover?type=creator" className={linkClass}>
                      Find creators
                    </Link>
                    <span className="text-xs text-[var(--cg-muted)]">Opens the creator directory</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Link to="/campaigns" className={linkClass}>
                      Browse campaigns
                    </Link>
                    <span className="text-xs text-[var(--cg-muted)]">Opens the public campaign list</span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
