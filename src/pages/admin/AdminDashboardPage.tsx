import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  BadgeCheck,
  Ban,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  Sparkles,
  Users,
} from "lucide-react";
import {
  AdminCampaignRow,
  AdminEmptyState,
  AdminStatCard,
  AdminStatusBadge,
  AppButton,
  AppInput,
  AppNotice,
  AppSearch,
  AppSelect,
  AppTextarea,
  ConfirmDialog,
  DashboardSidebar,
  FoundingMemberCard,
  LoadingSkeleton,
  PendingAccountCard,
  PublicNavbar,
  adminStatusLabel,
  type NavItem,
} from "../../components";
import type { County } from "../directory/api";
import {
  AdminApiError,
  setAccountStatus,
  updateWaitlistEntry,
  type AccountStatus,
  type AccountSummary,
  type BusinessName,
  type CampaignQuery,
  type CampaignRecord,
  type CampaignStatus,
  type WaitlistEntry,
  type WaitlistQuery,
  type WaitlistSort,
  type WaitlistStatus,
} from "./api";
import {
  accountTypeLabel,
  businessName,
  countyList,
  countyName,
  dateParam,
  formatDate,
  formatDateRange,
  matchesQuery,
  offerLabel,
  roleLabel,
} from "./format";
import { isBlockedRole, readStoredSession, watchStoredSession } from "./session";
import { useAdminData, type Resource } from "./useAdminData";

const sections = {
  overview: "Counts from the administrator lists.",
  approvals: "Business and creator accounts with status pending.",
  "founding-members": "Founding Member waitlist.",
  campaigns: "Campaigns returned by the administrator list.",
  accounts: "Pending, approved, and suspended accounts.",
} as const;

type Section = keyof typeof sections;

const titles: Record<Section, string> = {
  overview: "Overview",
  approvals: "Pending approvals",
  "founding-members": "Founding Members",
  campaigns: "Campaigns",
  accounts: "Accounts",
};

const adminLinks: NavItem[] = [
  { label: "Overview", to: "/dashboard/admin", icon: LayoutDashboard, end: true },
  { label: "Approvals", to: "/dashboard/admin/approvals", icon: ClipboardCheck },
  { label: "Founding members", to: "/dashboard/admin/founding-members", icon: Sparkles },
  { label: "Campaigns", to: "/dashboard/admin/campaigns", icon: Megaphone },
  { label: "Accounts", to: "/dashboard/admin/accounts", icon: Users },
];

const publicLinks = [
  { label: "Home", to: "/" },
  { label: "Discover", to: "/discover" },
];

const textLink = "text-sm font-semibold text-[var(--cg-primary-dark)] no-underline";

type PendingChange =
  | { kind: "account"; account: AccountSummary; status: AccountStatus }
  | { kind: "waitlist"; entry: WaitlistEntry; status: WaitlistStatus };

type Notice = { tone: "success" | "error"; message: string };

function sectionFrom(param: string | undefined): Section | "unknown" {
  if (!param) return "overview";
  return param in sections ? (param as Section) : "unknown";
}

function memberName(entry: WaitlistEntry) {
  return entry.name || entry.owner_name || "Unnamed founding member";
}

function memberDetails(entry: WaitlistEntry, counties: County[]) {
  const lines = [
    `${roleLabel(entry.role)} · ${entry.email || "No email"}`,
    countyName(entry.county_id, counties),
  ];
  if (entry.owner_name && entry.owner_name !== entry.name) lines.push(`Owner: ${entry.owner_name}`);
  if (entry.niche_or_category) lines.push(entry.niche_or_category);
  if (entry.created_at) lines.push(`Added ${formatDate(entry.created_at)}`);
  if (entry.invited_at) lines.push(`Invited ${formatDate(entry.invited_at)}`);
  if (entry.activated_at) lines.push(`Activated ${formatDate(entry.activated_at)}`);
  return lines;
}

function campaignDetail(campaign: CampaignRecord, counties: County[], businesses: BusinessName[]) {
  return [
    businessName(campaign.business_id, businesses),
    offerLabel(campaign.offer_type),
    formatDateRange(campaign.starts_on, campaign.ends_on),
    countyList(campaign.county_ids, counties),
  ].join(" · ");
}

