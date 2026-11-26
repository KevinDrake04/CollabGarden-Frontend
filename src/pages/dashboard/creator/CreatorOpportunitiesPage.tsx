import { useEffect, useState } from "react";
import { AppButton, AppNotice, DashboardEmptyState, LoadingSkeleton, OpportunityCard } from "../../../components";
import { getBusinesses, listOpenCampaigns, type BusinessSummary, type Campaign } from "../../../api/campaigns";
import { getCounties, type County } from "../../../api/directory";
import {
  CreatorApplicationAction,
  CreatorApplicationFeedback,
  CreatorApplicationHistory,
  useCreatorApplications,
} from "../../campaigns/CreatorApplications";
import { countyLabel, dateLabel } from "../shared/campaignLabels";
import {
  AccountCheck,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "../shared/workspaceSession";

const offerLabels = {
  gifted: "Gifted",
  dining: "Dining",
  paid: "Paid",
} as const;

type OpportunityLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; campaigns: Campaign[]; businesses: BusinessSummary[]; counties: County[] };

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function OpportunityList({
  campaigns,
  businesses,
  counties,
  token,
  applications,
}: {
  campaigns: Campaign[];
  businesses: BusinessSummary[];
  counties: County[];
  token: string;
  applications: ReturnType<typeof useCreatorApplications>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {campaigns.map((campaign) => {
        const business = businesses.find((item) => item.business_id === campaign.business_id);
        const offer = campaign.offer_type ? offerLabels[campaign.offer_type] : "Open";
        return (
          <OpportunityCard
            key={campaign.campaign_id}
            businessName={business?.name || `Business ${campaign.business_id}`}
            title={campaign.name}
            description={campaign.description?.trim() || "No description was provided."}
            location={`${countyLabel(campaign.county_ids, counties)} · ${dateLabel(campaign)}`}
            category={offer}
          >
            {applications.load.status === "ready" && (
              <CreatorApplicationAction
                key={token}
                campaignId={campaign.campaign_id}
                token={token}
                application={applications.load.items.find((item) => item.campaign_id === campaign.campaign_id)}
                onRecord={applications.record}
              />
            )}
          </OpportunityCard>
        );
      })}
    </div>
  );
}

export default function CreatorOpportunitiesPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ready = accountState === "ready" && session?.role === "creator";
  const applications = useCreatorApplications(ready ? session.accessToken : null);
  const [opportunities, setOpportunities] = useState<OpportunityLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
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
          campaigns,
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
  }, [ready, attempt]);

  if (!session || session.role !== "creator") {
    return (
      <WorkspaceAccess
        title="Opportunities"
        role="creator"
        session={session}
        from="/dashboard/creator/opportunities"
        signedOut="Sign in with a creator account to see open campaigns."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-2xl">
        <h1 className={titleClass}>Opportunities</h1>
        <p className="mt-2 text-base text-[var(--cg-muted)]">
          Apply to open campaigns from local businesses and check your application status.
        </p>
      </div>

      <AccountCheck state={accountState} message={accountError} onRetry={retry} />

      {ready && <CreatorApplicationFeedback applications={applications} />}

      {ready && opportunities.status === "loading" && (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading open campaigns">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
      )}
      {ready && opportunities.status === "error" && (
        <div className="space-y-3">
          <AppNotice tone="error" message={opportunities.message} />
          <AppButton variant="secondary" onPress={() => setAttempt((value) => value + 1)}>
            Try again
          </AppButton>
        </div>
      )}
      {ready && opportunities.status === "ready" && opportunities.campaigns.length === 0 && (
        <DashboardEmptyState message="No open campaigns were returned." />
      )}
      {ready && opportunities.status === "ready" && opportunities.campaigns.length > 0 && (
        <OpportunityList
          campaigns={opportunities.campaigns}
          businesses={opportunities.businesses}
          counties={opportunities.counties}
          token={session.accessToken}
          applications={applications}
        />
      )}
      {ready && applications.load.status === "ready" && (
        <CreatorApplicationHistory
          items={applications.load.items}
          visibleCampaignIds={opportunities.status === "ready" ? opportunities.campaigns.map((item) => item.campaign_id) : []}
        />
      )}
    </div>
  );
}
