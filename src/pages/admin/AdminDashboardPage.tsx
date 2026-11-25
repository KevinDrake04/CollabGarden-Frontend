import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  BadgeCheck,
  Ban,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  Mail,
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
  AppNotice,
  AppSearch,
  AppSelect,
  AppTextarea,
  ConfirmDialog,
  FoundingMemberCard,
  LoadingSkeleton,
  PendingAccountCard,
  adminStatusLabel,
} from "../../components";
import { AuthError } from "../../api/auth";
import type { County } from "../../api/directory";
import {
  AdminApiError,
  setAccountStatus,
  updateWaitlistEntry,
  type AccountStatus,
  type AccountSummary,
  type AccountType,
  type BusinessName,
  type CampaignQuery,
  type CampaignRecord,
  type CampaignStatus,
  type WaitlistEntry,
  type WaitlistQuery,
  type WaitlistSort,
  type WaitlistStatus,
} from "../../api/admin";
import {
  accountTypeLabel,
  businessName,
  countyList,
  countyName,
  dateParam,
  deliverableSummary,
  formatDate,
  formatDateRange,
  matchesQuery,
  offerLabel,
  roleLabel,
} from "./format";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../auth/SiteHeader";
import {
  dashboardPath,
  expireSession,
  readSession,
  readSessionExpired,
  refreshSession,
  useExpiredSessionRedirect,
  watchSession,
  type Session,
} from "../auth/session";
import { useAdminData, type Resource } from "./useAdminData";

const sections = {
  overview: "Pending approvals, founding members, and campaigns.",
  approvals: "Business and creator accounts waiting for a decision.",
  "founding-members": "Founding member waitlist.",
  campaigns: "Campaigns across CollabGarden.",
  accounts: "Pending, approved, and suspended accounts.",
} as const;

type Section = keyof typeof sections;
type AccountTypeFilter = "all" | AccountType;
type ListKind = "approvals" | "accounts" | "members" | "campaigns";

const titles: Record<Section, string> = {
  overview: "Overview",
  approvals: "Pending approvals",
  "founding-members": "Founding Members",
  campaigns: "Campaigns",
  accounts: "Accounts",
};

const textLink = "rounded-sm text-sm font-semibold text-[var(--cg-primary-dark)] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)]";
const actionLink = "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)]";

type PendingChange =
  | { kind: "account"; account: AccountSummary; status: AccountStatus }
  | { kind: "waitlist"; entry: WaitlistEntry; status: WaitlistStatus };

type Notice = { tone: "success" | "error"; message: string };

function sectionFrom(param: string | undefined): Section | "unknown" {
  if (!param) return "overview";
  return param in sections ? (param as Section) : "unknown";
}

function sessionRoleName(role: Session["role"]) {
  if (role === "business") return "business";
  if (role === "creator") return "creator";
  return "administrator";
}

function sessionFailure(error: unknown) {
  if (error instanceof AuthError || error instanceof Error) {
    return error.message || "Couldn't confirm this account.";
  }
  return "Couldn't confirm this account.";
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
  if (entry.updated_at) lines.push(`Updated ${formatDate(entry.updated_at)}`);
  return lines;
}

function campaignDetail(campaign: CampaignRecord, counties: County[], businesses: BusinessName[]) {
  const parts = [
    businessName(campaign.business_id, businesses),
    offerLabel(campaign.offer_type),
    formatDateRange(campaign.starts_on, campaign.ends_on),
    countyList(campaign.county_ids, counties),
  ];
  const requirements = deliverableSummary(campaign.deliverable_requirements);
  if (requirements) parts.push(requirements);
  return parts.join(" · ");
}

