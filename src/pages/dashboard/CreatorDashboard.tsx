import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, ClipboardList, Sparkles } from "lucide-react";
import {
  AppButton,
  AppNotice,
  DashboardEmptyState,
  DashboardStatCard,
  LoadingSkeleton,
} from "../../components";
import {
  CollaborationApiError,
  collaborationErrorMessage,
  deliverableStatusCounts,
  loadCollaborationWorkspace,
  type CampaignAccess,
} from "../../api/collaborations";
import { getBusinesses, listOpenCampaigns, type BusinessSummary, type Campaign } from "../../api/campaigns";
import { getCounties, type County } from "../../api/directory";
import { expireSession } from "../auth/session";
import { DeliverableOverview } from "./DeliverableOverview";
import { OpportunityList } from "./CreatorOpportunitiesPage";
import { useCreatorGreeting } from "./CreatorAccountPage";
import {
  AccountCheck,
  textLinkClass,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "./workspaceSession";

type OpportunityLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; campaigns: Campaign[]; businesses: BusinessSummary[]; counties: County[] };

type DeliverableLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; access: CampaignAccess[] };

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export default function CreatorDashboard() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ready = accountState === "ready" && session?.role === "creator";
  const greeting = useCreatorGreeting(ready ? session : null);
  const [opportunities, setOpportunities] = useState<OpportunityLoad>({ status: "idle" });
  const [opportunityAttempt, setOpportunityAttempt] = useState(0);
  const [deliverables, setDeliverables] = useState<DeliverableLoad>({ status: "idle" });
  const [deliverableAttempt, setDeliverableAttempt] = useState(0);

  useEffect(() => {
    if (!ready) {
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
        setOpportunities({
          status: "error",
          message: error instanceof Error && error.message ? error.message : "Couldn't load open campaigns.",
        });
      });
    return () => controller.abort();
  }, [ready, opportunityAttempt]);

  useEffect(() => {
    if (!ready || !session) {
      setDeliverables({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setDeliverables({ status: "loading" });
    loadCollaborationWorkspace(session, controller.signal, { includeCreatorNames: false })
      .then((workspace) => {
        if (!controller.signal.aborted) setDeliverables({ status: "ready", access: workspace.access });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof CollaborationApiError && error.status === 401) {
          expireSession();
          setDeliverables({ status: "idle" });
          return;
        }
        setDeliverables({ status: "error", message: collaborationErrorMessage(error) });
      });
    return () => controller.abort();
  }, [ready, session, deliverableAttempt]);

  if (!session || session.role !== "creator") {
    return (
      <WorkspaceAccess
        title="Creator dashboard"
        role="creator"
        session={session}
        from="/dashboard/creator"
        signedOut="Sign in with a creator account to see your account and open campaigns."
      />
    );
  }

  const displayName = greeting.displayName || session.email;
  const openCount = opportunities.status === "ready" ? opportunities.campaigns.length : null;
  const deliverableCounts = deliverables.status === "ready" ? deliverableStatusCounts(deliverables.access) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <h1 className={`break-words ${titleClass}`}>Welcome back, {displayName}</h1>
        {greeting.bio && <p className="mt-2 text-base text-[var(--cg-muted)]">{greeting.bio}</p>}
      </div>

      <AccountCheck state={accountState} message={accountError} onRetry={retry} />

      {ready && (
        <>
          <section aria-label="Overview">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardStatCard
                label="Open campaigns"
                value={openCount ?? "-"}
                icon={<Sparkles size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Submitted deliverables"
                value={deliverableCounts ? deliverableCounts.submitted : "-"}
                icon={<ClipboardList size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Approved deliverables"
                value={deliverableCounts ? deliverableCounts.approved : "-"}
                icon={<BadgeCheck size={20} aria-hidden="true" />}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--cg-primary-dark)]">Opportunities</h2>
              <Link to="/dashboard/creator/opportunities" className={textLinkClass}>
                View opportunities
              </Link>
            </div>
            <p className="text-sm text-[var(--cg-muted)]">
              Open campaigns from local businesses. These are not assigned to you.
            </p>
            {opportunities.status === "loading" && (
              <div className="grid gap-4" aria-busy="true" aria-label="Loading open campaigns">
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
              <OpportunityList
                campaigns={opportunities.campaigns.slice(0, 3)}
                businesses={opportunities.businesses}
                counties={opportunities.counties}
              />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-[var(--cg-primary-dark)]">My Deliverables</h2>
            <DeliverableOverview
              status={
                deliverables.status === "ready"
                  ? "ready"
                  : deliverables.status === "error"
                    ? "error"
                    : "loading"
              }
              access={deliverables.status === "ready" ? deliverables.access : []}
              message={deliverables.status === "error" ? deliverables.message : ""}
              onRetry={() => setDeliverableAttempt((value) => value + 1)}
              emptyMessage="No deliverables yet."
              actionHref="/dashboard/creator/deliverables"
              actionLabel="Open deliverables"
              limit={3}
            />
          </section>
        </>
      )}
    </div>
  );
}
