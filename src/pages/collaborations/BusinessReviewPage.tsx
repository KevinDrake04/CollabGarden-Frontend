import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  AppButton,
  AppNotice,
  DeliverableReview,
  deliverableStatusLabel,
  EmptyState,
  LoadingSkeleton,
  reviewBlockReason,
  toDeliverableSummary,
} from "../../components";
import {
  approveDeliverable,
  collaborationErrorMessage,
  isAbortError,
  loadCollaborationWorkspace,
  requestRevision,
  upsertDeliverable,
  type CollaborationWorkspace,
  type Deliverable,
} from "./api";

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; workspace: CollaborationWorkspace };

type Feedback = { tone: "success" | "error"; message: string };
type Pending = { id: number; action: "approve" | "revision" };

const pageClass = "mx-auto flex w-full max-w-3xl flex-col gap-6 text-[var(--cg-text)]";

function businessReviewBlock(role: CollaborationWorkspace["session"]["role"], status: string) {
  if (role === "creator") return "Review actions are available to business accounts.";
  return reviewBlockReason(status);
}

export default function BusinessReviewPage() {
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setView({ kind: "loading" });
    loadCollaborationWorkspace(controller.signal)
      .then((result) => {
        if (result.kind === "signed-out") setView(result);
        else setView({ kind: "ready", workspace: result.workspace });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setView({ kind: "error", message: collaborationErrorMessage(error) });
      });
    return () => controller.abort();
  }, [retry]);

  function reload() {
    setRetry((value) => value + 1);
  }

  return (
    <div className={pageClass}>
      <div>
        <p className="eyebrow">Development</p>
        <h1>Business review</h1>
        <p>Review submitted deliverables for campaigns this account can read.</p>
        <Link
          to="/dev/collaborations/creator"
          className="text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          Creator deliverables
        </Link>
      </div>

      {view.kind === "loading" && (
        <div aria-live="polite" className="flex flex-col gap-3">
          <p className="text-sm">Loading deliverables.</p>
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      )}

      {view.kind === "signed-out" && (
        <div className="flex flex-col items-start gap-3">
          <AppNotice tone="error" message={view.message} />
          <p className="text-sm">
            <Link
              to="/login"
              state={{ from: "/dev/collaborations/business" }}
              className="font-semibold text-[var(--cg-primary-dark)]"
            >
              Log in
            </Link>{" "}
            as a business to review submissions.
          </p>
          <AppButton variant="secondary" onPress={reload}>
            Try again
          </AppButton>
        </div>
      )}

      {view.kind === "error" && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <AppNotice tone="error" message={view.message} />
          <AppButton variant="secondary" onPress={reload}>
            Try again
          </AppButton>
        </div>
      )}

      {view.kind === "ready" && (
        <BusinessWorkspace
          workspace={view.workspace}
          onAccess={(update) =>
            setView((current) =>
              current.kind === "ready"
                ? {
                    kind: "ready",
                    workspace: { ...current.workspace, access: update(current.workspace.access) },
                  }
                : current,
            )
          }
          reload={reload}
        />
      )}
    </div>
  );
}

