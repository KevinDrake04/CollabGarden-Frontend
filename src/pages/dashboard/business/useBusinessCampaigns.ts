import { useEffect, useState } from "react";
import { verifiedBusinessIds, type Session } from "../../../api/auth";
import { CampaignApiError, listCampaigns, type Campaign } from "../../../api/campaigns";
import { expireSession, isCurrentSession } from "../../auth/session";

type CampaignLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; campaigns: Campaign[] };

export function useBusinessCampaigns(session: Session | null) {
  const [result, setResult] = useState<{ session: Session; load: CampaignLoad } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!session) {
      setResult(null);
      return;
    }
    const ids = verifiedBusinessIds(session);
    if (ids.length === 0) {
      setResult({ session, load: { status: "ready", campaigns: [] } });
      return;
    }
    const controller = new AbortController();
    listCampaigns({ signal: controller.signal, token: session.accessToken, cache: "no-store" })
      .then((campaigns) => {
        if (controller.signal.aborted || !isCurrentSession(session)) return;
        const owned = campaigns
          .filter((campaign) => ids.includes(campaign.business_id))
          .sort((left, right) => left.campaign_id - right.campaign_id);
        setResult({ session, load: { status: "ready", campaigns: owned } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !isCurrentSession(session)) return;
        if (error instanceof CampaignApiError && error.status === 401) {
          expireSession(session);
          return;
        }
        const message = error instanceof Error ? error.message : "Couldn't load campaigns.";
        setResult({ session, load: { status: "error", message } });
      });
    return () => controller.abort();
  }, [session, attempt]);

  const load: CampaignLoad = result?.session === session ? result.load : { status: "loading" };
  return {
    load,
    retry: () => {
      setResult(null);
      setAttempt((value) => value + 1);
    },
  };
}