function byName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function listEmpty(kind: ListKind, search: string, filtered: boolean) {
  if (search.trim()) {
    if (kind === "approvals") return { title: "No matching approvals", description: "No pending accounts match this search." };
    if (kind === "accounts") return { title: "No matching accounts", description: "No accounts match this search." };
    if (kind === "members") return { title: "No matching founding members", description: "No founding members match this search." };
    return { title: "No matching campaigns", description: "No campaigns match this search." };
  }
  if (filtered) {
    if (kind === "approvals") return { title: "No matching approvals", description: "No pending accounts match this filter." };
    if (kind === "accounts") return { title: "No matching accounts", description: "No accounts match this filter." };
    if (kind === "members") return { title: "No matching founding members", description: "No founding members match this filter." };
    return { title: "No matching campaigns", description: "No campaigns match this filter." };
  }
  if (kind === "approvals") return { title: "No pending accounts", description: "Accounts with status pending will show up here." };
  if (kind === "accounts") return { title: "No accounts", description: "The administrator list is empty." };
  if (kind === "members") return { title: "No founding members", description: "The waitlist is empty." };
  return { title: "No campaigns", description: "The administrator list is empty." };
}

function searchStatus(query: string, count: number, singular: string, plural: string) {
  if (!query.trim()) return null;
  const message = count === 0
    ? `No ${plural} match this search.`
    : `${count} ${count === 1 ? singular : plural} match this search.`;
  return <p className="sr-only" aria-live="polite">{message}</p>;
}

function ResourceBody({
  status,
  message,
  isEmpty,
  emptyTitle,
  emptyDescription,
  onRetry,
  children,
}: {
  status: Resource<unknown>["status"];
  message: string;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onRetry: () => void;
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
        className="rounded-xl border border-[var(--cg-border)] bg-white px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)] disabled:opacity-60"
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
      className="break-all rounded-sm text-sm font-medium text-[var(--cg-primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)]"
    >
      {href}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function ResourceNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert">
      <AppNotice tone="error" message={message} />
    </div>
  );
}

