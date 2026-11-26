import { useEffect, useState, type FormEvent } from "react";
import {
  applicationMessageLimit,
  applyToCampaign,
  CampaignApiError,
  listMyApplications,
  shouldRecheckApplication,
  type CampaignApplication,
} from "../../api/campaigns";
import { AppButton, AppNotice, AppTextarea, DashboardEmptyState } from "../../components";
import { expireSession } from "../auth/session";
import { ApplicationStatusChip } from "./ApplicationStatus";

type ApplicationLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: CampaignApplication[] };

export function useCreatorApplications(token: string | null) {
  const [load, setLoad] = useState<ApplicationLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoad({ status: "loading" });
    listMyApplications(token, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setLoad({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof CampaignApiError && error.status === 401) {
          expireSession();
          return;
        }
        setLoad({
          status: "error",
          message: error instanceof CampaignApiError ? error.message : "Couldn't load your applications.",
        });
      });
    return () => controller.abort();
  }, [token, attempt]);

  function record(application: CampaignApplication) {
    setLoad((current) => current.status === "ready" ? {
      status: "ready",
      items: [application, ...current.items.filter((item) => item.application_id !== application.application_id)],
    } : current);
  }

  return { load, record, retry: () => setAttempt((current) => current + 1) };
}

export function CreatorApplicationFeedback({ applications }: {
  applications: ReturnType<typeof useCreatorApplications>;
}) {
  if (applications.load.status === "ready") return null;
  if (applications.load.status === "loading") {
    return <p role="status" className="text-sm text-[var(--cg-muted)]">Loading your applications...</p>;
  }
  return (
    <div className="space-y-3">
      <AppNotice tone="error" message={applications.load.message} />
      <AppButton variant="secondary" onPress={applications.retry}>Retry applications</AppButton>
    </div>
  );
}

export function CreatorApplicationAction({ campaignId, token, application, onRecord }: {
  campaignId: number;
  token: string;
  application?: CampaignApplication;
  onRecord: (application: CampaignApplication) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<{ phase: "idle" | "submitting" | "checking" | "needs-check"; error?: string }>({ phase: "idle" });
  const working = form.phase === "submitting" || form.phase === "checking";
  const needsStatusCheck = form.phase === "needs-check";
  const trimmedMessage = message.trim();
  const messageError = Array.from(trimmedMessage).length > applicationMessageLimit
    ? `Use ${applicationMessageLimit.toLocaleString("en-US")} characters or fewer.`
    : undefined;

  async function checkStatus(error?: string) {
    setForm({ phase: "checking", error });
    try {
      const items = await listMyApplications(token);
      const existing = items.find((item) => item.campaign_id === campaignId);
      if (existing) onRecord(existing);
      setForm({ phase: "idle", error });
    } catch (failure) {
      if (failure instanceof CampaignApiError && failure.status === 401) {
        expireSession();
        return;
      }
      setForm({ phase: "needs-check", error });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.phase !== "idle" || application || messageError) return;
    setForm({ phase: "submitting" });
    try {
      onRecord(await applyToCampaign(campaignId, trimmedMessage, token));
      setForm({ phase: "idle" });
    } catch (failure) {
      if (failure instanceof CampaignApiError && failure.status === 401) {
        expireSession();
        return;
      }
      const error = failure instanceof CampaignApiError ? failure.message : "Couldn't submit your application.";
      // A duplicate or an uncertain response can mean an application already exists.
      if (shouldRecheckApplication(failure)) {
        await checkStatus(error);
      } else {
        setForm({ phase: "idle", error });
      }
    }
  }

  if (application) {
    return <div aria-live="polite"><ApplicationStatusChip status={application.status} showContext /></div>;
  }

  if (!expanded) {
    return <AppButton className="self-start" variant="secondary" onPress={() => setExpanded(true)}>Apply</AppButton>;
  }

  return (
    <form className="min-w-0 space-y-3 border-t border-[var(--cg-border)] pt-3" onSubmit={submit}>
      <AppTextarea
        label="Application message (optional)"
        value={message}
        onChange={setMessage}
        helper="Up to 1,000 characters."
        error={messageError}
        disabled={working || needsStatusCheck}
        rows={3}
      />
      {form.error && <AppNotice tone="error" message={form.error} />}
      {needsStatusCheck && <p role="status" className="text-sm">Check your application status before submitting again.</p>}
      <div className="flex flex-wrap gap-2">
        {needsStatusCheck || form.phase === "checking" ? (
          <AppButton isDisabled={working} onPress={() => void checkStatus(form.error)}>
            {form.phase === "checking" ? "Checking..." : "Check application status"}
          </AppButton>
        ) : (
          <AppButton type="submit" isDisabled={working || Boolean(messageError)}>
            {working ? "Submitting..." : "Submit application"}
          </AppButton>
        )}
        <AppButton variant="secondary" isDisabled={working || needsStatusCheck} onPress={() => setExpanded(false)}>
          Cancel
        </AppButton>
      </div>
    </form>
  );
}

export function CreatorApplicationHistory({ items, visibleCampaignIds, limit }: {
  items: CampaignApplication[];
  visibleCampaignIds: number[];
  limit?: number;
}) {
  const remaining = items.filter((item) => !visibleCampaignIds.includes(item.campaign_id)).slice(0, limit);
  if (limit !== undefined && remaining.length === 0) return null;

  return (
    <section aria-label="My applications" className="space-y-3">
      <h2 className="text-xl font-semibold text-[var(--cg-primary-dark)]">My applications</h2>
      {items.length === 0 ? <DashboardEmptyState message="You haven't applied to any campaigns yet." /> : (
        <>
          {remaining.length === 0 && <p className="text-sm text-[var(--cg-muted)]">Your applications are shown on the campaigns above.</p>}
          {remaining.length > 0 && (
            <ul className="space-y-2">
              {remaining.map((item) => (
                <li key={item.application_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--cg-border)] bg-white p-4">
                  <strong className="min-w-0 break-words">{item.campaign?.name || `Campaign ${item.campaign_id}`}</strong>
                  <ApplicationStatusChip status={item.status} showContext />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