function BusinessWorkspace({
  workspace,
  onAccess,
  reload,
}: {
  workspace: CollaborationWorkspace;
  onAccess: (
    update: (access: CollaborationWorkspace["access"]) => CollaborationWorkspace["access"],
  ) => void;
  reload: () => void;
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = useRef(false);
  const available = workspace.access.filter((entry) => !entry.error);
  const denied = workspace.access.filter((entry) => entry.error);

  function showFeedback(next: Feedback) {
    setFeedback(next);
    requestAnimationFrame(() => {
      document.getElementById("collaboration-feedback")?.scrollIntoView({ block: "nearest" });
    });
  }

  function place(deliverable: Deliverable) {
    onAccess((access) => upsertDeliverable(access, deliverable));
  }

  async function review(deliverable: Deliverable, action: "approve" | "revision") {
    const blocked = businessReviewBlock(workspace.session.role, deliverable.status);
    const comment = comments[deliverable.deliverable_id] ?? "";
    if (busy.current || blocked) return;
    if (action === "revision" && !comment.trim()) return;

    busy.current = true;
    setPending({ id: deliverable.deliverable_id, action });
    setFeedback(null);
    try {
      const updated =
        action === "approve"
          ? await approveDeliverable(deliverable.deliverable_id, comment, workspace.session.accessToken)
          : await requestRevision(deliverable.deliverable_id, comment, workspace.session.accessToken);
      place(updated);
      setComments((current) => ({ ...current, [deliverable.deliverable_id]: "" }));
      showFeedback({
        tone: "success",
        message: `${action === "approve" ? "Approve" : "Revision request"} finished for "${updated.title}". Status is ${deliverableStatusLabel(updated.status)}.`,
      });
    } catch (error) {
      showFeedback({ tone: "error", message: collaborationErrorMessage(error) });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Signed in{workspace.session.email ? ` as ${workspace.session.email}` : ""}
          {workspace.session.role ? ` (${workspace.session.role})` : ""}.
        </p>
        <AppButton variant="secondary" isDisabled={pending !== null} onPress={reload}>
          Reload
        </AppButton>
      </div>

      <div id="collaboration-feedback" aria-live="polite">
        {feedback && (
          <AppNotice tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />
        )}
      </div>

      {denied.map((entry) => (
        <AppNotice
          key={entry.campaign.campaign_id}
          tone="error"
          message={`${entry.campaign.name}: ${entry.error}`}
        />
      ))}

      {available.length === 0 && (
        <EmptyState
          title="No campaigns to review"
          description={
            workspace.access.length === 0
              ? "This account did not receive any campaigns."
              : "Deliverables could not be read for the campaigns returned to this account."
          }
        />
      )}

      <ReviewGroup
        title="Awaiting review"
        empty="No submitted deliverables are waiting for review."
        status="submitted"
        workspace={workspace}
        comments={comments}
        pending={pending}
        onComment={(id, comment) => setComments((current) => ({ ...current, [id]: comment }))}
        onReview={review}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Review history</h2>
        <p className="text-sm">
          Approved and revision-requested deliverables stay in this list. The API does not return the revision comment, so the status and timestamps are the history this page can show.
        </p>
      </section>

      <ReviewGroup
        title="Revision requests"
        empty="No revision requests."
        status="revision_requested"
        workspace={workspace}
        comments={comments}
        pending={pending}
        onComment={(id, comment) => setComments((current) => ({ ...current, [id]: comment }))}
        onReview={review}
      />

      <ReviewGroup
        title="Approved"
        empty="No approved deliverables."
        status="approved"
        workspace={workspace}
        comments={comments}
        pending={pending}
        onComment={(id, comment) => setComments((current) => ({ ...current, [id]: comment }))}
        onReview={review}
      />

      <ReviewGroup
        title="Drafts"
        empty="No drafts. Drafts are not ready for review."
        status="draft"
        workspace={workspace}
        comments={comments}
        pending={pending}
        onComment={(id, comment) => setComments((current) => ({ ...current, [id]: comment }))}
        onReview={review}
      />
    </>
  );
}

function ReviewGroup({
  title,
  empty,
  status,
  workspace,
  comments,
  pending,
  onComment,
  onReview,
}: {
  title: string;
  empty: string;
  status: string;
  workspace: CollaborationWorkspace;
  comments: Record<number, string>;
  pending: Pending | null;
  onComment: (id: number, comment: string) => void;
  onReview: (deliverable: Deliverable, action: "approve" | "revision") => void;
}) {
  const rows = workspace.access.flatMap((entry) => {
    if (entry.error) return [];
    return entry.deliverables
      .filter((deliverable) => deliverable.status === status)
      .map((deliverable) => ({ deliverable, campaignName: entry.campaign.name }));
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm">{empty}</p>
      ) : (
        rows.map(({ deliverable, campaignName }) => (
          <DeliverableReview
            key={deliverable.deliverable_id}
            deliverable={toDeliverableSummary(
              deliverable,
              campaignName,
              workspace.creatorNames[deliverable.creator_id],
            )}
            comment={comments[deliverable.deliverable_id] ?? ""}
            onCommentChange={(comment) => onComment(deliverable.deliverable_id, comment)}
            onApprove={() => onReview(deliverable, "approve")}
            onRequestRevision={() => onReview(deliverable, "revision")}
            blockedReason={businessReviewBlock(workspace.session.role, deliverable.status)}
            pending={pending?.id === deliverable.deliverable_id ? pending.action : null}
            error=""
          />
        ))
      )}
    </section>
  );
}
