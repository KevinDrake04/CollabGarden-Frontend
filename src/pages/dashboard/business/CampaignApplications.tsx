import { useCallback, useEffect, useRef, useState } from "react";
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
import { expireSession, isCurrentSession, type Session } from "../../auth/session";
import { ApplicationStatusChip } from "../../campaigns/ApplicationStatus";
import { textLinkClass } from "../shared/workspaceSession";

type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: T[] };

function getErrorMessage(error: unknown, fallback: string, session: Session) {
  if (error instanceof CampaignApiError) {
    if (error.status === 401) expireSession(session);
    return error.message;
  }
  return fallback;
}

export function CampaignApplications({ campaignId, session }: { campaignId: number; session: Session }) {
  const [opened, setOpened] = useState(false);

  return (
    <details className="border-t border-[var(--cg-border)] pt-3" onToggle={(event) => {
      if (event.currentTarget.open) setOpened(true);
    }}>
      <summary className="w-fit cursor-pointer rounded-sm py-2 text-sm font-semibold text-[var(--cg-primary-dark)]">
        Applications and creators
      </summary>
      {opened && <CampaignApplicationPanel campaignId={campaignId} session={session} />}
    </details>
  );
}

function CampaignApplicationPanel({ campaignId, session }: { campaignId: number; session: Session }) {
  const [applications, setApplications] = useState<Load<CampaignApplication>>({ status: "loading" });
  const [creators, setCreators] = useState<Load<CampaignCreator>>({ status: "loading" });
  const [applicationAttempt, setApplicationAttempt] = useState(0);
  const [creatorAttempt, setCreatorAttempt] = useState(0);
  const [saving, setSaving] = useState<{ id: number; decision: "accept" | "reject" } | null>(null);
  const [decisionError, setDecisionError] = useState<{ id: number; message: string } | null>(null);
  const unconfirmed = useRef<{ id: number; message: string } | null>(null);
  const deciding = useRef(false);

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    try {
      const items = await listCampaignApplications(campaignId, session.accessToken, signal);
      if (signal?.aborted || !isCurrentSession(session)) return;
      const decision = unconfirmed.current;
      if (decision) {
        const updated = items.find((item) => item.application_id === decision.id);
        if (updated?.status === "accepted") setCreatorAttempt((current) => current + 1);
        setDecisionError(updated?.status === "pending" ? decision : null);
        unconfirmed.current = null;
      }
      setApplications({ status: "ready", items });
    } catch (error) {
      if (signal?.aborted || !isCurrentSession(session)) return;
      const fallback = unconfirmed.current ? "Couldn't verify the application status." : "Couldn't load applications.";
      setApplications({ status: "error", message: getErrorMessage(error, fallback, session) });
    }
  }, [campaignId, session]);

  useEffect(() => {
    const controller = new AbortController();
    void loadApplications(controller.signal);
    return () => controller.abort();
  }, [loadApplications, applicationAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setCreators({ status: "loading" });
    listCampaignCreators(campaignId, session.accessToken, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted && isCurrentSession(session)) setCreators({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !isCurrentSession(session)) return;
        setCreators({ status: "error", message: getErrorMessage(error, "Couldn't load assigned creators.", session) });
      });
    return () => controller.abort();
  }, [campaignId, session, creatorAttempt]);

  async function decide(application: CampaignApplication, decision: "accept" | "reject") {
    if (deciding.current || unconfirmed.current || applications.status !== "ready" ||
        application.status !== "pending" || !isCurrentSession(session)) return;
    deciding.current = true;
    const id = application.application_id;
    setSaving({ id, decision });
    setDecisionError(null);
    try {
      const updated = await decideApplication(application, decision, session.accessToken);
      if (!isCurrentSession(session)) return;
      setApplications({
        status: "ready",
        items: applications.items.map((item) => item.application_id === id
          ? { ...updated, creator: updated.creator ?? item.creator, message: updated.message ?? item.message }
          : item),
      });
      if (updated.status === "accepted") setCreatorAttempt((current) => current + 1);
    } catch (error) {
      if (!isCurrentSession(session)) return;
      const message = getErrorMessage(error, "Couldn't update the application.", session);
      if (shouldRecheckApplication(error)) {
        unconfirmed.current = { id, message };
        await loadApplications();
      } else {
        setDecisionError({ id, message });
      }
    } finally {
      deciding.current = false;
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
              setApplications({ status: "loading" });
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
