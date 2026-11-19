import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppButton, AppNotice, DashboardEmptyState, LoadingSkeleton } from "../../components";
import { verifiedBusinessIds } from "../../api/auth";
import { listCampaigns, type Campaign } from "../../api/campaigns";
import { getCounties, type County } from "../../api/directory";
import { CampaignStack } from "./BusinessDashboard";
import { BusinessSwitcher, useBusinessNames, useSelectedBusiness } from "./selectedBusiness";
import {
  AccountCheck,
  linkClass,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "./workspaceSession";

type CampaignLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; campaigns: Campaign[]; counties: County[] };

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export default function BusinessCampaignsPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ids = session?.role === "business" ? verifiedBusinessIds(session) : [];
  const businessKey = ids.join(",");
  const ready = accountState === "ready" && session?.role === "business";
  const { selected, choose } = useSelectedBusiness(session?.userId ?? null, ids, session?.businessId ?? null, ready);
  const names = useBusinessNames(ready ? ids : []);
  const [campaignLoad, setCampaignLoad] = useState<CampaignLoad>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);

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
    ])
      .then(([campaigns, counties]) => {
        if (controller.signal.aborted) return;
        setCampaignLoad({
          status: "ready",
          campaigns: campaigns
            .filter((campaign) => campaign.business_id === businessId && allowed.includes(campaign.business_id))
            .sort((left, right) => left.campaign_id - right.campaign_id),
          counties,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setCampaignLoad({
          status: "error",
          message: error instanceof Error && error.message ? error.message : "Couldn't load campaigns.",
        });
      });
    return () => controller.abort();
  }, [ready, session, selected, businessKey, attempt]);

  if (!session || session.role !== "business") {
    return (
      <WorkspaceAccess
        title="My Campaigns"
        role="business"
        session={session}
        from="/dashboard/business/campaigns"
        signedOut="Sign in with a business account to see your campaigns."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className={titleClass}>My Campaigns</h1>
          <Link to="/campaigns/new" className={linkClass}>Create campaign</Link>
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

      {ready && ids.length > 0 && campaignLoad.status === "loading" && (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading campaigns">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
      )}
      {ready && campaignLoad.status === "error" && (
        <div className="space-y-3">
          <AppNotice tone="error" message={campaignLoad.message} />
          <AppButton variant="secondary" onPress={() => setAttempt((value) => value + 1)}>
            Try again
          </AppButton>
        </div>
      )}
      {ready && campaignLoad.status === "ready" && campaignLoad.campaigns.length === 0 && (
        <DashboardEmptyState message="No campaigns were returned for this business." />
      )}
      {ready && campaignLoad.status === "ready" && campaignLoad.campaigns.length > 0 && (
        <CampaignStack campaigns={campaignLoad.campaigns} counties={campaignLoad.counties} />
      )}
    </div>
  );
}