function byName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function ResourceBody({
  status,
  message,
  isEmpty,
  emptyTitle,
  emptyDescription,
  onRetry,
  quietError = false,
  children,
}: {
  status: Resource<unknown>["status"];
  message: string;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onRetry: () => void;
  quietError?: boolean;
  children: ReactNode;
}) {
  if (status === "loading") {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Loading administrator data">
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>
    );
  }
  if (status === "error") {
    if (quietError) return null;
    return (
      <div role="alert" className="space-y-3">
        <AppNotice tone="error" message={message} />
        <AppButton variant="secondary" onPress={onRetry}>
          Try again
        </AppButton>
      </div>
    );
  }
  if (isEmpty) return <AdminEmptyState title={emptyTitle} description={emptyDescription} />;
  return children;
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--cg-text)]">
      {label}
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-[var(--cg-border)] bg-white px-3 py-2 text-sm font-normal disabled:opacity-60"
      />
    </label>
  );
}

function MemberLink({ href }: { href: string }) {
  if (!/^https?:\/\//i.test(href)) {
    return <span className="break-all text-sm">{href}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all text-sm font-medium text-[var(--cg-primary-dark)]"
    >
      {href}
    </a>
  );
}

export default function AdminDashboardPage() {
  const params = useParams();
  const location = useLocation();
  const previewParam = new URLSearchParams(location.search).get("preview");
  const preview = previewParam === "loading" || previewParam === "empty" ? previewParam : null;
  const section = sectionFrom(params.section);
  const [session, setSession] = useState(() => readStoredSession());
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all");
  const [waitlistRole, setWaitlistRole] = useState<"all" | "business" | "creator">("all");
  const [waitlistStatus, setWaitlistStatus] = useState<"all" | WaitlistStatus>("all");
  const [waitlistCounty, setWaitlistCounty] = useState("all");
  const [waitlistSort, setWaitlistSort] = useState<"newest" | WaitlistSort>("newest");
  const [campaignStatus, setCampaignStatus] = useState<"all" | CampaignStatus>("all");
  const [campaignCounty, setCampaignCounty] = useState("all");
  const [startsAfter, setStartsAfter] = useState("");
  const [endsBefore, setEndsBefore] = useState("");
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<Notice | null>(null);
  const mounted = useRef(true);
  const lock = useRef(false);

  useEffect(() => watchStoredSession(() => setSession(readStoredSession())), []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setQuery("");
    setActionNotice(null);
  }, [section]);

  const waitlistQuery = useMemo<WaitlistQuery>(() => {
    const next: WaitlistQuery = {};
    if (waitlistRole !== "all") next.role = waitlistRole;
    if (waitlistStatus !== "all") next.status = waitlistStatus;
    const countyId = Number(waitlistCounty);
    if (waitlistCounty !== "all" && Number.isInteger(countyId)) next.county_id = countyId;
    if (waitlistSort !== "newest") {
      next.sort_by = waitlistSort;
      next.descending = false;
    }
    return next;
  }, [waitlistRole, waitlistStatus, waitlistCounty, waitlistSort]);

  const campaignQuery = useMemo<CampaignQuery>(() => {
    const countyId = Number(campaignCounty);
    return {
      status: campaignStatus === "all" ? undefined : campaignStatus,
      county_id: campaignCounty !== "all" && Number.isInteger(countyId) ? countyId : undefined,
      starts_after: dateParam(startsAfter),
      ends_before: dateParam(endsBefore),
    };
  }, [campaignStatus, campaignCounty, startsAfter, endsBefore]);

  const waitlistActive = Boolean(
    waitlistQuery.role || waitlistQuery.status || waitlistQuery.county_id || waitlistQuery.sort_by,
  );
  const campaignActive = Boolean(
    campaignQuery.status || campaignQuery.county_id || campaignQuery.starts_after || campaignQuery.ends_before,
  );

  const data = useAdminData({
    token: session?.accessToken ?? null,
    preview,
    waitlistActive,
    waitlistQuery,
    campaignActive,
    campaignQuery,
  });

  const role = data.account?.role ?? session?.role ?? null;
  const email = data.account?.email ?? session?.email ?? null;
  const blocked = isBlockedRole(role);
  const listsReady =
    data.accounts.status === "ready" &&
    data.waitlist.status === "ready" &&
    data.campaigns.status === "ready";
  const canAdminister = Boolean(session?.accessToken) && !blocked && listsReady && preview == null;
  const actionReason = "An administrator session is required before this change can be sent.";

  const waitlistSource = waitlistActive && data.waitlistView ? data.waitlistView : data.waitlist;
  const campaignSource = campaignActive && data.campaignView ? data.campaignView : data.campaigns;

  const countyOptions = [
    { value: "all", label: "All counties" },
    ...data.counties.map((county) => ({ value: String(county.county_id), label: county.name })),
  ];

  function accessNotice(): Notice | { tone: "info"; message: string } {
    if (preview === "loading") {
      return { tone: "info", message: "Preview: loading state. No administrator request is in progress." };
    }
    if (preview === "empty") {
      return {
        tone: "info",
        message: "Preview: empty administrator lists. These are not live records, and actions stay disabled.",
      };
    }
    const apiMessage = data.accounts.message || data.refreshError;
    const apiLine = apiMessage ? ` The API responded: ${apiMessage}` : "";
    if (data.accounts.status === "loading") {
      return session
        ? { tone: "info", message: "Checking administrator access." }
        : { tone: "info", message: "Sign in to use administrator actions. Checking the administrator API." };
    }
    if (!session) {
      return {
        tone: "error",
        message: `Sign in with an administrator account. Actions stay disabled until that session is available.${apiLine}`,
      };
    }
    if (blocked) {
      return {
        tone: "error",
        message: `This session is a ${roleLabel(role)} account. Administrator actions stay disabled.${apiLine}`,
      };
    }
    if (canAdminister) {
      const who = email ? `Signed in as ${email}. ` : "";
      return { tone: "info", message: `${who}The administrator API accepted this session.` };
    }
    return { tone: "error", message: `This session cannot use administrator actions.${apiLine}` };
  }

  function askAccount(account: AccountSummary, status: AccountStatus) {
    if (!canAdminister || busy) return;
    setReviewNote("");
    setPending({ kind: "account", account, status });
  }

  function askWaitlist(entry: WaitlistEntry, status: WaitlistStatus) {
    if (!canAdminister || busy) return;
    setReviewNote("");
    setPending({ kind: "waitlist", entry, status });
  }

  async function commit() {
    if (lock.current || !pending) return;
    const token = session?.accessToken;
    if (!canAdminister || !token) {
      setActionNotice({ tone: "error", message: actionReason });
      setPending(null);
      return;
    }
    lock.current = true;
    setBusy(true);
    setActionNotice(null);
    const change = pending;
    try {
      if (change.kind === "account") {
        await setAccountStatus(token, change.account, change.status);
        if (!mounted.current) return;
        const name = change.account.name || "The account";
        setActionNotice({
          tone: "success",
          message: `The API confirmed ${name} is now ${adminStatusLabel(change.status).toLowerCase()}.`,
        });
      } else {
        const note = reviewNote.trim();
        await updateWaitlistEntry(token, change.entry.founding_member_id, {
          status: change.status,
          review_note: note || undefined,
        });
        if (!mounted.current) return;
        setActionNotice({
          tone: "success",
          message: `The API confirmed ${memberName(change.entry)} is now ${adminStatusLabel(change.status).toLowerCase()}.`,
        });
      }
      setPending(null);
      data.reload();
    } catch (error) {
      if (!mounted.current) return;
      const message = error instanceof AdminApiError
        ? error.message
        : "The administrator API could not be reached.";
      setActionNotice({ tone: "error", message });
      setPending(null);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function accountActions(account: AccountSummary) {
    const disabled = !canAdminister || busy;
    return (
      <div className="flex flex-wrap gap-2">
        {account.status !== "approved" && (
          <AppButton
            isDisabled={disabled}
            aria-label={`${account.status === "pending" ? "Approve" : "Set approved"} ${account.name}`}
            onPress={() => askAccount(account, "approved")}
          >
            {account.status === "pending" ? "Approve" : "Set approved"}
          </AppButton>
        )}
        {account.status !== "suspended" && (
          <AppButton
            variant="destructive"
            isDisabled={disabled}
            aria-label={`Suspend ${account.name}`}
            onPress={() => askAccount(account, "suspended")}
          >
            Suspend
          </AppButton>
        )}
      </div>
    );
  }

  function waitlistActions(entry: WaitlistEntry) {
    const disabled = !canAdminister || busy;
    const name = memberName(entry);
    const choices: Array<{ status: WaitlistStatus; label: string; variant?: "destructive" | "secondary" }> = [
      { status: "invited", label: "Invite" },
      { status: "active", label: "Activate" },
      { status: "rejected", label: "Reject", variant: "destructive" },
      { status: "waiting", label: "Return to waiting", variant: "secondary" },
    ];
    return (
      <div className="flex flex-wrap gap-2">
        {choices.filter((choice) => choice.status !== entry.status).map((choice) => (
          <AppButton
            key={choice.status}
            variant={choice.variant}
            isDisabled={disabled}
            aria-label={`${choice.label} ${name}`}
            onPress={() => askWaitlist(entry, choice.status)}
          >
            {choice.label}
          </AppButton>
        ))}
      </div>
    );
  }

  function renderAccount(account: AccountSummary) {
    return (
      <PendingAccountCard
        key={`${account.account_type}-${account.account_id}`}
        name={account.name || "Unnamed account"}
        detail={`${accountTypeLabel(account.account_type)} · Account ${account.account_id}`}
        status={account.status}
        actions={accountActions(account)}
      />
    );
  }

  function renderMember(entry: WaitlistEntry) {
    return (
      <FoundingMemberCard
        key={entry.founding_member_id}
        name={memberName(entry)}
        details={memberDetails(entry, data.counties)}
        status={entry.status || "unknown"}
        note={entry.review_note}
        actions={waitlistActions(entry)}
      >
        {entry.link && <MemberLink href={entry.link} />}
      </FoundingMemberCard>
    );
  }

  const visibleAccounts = byName(
    (accountFilter === "all"
      ? [...data.accounts.data.pending, ...data.accounts.data.approved, ...data.accounts.data.suspended]
      : data.accounts.data[accountFilter]
    ).filter((account) => matchesQuery(query, [account.name, account.account_type, String(account.account_id)])),
  );
  const pendingAccounts = byName(
    data.accounts.data.pending.filter((account) =>
      matchesQuery(query, [account.name, account.account_type, String(account.account_id)]),
    ),
  );
  const visibleMembers = waitlistSource.data.filter((entry) =>
    matchesQuery(query, [entry.name, entry.owner_name, entry.email, entry.role, entry.niche_or_category]),
  );
  const visibleCampaigns = campaignSource.data.filter((campaign) =>
    matchesQuery(query, [
      campaign.name,
      campaign.description,
      campaign.status,
      businessName(campaign.business_id, data.businesses),
    ]),
  );

  const access = accessNotice();
  const destructive = pending?.kind === "account"
    ? pending.status === "suspended"
    : pending?.status === "rejected";
  const dialogTitle = pending?.kind === "account"
    ? pending.status === "suspended" ? "Suspend account" : "Approve account"
    : "Update founding member";
  const dialogDescription = pending?.kind === "account"
    ? `${pending.status === "suspended" ? "Suspend" : "Approve"} ${pending.account.name || "this account"}? The request sets status to ${pending.status}.`
    : pending
      ? `Set ${memberName(pending.entry)} to ${pending.status}? The request sends that status to the waitlist API.`
      : "";
  const confirmLabel = pending?.kind === "account"
    ? pending.status === "suspended" ? "Suspend" : "Approve"
    : "Update";

  const filtersDisabled = data.accounts.status !== "ready";

  return (
    <div className="min-h-screen bg-[#f8f8f0] text-[var(--cg-text)]">
      <header className="site-header">
        <PublicNavbar links={publicLinks} account={{ label: "Login", to: "/login" }} />
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:px-8 md:py-8">
        <div className="w-full shrink-0 md:w-60">
          <div className="md:sticky md:top-24">
            <DashboardSidebar expand title="Admin" links={adminLinks} />
          </div>
        </div>

        <div role="main" className="min-w-0 flex-1 space-y-5" aria-busy={data.accounts.status === "loading"}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)]">
                {section === "unknown" ? "Admin" : titles[section]}
              </h1>
              <p className="mt-1 text-sm text-[var(--cg-muted)]">
                {section === "unknown" ? "Choose a section from the admin navigation." : sections[section]}
              </p>
            </div>
            <AppButton
              variant="secondary"
              onPress={data.reload}
              isDisabled={preview != null || data.accounts.status === "loading" || data.refreshing}
            >
              {data.refreshing ? "Refreshing" : "Refresh"}
            </AppButton>
          </div>

          <AppNotice tone={access.tone} message={access.message} />
          {data.refreshError && data.accounts.status === "ready" && (
            <AppNotice tone="error" message={data.refreshError} />
          )}
          {actionNotice && (
            <div aria-live="polite">
              <AppNotice
                tone={actionNotice.tone}
                message={actionNotice.message}
                onClose={() => setActionNotice(null)}
              />
            </div>
          )}
          {section === "overview" && (
            data.accounts.status === "loading" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading administrator data">
                <LoadingSkeleton />
                <LoadingSkeleton />
                <LoadingSkeleton />
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <AdminStatCard
                    label="Pending approvals"
                    value={listsReady ? data.accounts.data.pending.length : "-"}
                    detail={listsReady ? "Status pending" : "Not available"}
                    icon={<ClipboardCheck size={18} aria-hidden="true" />}
                  />
                  <AdminStatCard
                    label="Approved accounts"
                    value={listsReady ? data.accounts.data.approved.length : "-"}
                    detail={listsReady ? "Status approved" : "Not available"}
                    icon={<BadgeCheck size={18} aria-hidden="true" />}
                  />
                  <AdminStatCard
                    label="Suspended accounts"
                    value={listsReady ? data.accounts.data.suspended.length : "-"}
                    detail={listsReady ? "Status suspended" : "Not available"}
                    icon={<Ban size={18} aria-hidden="true" />}
                  />
                  <AdminStatCard
                    label="Founding members"
                    value={listsReady ? data.waitlist.data.length : "-"}
                    detail={listsReady ? "Waitlist" : "Not available"}
                    icon={<Sparkles size={18} aria-hidden="true" />}
                  />
                  <AdminStatCard
                    label="Open campaigns"
                    value={listsReady ? data.campaigns.data.filter((campaign) => campaign.status === "open").length : "-"}
                    detail={listsReady ? "Status open" : "Not available"}
                    icon={<Megaphone size={18} aria-hidden="true" />}
                  />
                  <AdminStatCard
                    label="All campaigns"
                    value={listsReady ? data.campaigns.data.length : "-"}
                    detail={listsReady ? "Administrator list" : "Not available"}
                    icon={<LayoutDashboard size={18} aria-hidden="true" />}
                  />
                </div>
                {listsReady && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Pending approvals</h2>
                        <Link className={textLink} to="/dashboard/admin/approvals">View approvals</Link>
                      </div>
                      {data.accounts.data.pending.length === 0 ? (
                        <AdminEmptyState
                          title="No pending accounts"
                          description="Accounts with status pending will show up here."
                        />
                      ) : (
                        byName(data.accounts.data.pending).slice(0, 3).map(renderAccount)
                      )}
                    </section>
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Founding members</h2>
                        <Link className={textLink} to="/dashboard/admin/founding-members">View waitlist</Link>
                      </div>
                      {data.waitlist.data.length === 0 ? (
                        <AdminEmptyState
                          title="No founding members"
                          description="The waitlist is empty."
                        />
                      ) : (
                        data.waitlist.data.slice(0, 3).map(renderMember)
                      )}
                    </section>
                  </div>
                )}
              </>
            )
          )}

          {section === "approvals" && (
            <>
              {data.accounts.status === "ready" && (
                <AppSearch label="Search approvals" value={query} onChange={setQuery} placeholder="Search name or account id" />
              )}
              <ResourceBody
                status={data.accounts.status}
                message={data.accounts.message}
                isEmpty={pendingAccounts.length === 0}
                emptyTitle="No pending accounts"
                emptyDescription="Accounts with status pending will show up here."
                onRetry={data.reload}
                quietError
              >
                <div className="grid gap-3">
                  {pendingAccounts.map(renderAccount)}
                </div>
              </ResourceBody>
            </>
          )}

          {section === "founding-members" && (
            <>
              {data.waitlist.status === "ready" && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <AppSelect
                    label="Role"
                    value={waitlistRole}
                    onChange={(value) => setWaitlistRole(value === "business" || value === "creator" ? value : "all")}
                    options={[
                      { value: "all", label: "All roles" },
                      { value: "creator", label: "Creator" },
                      { value: "business", label: "Business" },
                    ]}
                    disabled={filtersDisabled}
                  />
                  <AppSelect
                    label="Status"
                    value={waitlistStatus}
                    onChange={(value) => {
                      const known = ["waiting", "invited", "active", "rejected"];
                      setWaitlistStatus(known.includes(value) ? (value as WaitlistStatus) : "all");
                    }}
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "waiting", label: "Waiting" },
                      { value: "invited", label: "Invited" },
                      { value: "active", label: "Active" },
                      { value: "rejected", label: "Rejected" },
                    ]}
                    disabled={filtersDisabled}
                  />
                  <AppSelect
                    label="County"
                    value={waitlistCounty}
                    onChange={setWaitlistCounty}
                    options={countyOptions}
                    disabled={filtersDisabled}
                  />
                  <AppSelect
                    label="Sort"
                    value={waitlistSort}
                    onChange={(value) => {
                      const known = ["created_at", "name", "status", "county_id"];
                      setWaitlistSort(known.includes(value) ? (value as WaitlistSort) : "newest");
                    }}
                    options={[
                      { value: "newest", label: "Newest" },
                      { value: "name", label: "Name" },
                      { value: "status", label: "Status" },
                      { value: "county_id", label: "County" },
                    ]}
                    disabled={filtersDisabled}
                  />
                </div>
              )}
              {data.waitlist.status === "ready" && (
                <AppSearch label="Search founding members" value={query} onChange={setQuery} placeholder="Search name or email" />
              )}
              <ResourceBody
                status={waitlistSource.status}
                message={waitlistSource.message}
                isEmpty={visibleMembers.length === 0}
                emptyTitle="No founding members"
                emptyDescription="Try another filter, or the waitlist is empty."
                onRetry={data.reload}
                quietError={data.waitlist.status === "error"}
              >
                <div className="grid gap-3">{visibleMembers.map(renderMember)}</div>
              </ResourceBody>
            </>
          )}

          {section === "campaigns" && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p id="campaign-status-note" className="max-w-xl text-sm text-[var(--cg-muted)]">
                  The administrator API can list campaigns. Status changes are unavailable on that API.
                </p>
                <AppButton variant="secondary" isDisabled aria-describedby="campaign-status-note">
                  Change status
                </AppButton>
              </div>
              {data.campaigns.status === "ready" && (
                <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <AppSelect
                    label="Status"
                    value={campaignStatus}
                    onChange={(value) => {
                      setCampaignStatus(value === "draft" || value === "open" || value === "closed" ? value : "all");
                    }}
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "draft", label: "Draft" },
                      { value: "open", label: "Open" },
                      { value: "closed", label: "Closed" },
                    ]}
                  />
                  <AppSelect
                    label="County"
                    value={campaignCounty}
                    onChange={setCampaignCounty}
                    options={countyOptions}
                  />
                  <DateField label="Starts after" value={startsAfter} onChange={setStartsAfter} />
                  <DateField label="Ends before" value={endsBefore} onChange={setEndsBefore} />
                </div>
              )}
              {data.campaigns.status === "ready" && (
                <AppSearch label="Search campaigns" value={query} onChange={setQuery} placeholder="Search campaign or business" />
              )}
              <ResourceBody
                status={campaignSource.status}
                message={campaignSource.message}
                isEmpty={visibleCampaigns.length === 0}
                emptyTitle="No campaigns"
                emptyDescription="Try another filter, or the administrator list is empty."
                onRetry={data.reload}
                quietError={data.campaigns.status === "error"}
              >
                <>
                  <div className="hidden overflow-x-auto rounded-2xl border border-[var(--cg-border)] bg-white md:block">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <caption className="sr-only">Administrator campaigns</caption>
                      <thead className="border-b border-[var(--cg-border)] text-[var(--cg-muted)]">
                        <tr>
                          <th className="px-4 py-3 font-medium" scope="col">Campaign</th>
                          <th className="px-4 py-3 font-medium" scope="col">Status</th>
                          <th className="px-4 py-3 font-medium" scope="col">Business</th>
                          <th className="px-4 py-3 font-medium" scope="col">Offer</th>
                          <th className="px-4 py-3 font-medium" scope="col">Dates</th>
                          <th className="px-4 py-3 font-medium" scope="col">Counties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCampaigns.map((campaign) => (
                          <tr key={campaign.campaign_id} className="border-b border-[var(--cg-border)] last:border-b-0">
                            <th className="px-4 py-3 font-semibold" scope="row">
                              {campaign.name}
                              {campaign.description && (
                                <div className="mt-1 font-normal text-[var(--cg-muted)]">{campaign.description}</div>
                              )}
                            </th>
                            <td className="px-4 py-3"><AdminStatusBadge status={campaign.status} /></td>
                            <td className="px-4 py-3">{businessName(campaign.business_id, data.businesses)}</td>
                            <td className="px-4 py-3">{offerLabel(campaign.offer_type)}</td>
                            <td className="px-4 py-3">{formatDateRange(campaign.starts_on, campaign.ends_on)}</td>
                            <td className="px-4 py-3">{countyList(campaign.county_ids, data.counties)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid gap-3 md:hidden">
                    {visibleCampaigns.map((campaign) => (
                      <AdminCampaignRow
                        key={campaign.campaign_id}
                        name={campaign.name}
                        detail={campaignDetail(campaign, data.counties, data.businesses)}
                        description={campaign.description}
                        status={campaign.status}
                      />
                    ))}
                  </div>
                </>
              </ResourceBody>
            </>
          )}

          {section === "accounts" && (
            <>
              {data.accounts.status === "ready" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <AppSelect
                    label="Status"
                    value={accountFilter}
                    onChange={(value) => {
                      setAccountFilter(value === "pending" || value === "approved" || value === "suspended" ? value : "all");
                    }}
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "pending", label: "Pending" },
                      { value: "approved", label: "Approved" },
                      { value: "suspended", label: "Suspended" },
                    ]}
                  />
                  <AppSearch label="Search accounts" value={query} onChange={setQuery} placeholder="Search name or account id" />
                </div>
              )}
              <ResourceBody
                status={data.accounts.status}
                message={data.accounts.message}
                isEmpty={visibleAccounts.length === 0}
                emptyTitle="No accounts"
                emptyDescription="Try another status, or the administrator list is empty."
                onRetry={data.reload}
                quietError
              >
                <div className="grid gap-3">{visibleAccounts.map(renderAccount)}</div>
              </ResourceBody>
            </>
          )}

          {section === "unknown" && (
            <AdminEmptyState
              title="This admin page is not available"
              description="Choose Overview, Approvals, Founding members, Campaigns, or Accounts."
            />
          )}
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          open
          title={dialogTitle}
          description={dialogDescription}
          confirmLabel={confirmLabel}
          confirmVariant={destructive ? "destructive" : "primary"}
          confirmDisabled={busy}
          onClose={() => {
            if (!busy) setPending(null);
          }}
          onConfirm={() => void commit()}
        >
          {pending.kind === "waitlist" && (
            <div className="mt-4">
              <AppTextarea
                label="Review note"
                value={reviewNote}
                onChange={setReviewNote}
                placeholder="Optional note sent as review_note"
                rows={3}
              />
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
