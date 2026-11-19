import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ClipboardList, List, Megaphone } from "lucide-react";
import {
  AppButton,
  AppNotice,
  CampaignCard,
  DashboardEmptyState,
  DashboardStatCard,
  LoadingSkeleton,
} from "../../components";
import { verifiedBusinessIds } from "../../api/auth";
import {
  CollaborationApiError,
  collaborationErrorMessage,
  deliverableStatusCounts,
  loadCollaborationWorkspace,
  type CampaignAccess,
} from "../../api/collaborations";
import { listCampaigns, type Campaign } from "../../api/campaigns";
import { getBusiness, getCounties, type Business, type County } from "../../api/directory";
import { expireSession } from "../auth/session";
import { DeliverableOverview } from "./DeliverableOverview";
import { campaignNote, countyLabel, dateLabel, statusLabel } from "./businessFormat";
import { businessSearch, BusinessSwitcher, useBusinessNames, useSelectedBusiness } from "./selectedBusiness";
import {
  AccountCheck,
  titleClass,
  textLinkClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "./workspaceSession";

type CampaignLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; campaigns: Campaign[]; counties: County[]; profile: Business | null };

type DeliverableLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; access: CampaignAccess[] };

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function CampaignStack({
  campaigns,
  counties,
}: {
  campaigns: Campaign[];
  counties: County[];
}) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 gap-4">
      {campaigns.map((campaign) => {
        const note = campaignNote(campaign);
        const draft = campaign.status === "draft";
        return (
          <CampaignCard
            key={campaign.campaign_id}
            title={campaign.name}
            description={campaign.description?.trim() || "No description was provided."}
            status={statusLabel(campaign.status)}
            location={countyLabel(campaign.county_ids, counties)}
            date={dateLabel(campaign)}
            note={note || undefined}
            actionLabel={draft ? "Edit draft" : undefined}
            onAction={draft ? () => navigate(`/campaigns/${campaign.campaign_id}/edit`) : undefined}
          />
        );
      })}
    </div>
  );
}

export default function BusinessDashboard() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ids = session?.role === "business" ? verifiedBusinessIds(session) : [];
  const businessKey = ids.join(",");
  const ready = accountState === "ready" && session?.role === "business";
  const { selected, choose } = useSelectedBusiness(session?.userId ?? null, ids, session?.businessId ?? null, ready);
  const names = useBusinessNames(ready ? ids : []);
  const [campaignLoad, setCampaignLoad] = useState<CampaignLoad>({ status: "idle" });
  const [campaignAttempt, setCampaignAttempt] = useState(0);
  const [deliverables, setDeliverables] = useState<DeliverableLoad>({ status: "idle" });
  const [deliverableAttempt, setDeliverableAttempt] = useState(0);

  useEffect(() => {
    const allowed = businessKey ? businessKey.split(",").map(Number) : [];
    if (!ready || !session || selected == null || !allowed.includes(selected)) {
      setCampaignLoad({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const businessId = selected;
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
            .filter((campaign) => campaign.business_id === businessId && allowed.includes(campaign.business_id))
            .sort((left, right) => left.campaign_id - right.campaign_id),
          counties,
          profile: profile && profile.business_id === businessId ? profile : null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setCampaignLoad({
          status: "error",
          message: error instanceof Error && error.message ? error.message : "Couldn't load this dashboard.",
        });
      });
    return () => controller.abort();
  }, [ready, session, selected, businessKey, campaignAttempt]);

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

  if (!session || session.role !== "business") {
    return (
      <WorkspaceAccess
        title="Business dashboard"
        role="business"
        session={session}
        from="/dashboard/business"
        signedOut="Sign in with a business account to see your business and campaigns."
      />
    );
  }

  const profile = campaignLoad.status === "ready" ? campaignLoad.profile : null;
  const knownName = profile?.name?.trim() || (selected != null ? names.get(selected) : undefined);
  const campaigns = campaignLoad.status === "ready" ? campaignLoad.campaigns : [];
  const openCount = campaignLoad.status === "ready"
    ? campaigns.filter((campaign) => campaign.status === "open").length
    : null;
  const scopedDeliverables = deliverables.status === "ready" && selected != null
    ? deliverables.access.filter((entry) => entry.campaign.business_id === selected)
    : null;
  const submittedCount = scopedDeliverables ? deliverableStatusCounts(scopedDeliverables).submitted : null;
  const query = businessSearch(selected);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-5">
        <div>
          <h1 className={titleClass}>
            {ready && knownName ? `Welcome, ${knownName}` : "Welcome"}
          </h1>
          {profile?.description?.trim() && (
            <p className="mt-2 text-base text-[var(--cg-muted)]">{profile.description.trim()}</p>
          )}
        </div>
        {ready && (
          <BusinessSwitcher ids={ids} names={names} selected={selected} onChange={choose} />
        )}
      </div>

      <AccountCheck state={accountState} message={accountError} onRetry={retry} />

      {ready && ids.length === 0 && (
        <AppNotice
          tone="info"
          message="This account is not linked to a business, so there are no campaigns to show."
        />
      )}

      {ready && ids.length > 0 && (
        <>
          <section aria-label="Overview">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardStatCard
                label="Open campaigns"
                value={openCount ?? "-"}
                icon={<Megaphone size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Your campaigns"
                value={campaignLoad.status === "ready" ? campaigns.length : "-"}
                icon={<List size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Submitted deliverables"
                value={submittedCount ?? "-"}
                icon={<ClipboardList size={20} aria-hidden="true" />}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--cg-primary-dark)]">My Campaigns</h2>
              <Link to={`/dashboard/business/campaigns${query}`} className={textLinkClass}>
                View campaigns
              </Link>
            </div>
            {campaignLoad.status === "loading" && (
              <div className="grid gap-4" aria-busy="true" aria-label="Loading campaigns">
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
            {campaignLoad.status === "ready" && campaigns.length === 0 && (
              <DashboardEmptyState message="No campaigns were returned for this business." />
            )}
            {campaignLoad.status === "ready" && campaigns.length > 0 && (
              <CampaignStack campaigns={campaigns.slice(0, 3)} counties={campaignLoad.counties} />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-[var(--cg-primary-dark)]">Collaborations</h2>
            <DeliverableOverview
              status={
                deliverables.status === "ready" && selected != null
                  ? "ready"
                  : deliverables.status === "error"
                    ? "error"
                    : "loading"
              }
              access={scopedDeliverables ?? []}
              message={deliverables.status === "error" ? deliverables.message : ""}
              onRetry={() => setDeliverableAttempt((value) => value + 1)}
              emptyMessage="No deliverables were returned for this business."
              actionHref={`/dashboard/business/review${query}`}
              actionLabel="Review deliverables"
              limit={3}
            />
          </section>
        </>
      )}
    </div>
  );
}
