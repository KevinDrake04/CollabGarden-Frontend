import { useRef, useState } from "react";
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
} from "../../../components";
import { verifiedBusinessIds } from "../../../api/auth";
import { BusinessSwitcher, useBusinessNames } from "../shared/selectedBusiness";
import {
  approveDeliverable,
  collaborationErrorMessage,
  requestRevision,
  upsertDeliverable,
  type CollaborationWorkspace,
  type Deliverable,
} from "../../../api/collaborations";
import { dashboardPath, isCurrentSession } from "../../auth/session";
import { DeliverableFeedback } from "../shared/DeliverableFeedback";
import { clearSessionIfUnauthorized, useRoleWorkspace } from "../shared/useRoleWorkspace";
import { linkClass, signedInAs, textLinkClass, titleClass } from "../shared/workspaceSession";

type Feedback = { tone: "success" | "error"; message: string };
type Pending = { id: number; action: "approve" | "revision" };

const pageClass = "flex w-full flex-col gap-6 text-[var(--cg-text)]";
const headingClass = "text-xl font-semibold text-[var(--cg-primary-dark)]";

function LoadingBlock({ label }: { label: string }) {
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <p className="text-sm text-[var(--cg-muted)]">{label}</p>
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  );
}

export default function BusinessReviewPage() {
  const returnPath = "/dashboard/business/review";
  const { view, reload, updateAccess, active, ids, selected, choose } = useRoleWorkspace("business");
  const names = useBusinessNames(ids.length > 1 ? ids : []);

  return (
    <div className={pageClass}>
      <div className="max-w-2xl">
        <Link to="/dashboard/business" className={textLinkClass}>
          Overview
        </Link>
        <h1 className={`mt-3 ${titleClass}`}>
          Review deliverables
        </h1>
        <p className="mt-2 text-base text-[var(--cg-muted)]">
          Approve submitted deliverables or request a revision for this business.
        </p>
      </div>

      <BusinessSwitcher ids={ids} names={names} selected={selected} onChange={choose} />

      {(view.kind === "checking" || view.kind === "loading") && (
        <LoadingBlock label={view.kind === "checking" ? "Checking this account..." : "Loading deliverables."} />
      )}

      {view.kind === "signed-out" && view.expired && (
        <p className="text-sm text-[var(--cg-muted)]">Checking this account...</p>
      )}

      {view.kind === "signed-out" && !view.expired && (
        <div className="flex flex-col items-start gap-3">
          <AppNotice
            tone="info"
            message="Sign in with a business account to review deliverables."
          />
          <Link to="/login" state={{ from: returnPath }} className={linkClass}>
            Log in
          </Link>
        </div>
      )}

      {view.kind === "wrong-role" && (
        <div className="flex flex-col items-start gap-3">
          <AppNotice
            tone="info"
            message={`This page is for business accounts. You are signed in as ${signedInAs(view.role)} account.`}
          />
          <Link to={dashboardPath(view.role)} className={linkClass}>
            Go to your dashboard
          </Link>
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

      {active && (
        <BusinessWorkspace
          key={`${active.userId}:${active.accessToken}`}
          workspace={view.kind === "ready" ? view.workspace : null}
          onAccess={updateAccess}
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
  workspace: CollaborationWorkspace | null;
  onAccess: (
    update: (access: CollaborationWorkspace["access"]) => CollaborationWorkspace["access"],
  ) => void;
  reload: () => void;
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = useRef(false);
  if (!workspace) return null;
  const { session } = workspace;
  const available = workspace.access.filter((entry) => !entry.error);
  const denied = workspace.access.filter((entry) => entry.error);
  const unlinkedBusiness = verifiedBusinessIds(workspace.session).length === 0;

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
    const blocked = reviewBlockReason(deliverable.status);
    const comment = comments[deliverable.deliverable_id] ?? "";
    if (busy.current || blocked || !isCurrentSession(session)) return;
    if (action === "revision" && !comment.trim()) return;

    busy.current = true;
    setPending({ id: deliverable.deliverable_id, action });
    setFeedback(null);
    try {
      const updated =
        action === "approve"
          ? await approveDeliverable(deliverable.deliverable_id, comment, session.accessToken)
          : await requestRevision(deliverable.deliverable_id, comment, session.accessToken);
      if (!isCurrentSession(session)) return;
      place(updated);
      setComments((current) => ({ ...current, [deliverable.deliverable_id]: "" }));
      showFeedback({
        tone: "success",
        message: `${action === "approve" ? "Approved" : "Requested a revision for"} "${updated.title}". Status is ${deliverableStatusLabel(updated.status)}.`,
      });
    } catch (error) {
      if (!isCurrentSession(session) || clearSessionIfUnauthorized(error, session)) return;
      showFeedback({ tone: "error", message: collaborationErrorMessage(error) });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <AppButton variant="secondary" isDisabled={pending !== null} onPress={reload}>
          Reload
        </AppButton>
      </div>

      <div id="collaboration-feedback" aria-live="polite">
        {feedback && (
          <AppNotice tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />
        )}
      </div>

      {unlinkedBusiness ? (
        <AppNotice
          tone="info"
          message="This account is not linked to a business, so there are no campaigns to show."
        />
      ) : (
        <>
          {denied.map((entry) => (
            <AppNotice
              key={entry.campaign.campaign_id}
              tone="error"
              message={`${entry.campaign.name}: ${entry.error}`}
            />
          ))}

          {available.length === 0 && workspace.access.length === 0 && (
            <EmptyState
              title="No campaigns to review"
              description="No campaigns for this business included a deliverable list."
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
            <h2 className={headingClass}>Review history</h2>
            <p className="text-sm text-[var(--cg-muted)]">
              Approved and revision-requested deliverables stay in this list.
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
      )}
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
      <h2 className={headingClass}>
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--cg-muted)]">{empty}</p>
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
            blockedReason={reviewBlockReason(deliverable.status)}
            disabled={pending !== null}
            pending={pending?.id === deliverable.deliverable_id ? pending.action : null}
          >
            {status !== "draft" && (
              <DeliverableFeedback deliverable={deliverable} session={workspace.session} />
            )}
          </DeliverableReview>
        ))
      )}
    </section>
  );
}