export default function AdminDashboardPage() {
  const params = useParams();
  const location = useLocation();
  const previewParam = new URLSearchParams(location.search).get("preview");
  const preview = previewParam === "loading" || previewParam === "empty" ? previewParam : null;
  const section = sectionFrom(params.section);
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [accountState, setAccountState] = useState<"pending" | "ready" | "error">(() =>
    readSession() ? "pending" : "ready",
  );
  const [accountError, setAccountError] = useState("");
  const [accountAttempt, setAccountAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all");
  const [accountType, setAccountType] = useState<AccountTypeFilter>("all");
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

  useExpiredSessionRedirect();
  useEffect(() => watchSession(() => setSession(readSession())), []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const stored = readSession();
    if (!stored) {
      setSession(null);
      setAccountError("");
      setAccountState("ready");
      return () => controller.abort();
    }

    setAccountState("pending");
    setAccountError("");
    refreshSession(controller.signal)
      .then((next) => {
        if (controller.signal.aborted || !next) return;
        setSession(next);
        setAccountState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof AuthError && error.status === 401) {
          expireSession();
          return;
        }
        setAccountState("error");
        setAccountError(sessionFailure(error));
      });
    return () => controller.abort();
  }, [accountAttempt]);
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

  const waitlistFiltered = Boolean(waitlistQuery.role || waitlistQuery.status || waitlistQuery.county_id);
  const waitlistActive = Boolean(waitlistFiltered || waitlistQuery.sort_by);
  const campaignActive = Boolean(
    campaignQuery.status || campaignQuery.county_id || campaignQuery.starts_after || campaignQuery.ends_before,
  );
  const adminSession = accountState === "ready" && session?.role === "admin" ? session : null;

  const data = useAdminData({
    token: preview ? null : adminSession?.accessToken ?? null,
    enabled: adminSession != null && preview == null,
    preview,
    waitlistActive,
    waitlistQuery,
    campaignActive,
    campaignQuery,
  });

  const showData = preview != null || adminSession != null;
  const canManageAccounts = adminSession != null && preview == null && data.accounts.status === "ready" && !busy;
  const canManageWaitlist = adminSession != null && preview == null && data.waitlist.status === "ready" && !busy;
  const actionReason = "An administrator session is required before this change can be sent.";
  const waitlistSource = waitlistActive && data.waitlistView ? data.waitlistView : data.waitlist;
  const campaignSource = campaignActive && data.campaignView ? data.campaignView : data.campaigns;
  const countyOptions = [
    { value: "all", label: "All counties" },
    ...data.counties.map((county) => ({ value: String(county.county_id), label: county.name })),
  ];
  const returnPath = `${location.pathname}${location.search}`;

  function askAccount(account: AccountSummary, status: AccountStatus) {
    if (!canManageAccounts) return;
    setReviewNote("");
    setPending({ kind: "account", account, status });
  }

  function askWaitlist(entry: WaitlistEntry, status: WaitlistStatus) {
    if (!canManageWaitlist) return;
    setReviewNote("");
    setPending({ kind: "waitlist", entry, status });
  }

  async function commit() {
    if (lock.current || !pending) return;
    const token = adminSession?.accessToken;
    const change = pending;
    const allowed = change.kind === "account"
      ? data.accounts.status === "ready"
      : data.waitlist.status === "ready";
    if (!token || !allowed || preview) {
      setActionNotice({ tone: "error", message: actionReason });
      setPending(null);
      return;
    }
    lock.current = true;
    setBusy(true);
    setActionNotice(null);
    try {
      if (change.kind === "account") {
        await setAccountStatus(token, change.account, change.status);
        if (!mounted.current) return;
        const name = change.account.name || "The account";
        setActionNotice({
          tone: "success",
          message: `${name} is now ${adminStatusLabel(change.status).toLowerCase()}.`,
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
          message: `${memberName(change.entry)} is now ${adminStatusLabel(change.status).toLowerCase()}.`,
        });
      }
      setPending(null);
      data.reload();
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof AdminApiError && error.status === 401) {
        expireSession();
        setPending(null);
        return;
      }
      const message = error instanceof AdminApiError
        ? error.message
        : "The admin dashboard could not be reached.";
      setActionNotice({ tone: "error", message });
      setPending(null);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function accountActions(account: AccountSummary) {
    return (
      <div className="flex flex-wrap gap-2">
        {account.status !== "approved" && (
          <AppButton
            isDisabled={!canManageAccounts}
            aria-label={`${account.status === "pending" ? "Approve" : "Set approved"} ${account.name}`}
            onPress={() => askAccount(account, "approved")}
          >
            {account.status === "pending" ? "Approve" : "Set approved"}
          </AppButton>
        )}
        {account.status !== "suspended" && (
          <AppButton
            variant="destructive"
            isDisabled={!canManageAccounts}
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
            isDisabled={!canManageWaitlist}
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

  function accountMatches(account: AccountSummary) {
    if (accountType !== "all" && account.account_type !== accountType) return false;
    return matchesQuery(query, [account.name, account.account_type, String(account.account_id)]);
  }

  const visibleAccounts = byName(
    (accountFilter === "all"
      ? [...data.accounts.data.pending, ...data.accounts.data.approved, ...data.accounts.data.suspended]
      : data.accounts.data[accountFilter]
    ).filter(accountMatches),
  );
  const pendingAccounts = byName(data.accounts.data.pending.filter(accountMatches));
  const visibleMembers = waitlistSource.data.filter((entry) =>
    matchesQuery(query, [entry.name, entry.owner_name, entry.email, entry.role, entry.niche_or_category]),
  );
  const visibleCampaigns = campaignSource.data.filter((campaign) =>
    matchesQuery(query, [
      campaign.name,
      campaign.description,
      campaign.status,
      businessName(campaign.business_id, data.businesses),
      deliverableSummary(campaign.deliverable_requirements),
    ]),
  );
  const approvalEmpty = listEmpty("approvals", query, accountType !== "all");
  const accountEmpty = listEmpty("accounts", query, accountFilter !== "all" || accountType !== "all");
  const memberEmpty = listEmpty("members", query, waitlistFiltered);
  const campaignEmpty = listEmpty("campaigns", query, campaignActive);
  const previewMessage = preview === "loading"
    ? "Preview: loading state. No administrator request is in progress."
    : preview === "empty"
      ? "Preview: empty administrator lists. These are not live records, and actions stay disabled."
      : null;
  const destructive = pending?.kind === "account"
    ? pending.status === "suspended"
    : pending?.status === "rejected";
  const dialogTitle = pending?.kind === "account"
    ? pending.status === "suspended" ? "Suspend account" : "Approve account"
    : "Update founding member";
  const dialogDescription = pending?.kind === "account"
    ? `${pending.status === "suspended" ? "Suspend" : "Approve"} ${pending.account.name || "this account"}? Their status will become ${pending.status}.`
    : pending
      ? `Set ${memberName(pending.entry)} to ${pending.status}?`
      : "";
  const confirmLabel = pending?.kind === "account"
    ? pending.status === "suspended" ? "Suspend" : "Approve"
    : "Update";
  const allLoading = data.accounts.status === "loading"
    && data.waitlist.status === "loading"
    && data.campaigns.status === "loading";
  const sectionBusy = section === "overview"
    ? data.accounts.status === "loading" || data.waitlist.status === "loading" || data.campaigns.status === "loading"
    : section === "approvals" || section === "accounts"
      ? data.accounts.status === "loading"
      : section === "founding-members"
        ? waitlistSource.status === "loading"
        : section === "campaigns"
          ? campaignSource.status === "loading"
          : false;

  function waitlistCount(status: WaitlistStatus) {
    if (data.waitlist.status !== "ready") return "-";
    return data.waitlist.data.filter((entry) => entry.status === status).length;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f8f0] text-[var(--cg-text)]">
      <SiteHeader />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
        <div role="main" className="min-w-0 space-y-5" aria-busy={showData && sectionBusy}>
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
              isDisabled={!showData || preview != null || data.refreshing || allLoading}
            >
              {data.refreshing ? "Refreshing" : "Refresh"}
            </AppButton>
          </div>

          {!showData && (
            <div aria-live="polite" className="space-y-3">
              {(accountState === "pending" || readSessionExpired()) && (
                <p className="text-sm text-[var(--cg-muted)]">Checking this account...</p>
              )}
              {accountState === "error" && (
                <>
                  <AppNotice tone="error" message={accountError || "Couldn't confirm this account."} />
                  <AppButton variant="secondary" onPress={() => setAccountAttempt((value) => value + 1)}>
                    Try again
                  </AppButton>
                </>
              )}
              {accountState === "ready" && !session && !readSessionExpired() && (
                <>
                  <AppNotice
                    tone="info"
                    message="Sign in with an administrator account to use the admin dashboard."
                  />
                  <Link to="/login" state={{ from: returnPath }} className={actionLink}>
                    Log in
                  </Link>
                </>
              )}
              {accountState === "ready" && session && session.role !== "admin" && (
                <>
                  <AppNotice
                    tone="info"
                    message={`This dashboard is for administrator accounts. You are signed in as a ${sessionRoleName(session.role)} account.`}
                  />
                  <Link to={dashboardPath(session.role)} className={actionLink}>
                    Go to your dashboard
                  </Link>
                </>
              )}
            </div>
          )}

          {showData && previewMessage && <AppNotice tone="info" message={previewMessage} />}
          {showData && actionNotice && (
            <div aria-live="polite">
              <AppNotice
                tone={actionNotice.tone}
                message={actionNotice.message}
                onClose={() => setActionNotice(null)}
              />
            </div>
          )}

          {showData && section === "overview" && (
            <>
              {data.accounts.status === "error" && <ResourceNotice message={data.accounts.message} />}
              {data.waitlist.status === "error" && <ResourceNotice message={data.waitlist.message} />}
              {data.campaigns.status === "error" && <ResourceNotice message={data.campaigns.message} />}
              <ResourceNotice message={data.accountRefreshError} />
              <ResourceNotice message={data.waitlistRefreshError} />
              <ResourceNotice message={data.campaignRefreshError} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.accounts.status === "loading" ? (
                  <>
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                  </>
                ) : (
                  <>
                    <AdminStatCard
                      label="Pending approvals"
                      value={data.accounts.status === "ready" ? data.accounts.data.pending.length : "-"}
                      detail={data.accounts.status === "ready" ? "Status pending" : "Not available"}
                      icon={<ClipboardCheck size={18} aria-hidden="true" />}
                    />
                    <AdminStatCard
                      label="Approved accounts"
                      value={data.accounts.status === "ready" ? data.accounts.data.approved.length : "-"}
                      detail={data.accounts.status === "ready" ? "Status approved" : "Not available"}
                      icon={<BadgeCheck size={18} aria-hidden="true" />}
                    />
                    <AdminStatCard
                      label="Suspended accounts"
                      value={data.accounts.status === "ready" ? data.accounts.data.suspended.length : "-"}
                      detail={data.accounts.status === "ready" ? "Status suspended" : "Not available"}
                      icon={<Ban size={18} aria-hidden="true" />}
                    />
                  </>
                )}
                {data.waitlist.status === "loading" ? (
                  <>
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                  </>
                ) : (
                  <>
                    <AdminStatCard
                      label="Founding members"
                      value={data.waitlist.status === "ready" ? data.waitlist.data.length : "-"}
                      detail={data.waitlist.status === "ready" ? "Waitlist" : "Not available"}
                      icon={<Sparkles size={18} aria-hidden="true" />}
                    />
                    <AdminStatCard
                      label="Waiting"
                      value={waitlistCount("waiting")}
                      detail={data.waitlist.status === "ready" ? "Founding members" : "Not available"}
                      icon={<Clock size={18} aria-hidden="true" />}
                    />
                    <AdminStatCard
                      label="Invited"
                      value={waitlistCount("invited")}
                      detail={data.waitlist.status === "ready" ? "Founding members" : "Not available"}
                      icon={<Mail size={18} aria-hidden="true" />}
                    />
                    <AdminStatCard
                      label="Active"
                      value={waitlistCount("active")}
                      detail={data.waitlist.status === "ready" ? "Founding members" : "Not available"}
                      icon={<BadgeCheck size={18} aria-hidden="true" />}
                    />
                    <AdminStatCard
                      label="Rejected"
                      value={waitlistCount("rejected")}
                      detail={data.waitlist.status === "ready" ? "Founding members" : "Not available"}
                      icon={<Ban size={18} aria-hidden="true" />}
                    />
                  </>
                )}
                {data.campaigns.status === "loading" ? (
                  <>
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                  </>
                ) : (
                  <>
                    <AdminStatCard
                      label="Open campaigns"
                      value={data.campaigns.status === "ready" ? data.campaigns.data.filter((campaign) => campaign.status === "open").length : "-"}
                      detail={data.campaigns.status === "ready" ? "Status open" : "Not available"}
                      icon={<Megaphone size={18} aria-hidden="true" />}
                    />
                    <AdminStatCard
                      label="All campaigns"
                      value={data.campaigns.status === "ready" ? data.campaigns.data.length : "-"}
                      detail={data.campaigns.status === "ready" ? "Administrator list" : "Not available"}
                      icon={<LayoutDashboard size={18} aria-hidden="true" />}
                    />
                  </>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {data.accounts.status === "ready" && (
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
                )}
                {data.waitlist.status === "ready" && (
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
                )}
              </div>
            </>
          )}

          {showData && section === "approvals" && (
            <>
              {data.accounts.status === "ready" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <AppSelect
                    label="Account type"
                    value={accountType}
                    onChange={(value) => setAccountType(value === "business" || value === "creator" ? value : "all")}
                    options={[
                      { value: "all", label: "All types" },
                      { value: "business", label: "Business" },
                      { value: "creator", label: "Creator" },
                    ]}
                  />
                  <AppSearch label="Search approvals" value={query} onChange={setQuery} placeholder="Search name or account id" />
                </div>
              )}
              <ResourceNotice message={data.accountRefreshError} />
              {data.accounts.status === "ready" && searchStatus(query, pendingAccounts.length, "approval", "approvals")}
              <ResourceBody
                status={data.accounts.status}
                message={data.accounts.message}
                isEmpty={pendingAccounts.length === 0}
                emptyTitle={approvalEmpty.title}
                emptyDescription={approvalEmpty.description}
                onRetry={data.reload}
              >
                <div className="grid gap-3">
                  {pendingAccounts.map(renderAccount)}
                </div>
              </ResourceBody>
            </>
          )}

          {showData && section === "founding-members" && (
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
                  />
                  <AppSelect
                    label="County"
                    value={waitlistCounty}
                    onChange={setWaitlistCounty}
                    options={countyOptions}
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
                  />
                </div>
              )}
              {data.waitlist.status === "ready" && (
                <AppSearch label="Search founding members" value={query} onChange={setQuery} placeholder="Search name or email" />
              )}
              <ResourceNotice message={data.waitlistRefreshError} />
              {waitlistSource.status === "ready" && searchStatus(query, visibleMembers.length, "founding member", "founding members")}
              <ResourceBody
                status={waitlistSource.status}
                message={waitlistSource.message}
                isEmpty={visibleMembers.length === 0}
                emptyTitle={memberEmpty.title}
                emptyDescription={memberEmpty.description}
                onRetry={data.reload}
              >
                <div className="grid gap-3">{visibleMembers.map(renderMember)}</div>
              </ResourceBody>
            </>
          )}

          {showData && section === "campaigns" && (
            <>
              <p className="max-w-xl text-sm text-[var(--cg-muted)]">
                Campaign status cannot be changed from this list.
              </p>
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
              <ResourceNotice message={data.campaignRefreshError} />
              {campaignSource.status === "ready" && searchStatus(query, visibleCampaigns.length, "campaign", "campaigns")}
              <ResourceBody
                status={campaignSource.status}
                message={campaignSource.message}
                isEmpty={visibleCampaigns.length === 0}
                emptyTitle={campaignEmpty.title}
                emptyDescription={campaignEmpty.description}
                onRetry={data.reload}
              >
                <>
                  <div className="hidden overflow-x-auto rounded-2xl border border-[var(--cg-border)] bg-white xl:block">
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
                        {visibleCampaigns.map((campaign) => {
                          const requirements = deliverableSummary(campaign.deliverable_requirements);
                          return (
                            <tr key={campaign.campaign_id} className="border-b border-[var(--cg-border)] last:border-b-0">
                              <th className="px-4 py-3 font-semibold" scope="row">
                                {campaign.name}
                                {campaign.description && (
                                  <div className="mt-1 font-normal text-[var(--cg-muted)]">{campaign.description}</div>
                                )}
                                {requirements && (
                                  <div className="mt-1 font-normal text-[var(--cg-muted)]">{requirements}</div>
                                )}
                              </th>
                              <td className="px-4 py-3"><AdminStatusBadge status={campaign.status} /></td>
                              <td className="px-4 py-3">{businessName(campaign.business_id, data.businesses)}</td>
                              <td className="px-4 py-3">{offerLabel(campaign.offer_type)}</td>
                              <td className="px-4 py-3">{formatDateRange(campaign.starts_on, campaign.ends_on)}</td>
                              <td className="px-4 py-3">{countyList(campaign.county_ids, data.counties)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid gap-3 xl:hidden">
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

          {showData && section === "accounts" && (
            <>
              {data.accounts.status === "ready" && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                  <AppSelect
                    label="Account type"
                    value={accountType}
                    onChange={(value) => setAccountType(value === "business" || value === "creator" ? value : "all")}
                    options={[
                      { value: "all", label: "All types" },
                      { value: "business", label: "Business" },
                      { value: "creator", label: "Creator" },
                    ]}
                  />
                  <AppSearch label="Search accounts" value={query} onChange={setQuery} placeholder="Search name or account id" />
                </div>
              )}
              <ResourceNotice message={data.accountRefreshError} />
              {data.accounts.status === "ready" && searchStatus(query, visibleAccounts.length, "account", "accounts")}
              <ResourceBody
                status={data.accounts.status}
                message={data.accounts.message}
                isEmpty={visibleAccounts.length === 0}
                emptyTitle={accountEmpty.title}
                emptyDescription={accountEmpty.description}
                onRetry={data.reload}
              >
                <div className="grid gap-3">{visibleAccounts.map(renderAccount)}</div>
              </ResourceBody>
            </>
          )}

          {showData && section === "unknown" && (
            <AdminEmptyState
              title="This admin page is not available"
              description="Choose Overview, Approvals, Accounts, Founding Members, or Campaigns."
            />
          )}
        </div>
      </div>

      <SiteFooter />

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
                placeholder="Optional note"
                rows={3}
              />
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
