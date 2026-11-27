import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppButton, AppNotice, DashboardEmptyState, LoadingSkeleton } from "../../../components";
import { verifiedBusinessIds } from "../../../api/auth";
import { loadCounties, type County } from "../../../api/directory";
import { CampaignStack } from "./BusinessDashboard";
import { useBusinessCampaigns } from "./useBusinessCampaigns";
import { BusinessSwitcher, useBusinessNames, useSelectedBusiness } from "../shared/selectedBusiness";
import {
  AccountCheck,
  linkClass,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "../shared/workspaceSession";

export default function BusinessCampaignsPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ids = session?.role === "business" ? verifiedBusinessIds(session) : [];
  const ready = accountState === "ready" && session?.role === "business";
  const { selected, choose } = useSelectedBusiness(session?.userId ?? null, ids, session?.businessId ?? null, ready);
  const names = useBusinessNames(ready && ids.length > 1 ? ids : []);
  const { load: campaignLoad, retry: retryCampaigns } = useBusinessCampaigns(ready ? session : null);
  const [counties, setCounties] = useState<County[]>([]);
  const hasBusinesses = ids.length > 0;

  useEffect(() => {
    if (!ready || !hasBusinesses) return;
    const controller = new AbortController();
    loadCounties().then((items) => {
      if (!controller.signal.aborted) setCounties(items);
    }).catch(() => {});
    return () => controller.abort();
  }, [ready, hasBusinesses]);

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

  const campaigns = campaignLoad.status === "ready"
    ? campaignLoad.campaigns.filter((campaign) => campaign.business_id === selected)
    : [];

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
          <AppButton variant="secondary" onPress={retryCampaigns}>
            Try again
          </AppButton>
        </div>
      )}
      {ready && campaignLoad.status === "ready" && campaigns.length === 0 && (
        <DashboardEmptyState message="No campaigns were returned for this business." />
      )}
      {ready && campaignLoad.status === "ready" && campaigns.length > 0 && (
        <CampaignStack campaigns={campaigns} counties={counties} session={session} />
      )}
    </div>
  );
}
