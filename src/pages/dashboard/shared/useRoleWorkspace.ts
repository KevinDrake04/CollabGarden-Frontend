import { useEffect, useState } from "react";
import { verifiedBusinessIds, type AccountRole, type Session } from "../../../api/auth";
import { CampaignApiError } from "../../../api/campaigns";
import {
  CollaborationApiError,
  collaborationErrorMessage,
  listCreatorNames,
  loadCampaignDeliverables,
  loadCreatorCampaignDeliverables,
  type CollaborationWorkspace,
} from "../../../api/collaborations";
import { expireSession, isCurrentSession, readSessionExpired } from "../../auth/session";
import { useBusinessCampaigns } from "../business/useBusinessCampaigns";
import { useSelectedBusiness } from "./selectedBusiness";
import { useWorkspaceSession } from "./workspaceSession";

type RoleWorkspaceView =
  | { kind: "checking" }
  | { kind: "signed-out"; expired: boolean }
  | { kind: "wrong-role"; role: AccountRole }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; workspace: CollaborationWorkspace };

export function clearSessionIfUnauthorized(error: unknown, session: Session) {
  if (!(error instanceof CollaborationApiError || error instanceof CampaignApiError) || error.status !== 401) {
    return false;
  }
  expireSession(session);
  return true;
}

type WorkspaceLoad = { kind: "error"; message: string } | { kind: "ready"; access: CollaborationWorkspace["access"] };

export function useRoleWorkspace(expectedRole: "creator" | "business") {
  const account = useWorkspaceSession();
  const session = account.session;
  const active = account.accountState === "ready" && session?.role === expectedRole ? session : null;
  const business = active?.role === "business" ? active : null;
  const ids = business ? verifiedBusinessIds(business) : [];
  const { selected, choose } = useSelectedBusiness(business?.userId ?? null, ids, business?.businessId ?? null, !!business);
  const { load: campaignLoad, retry: retryCampaigns } = useBusinessCampaigns(business);
  const campaigns = campaignLoad.status === "ready" ? campaignLoad.campaigns : null;
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ session: Session; businessId: number | null; load: WorkspaceLoad } | null>(null);
  const [names, setNames] = useState<{ session: Session; items: CollaborationWorkspace["creatorNames"] } | null>(null);
  const load = result?.session === active && result.businessId === selected ? result.load : null;
  const hasBusiness = selected != null;

  useEffect(() => {
    if (!active || (active.role === "business" && !hasBusiness)) return;
    const controller = new AbortController();
    listCreatorNames(controller.signal).then((items) => {
      if (!controller.signal.aborted && isCurrentSession(active)) setNames({ session: active, items });
    }).catch(() => {});
    return () => controller.abort();
  }, [active, hasBusiness]);

  useEffect(() => {
    if (!active || (active.role === "business" && (!campaigns || selected == null))) return;
    const controller = new AbortController();
    const request = campaigns && active.role === "business"
      ? loadCampaignDeliverables(campaigns.filter((campaign) => campaign.business_id === selected), active, controller.signal)
      : loadCreatorCampaignDeliverables(active, controller.signal);

    request.then((access) => {
      if (controller.signal.aborted || !isCurrentSession(active)) return;
      setResult({ session: active, businessId: selected, load: { kind: "ready", access } });
    }).catch((error: unknown) => {
      if (controller.signal.aborted || !isCurrentSession(active) || clearSessionIfUnauthorized(error, active)) return;
      setResult({
        session: active, businessId: selected, load: { kind: "error", message: collaborationErrorMessage(error) },
      });
    });
    return () => controller.abort();
  }, [active, campaigns, selected, retry]);

  function updateAccess(
    update: (access: CollaborationWorkspace["access"]) => CollaborationWorkspace["access"],
  ) {
    if (!active || !isCurrentSession(active)) return;
    setResult((current) => current?.session === active && current.businessId === selected && current.load.kind === "ready"
      ? { ...current, load: { kind: "ready", access: update(current.load.access) } }
      : current);
  }

  function reload() {
    setResult(null);
    if (account.accountState === "error") account.retry();
    else if (business) retryCampaigns();
    else setRetry((value) => value + 1);
  }

  let view: RoleWorkspaceView;
  if (!session) view = { kind: "signed-out", expired: readSessionExpired() };
  else if (account.accountState === "pending") view = { kind: "checking" };
  else if (account.accountState === "error") view = { kind: "error", message: account.accountError };
  else if (!active) view = { kind: "wrong-role", role: session.role };
  else if (business && campaignLoad.status === "error") view = { kind: "error", message: campaignLoad.message };
  else if (load?.kind === "error") view = load;
  else if (load?.kind === "ready" || (business && !hasBusiness)) {
    view = {
      kind: "ready",
      workspace: { session, access: load?.access ?? [], creatorNames: names?.session === session ? names.items : {} },
    };
  } else view = { kind: "loading" };

  return { view, reload, updateAccess, active, ids, selected, choose, account: account.account };
}
