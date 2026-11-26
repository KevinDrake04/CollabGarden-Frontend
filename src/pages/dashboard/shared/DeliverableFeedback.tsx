import { useState } from "react";
import { AppButton, AppNotice } from "../../../components";
import {
  collaborationErrorMessage,
  listDeliverableFeedback,
  type Deliverable,
  type DeliverableFeedback as Feedback,
} from "../../../api/collaborations";
import { clearSessionIfUnauthorized } from "./useRoleWorkspace";

type History =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: Feedback[] };

function FeedbackEntry({ entry }: { entry: Feedback }) {
  const revision = entry.feedback_type === "revision_request";
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">
        {revision ? "Revision requested" : "Approved"}
        {revision && entry.resolved_at && " (resolved)"}
      </p>
      {entry.created_at && (
        <time dateTime={entry.created_at} className="text-xs text-[var(--cg-muted)]">
          {new Date(entry.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </time>
      )}
      <p className="whitespace-pre-wrap break-words">{entry.comment || "No comment."}</p>
    </div>
  );
}

export function DeliverableFeedback({ deliverable, token }: { deliverable: Deliverable; token: string }) {
  const [history, setHistory] = useState<History | null>(null);

  async function loadHistory() {
    setHistory({ status: "loading" });
    try {
      const entries = await listDeliverableFeedback(deliverable.deliverable_id, token);
      setHistory({ status: "ready", entries });
    } catch (error) {
      if (clearSessionIfUnauthorized(error)) return;
      setHistory({ status: "error", message: collaborationErrorMessage(error) });
    }
  }

  return (
    <div className="group flex flex-col gap-2 border-t border-[var(--cg-border)] pt-3">
      {deliverable.latest_feedback && (
        <div className={history?.status === "ready" ? "group-has-[details[open]]:hidden" : undefined}>
          <h4 className="mb-1 text-sm font-semibold">Latest feedback</h4>
          <FeedbackEntry entry={deliverable.latest_feedback} />
        </div>
      )}
      <details onToggle={(event) => {
        if (event.currentTarget.open && !history) void loadHistory();
      }}>
        <summary className="w-fit cursor-pointer text-sm font-medium text-[var(--cg-primary-dark)]">
          Feedback history
        </summary>
        <div className="mt-2 flex flex-col items-start gap-2" aria-live="polite">
          {history?.status === "loading" && <p className="text-sm">Loading feedback...</p>}
          {history?.status === "error" && (
            <>
              <AppNotice tone="error" message={history.message} />
              <AppButton variant="secondary" onPress={loadHistory}>Retry feedback</AppButton>
            </>
          )}
          {history?.status === "ready" && (
            history.entries.length === 0 ? <p className="text-sm">No feedback yet.</p> : (
              <ul className="flex w-full flex-col gap-3">
                {history.entries.map((entry) => (
                  <li key={entry.feedback_id} className="rounded-lg bg-[var(--cg-surface)] p-3">
                    <FeedbackEntry entry={entry} />
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </details>
    </div>
  );
}
