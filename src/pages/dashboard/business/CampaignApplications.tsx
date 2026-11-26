import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  CampaignApiError,
  decideApplication,
  listCampaignApplications,
  listCampaignCreators,
  shouldRecheckApplication,
  type CampaignApplication,
  type CampaignCreator,
} from "../../../api/campaigns";
import { AppAvatar, AppButton, AppNotice, LoadingSkeleton } from "../../../components";
import { expireSession } from "../../auth/session";
import { ApplicationStatusChip } from "../../campaigns/ApplicationStatus";
import { textLinkClass } from "../shared/workspaceSession";

type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: T[] };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof CampaignApiError) {
    if (error.status === 401) expireSession();
    return error.message;
  }
  return fallback;
}

export function CampaignApplications({ campaignId, token }: { campaignId: number; token: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <details className="border-t border-[var(--cg-border)] pt-3" onToggle={(event) => {
      if (event.currentTarget.open) setOpened(true);
    }}>
      <summary className="w-fit cursor-pointer rounded-sm py-2 text-sm font-semibold text-[var(--cg-primary-dark)]">
        Applications and creators
      </summary>
      {opened && <CampaignApplicationPanel campaignId={campaignId} token={token} />}
    </details>
  );
}

function CampaignApplicationPanel({ campaignId, token }: { campaignId: number; token: string }) {
  const [applications, setApplications] = useState<Load<CampaignApplication>>({ status: "loading" });
  const [creators, setCreators] = useState<Load<CampaignCreator>>({ status: "loading" });
  const [applicationAttempt, setApplicationAttempt] = useState(0);
  const [creatorAttempt, setCreatorAttempt] = useState(0);
  const [saving, setSaving] = useState<{ id: number; decision: "accept" | "reject" } | null>(null);
  const [decisionError, setDecisionError] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setApplications({ status: "loading" });
    listCampaignApplications(campaignId, token, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setApplications({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setApplications({ status: "error", message: getErrorMessage(error, "Couldn't load applications.") });
      });
    return () => controller.abort();
  }, [campaignId, token, applicationAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setCreators({ status: "loading" });
    listCampaignCreators(campaignId, token, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setCreators({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCreators({ status: "error", message: getErrorMessage(error, "Couldn't load assigned creators.") });
      });
    return () => controller.abort();
  }, [campaignId, token, creatorAttempt]);

  async function decide(application: CampaignApplication, decision: "accept" | "reject") {
    if (saving || applications.status !== "ready" || application.status !== "pending") return;
    const id = application.application_id;
    setSaving({ id, decision });
    setDecisionError(null);
    try {
      const updated = await decideApplication(application, decision, token);
      setApplications({
        status: "ready",
        items: applications.items.map((item) => item.application_id === id
          ? { ...updated, creator: updated.creator ?? item.creator, message: updated.message ?? item.message }
          : item),
      });
      if (updated.status === "accepted") setCreatorAttempt((current) => current + 1);
    } catch (error) {
      setDecisionError({ id, message: getErrorMessage(error, "Couldn't update the application.") });
      if (shouldRecheckApplication(error)) {
        // Read back the decision before allowing another write after an uncertain response.
        try {
          const items = await listCampaignApplications(campaignId, token);
          setApplications({ status: "ready", items });
          if (items.find((item) => item.application_id === id)?.status === "accepted") {
            setCreatorAttempt((current) => current + 1);
          }
        } catch (reloadError) {
          setApplications({ status: "error", message: getErrorMessage(reloadError, "Couldn't verify the application status.") });
        }
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-3 grid gap-5">
      <section className="space-y-2" aria-label="Campaign applications">
        <h3 className="font-semibold text-[var(--cg-primary-dark)]">Applications</h3>
        {applications.status === "loading" && <div aria-label="Loading applications"><LoadingSkeleton lines={2} /></div>}
        {applications.status === "error" && (
          <>
            <AppNotice tone="error" message={applications.message} />
            <AppButton variant="secondary" onPress={() => {
              if (decisionError) setCreatorAttempt((current) => current + 1);
              setDecisionError(null);
              setApplicationAttempt((current) => current + 1);
            }}>Retry applications</AppButton>
          </>
        )}
        {applications.status === "ready" && (
          applications.items.length === 0 ? <p className="text-sm text-[var(--cg-muted)]">No applications yet.</p> : (
            <ul className="space-y-2">
              {applications.items.map((application) => {
                const name = application.creator?.display_name || `Creator ${application.creator_id}`;
                return (
                  <li key={application.application_id} className="space-y-3 rounded-xl border border-[var(--cg-border)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/creators/${application.creator_id}`} className={`min-w-0 break-words ${textLinkClass}`}>
                        {name}
                      </Link>
                      <div aria-live="polite"><ApplicationStatusChip status={application.status} /></div>
                    </div>
                    {application.message && <p className="whitespace-pre-wrap break-words text-sm">{application.message}</p>}
                    {decisionError?.id === application.application_id && application.status === "pending" && (
                      <AppNotice tone="error" message={decisionError.message} />
                    )}
                    {application.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <AppButton isDisabled={saving !== null} onPress={() => void decide(application, "accept")}>
                          {saving?.id === application.application_id && saving.decision === "accept" ? "Accepting..." : "Accept"}
                        </AppButton>
                        <AppButton variant="secondary" isDisabled={saving !== null} onPress={() => void decide(application, "reject")}>
                          {saving?.id === application.application_id && saving.decision === "reject" ? "Rejecting..." : "Reject"}
                        </AppButton>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        )}
      </section>

      <section className="space-y-2" aria-label="Assigned creators">
        <h3 className="font-semibold text-[var(--cg-primary-dark)]">Assigned creators</h3>
        {creators.status === "loading" && <div aria-label="Loading assigned creators"><LoadingSkeleton lines={2} /></div>}
        {creators.status === "error" && (
          <>
            <AppNotice tone="error" message={creators.message} />
            <AppButton variant="secondary" onPress={() => setCreatorAttempt((current) => current + 1)}>
              Retry assigned creators
            </AppButton>
          </>
        )}
        {creators.status === "ready" && (
          creators.items.length === 0 ? <p className="text-sm text-[var(--cg-muted)]">No assigned creators yet.</p> : (
            <ul className="space-y-2" aria-live="polite">
              {creators.items.map((creator) => (
                <li key={creator.creator_id} className="flex items-center gap-3">
                  <AppAvatar name={creator.display_name} imageUrl={creator.photo_url ?? undefined} size="sm" />
                  <Link to={`/creators/${creator.creator_id}`} className={`min-w-0 break-words ${textLinkClass}`}>
                    {creator.display_name}
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  );
}
