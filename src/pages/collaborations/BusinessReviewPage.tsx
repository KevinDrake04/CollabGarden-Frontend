import { useRef, useState } from "react";
import { Link, useLocation } from "react-router";
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
import { verifiedBusinessIds } from "../../api/auth";
import {
  BusinessSwitcher,
  useBusinessNames,
  useSelectedBusiness,
} from "../dashboard/selectedBusiness";
import {
  approveDeliverable,
  collaborationErrorMessage,
  requestRevision,
  upsertDeliverable,
  type CollaborationWorkspace,
  type Deliverable,
} from "../../api/collaborations";
import { dashboardPath, type AccountRole } from "../auth/session";
import { clearSessionIfUnauthorized, useRoleWorkspace } from "./useRoleWorkspace";

type Feedback = { tone: "success" | "error"; message: string };
type Pending = { id: number; action: "approve" | "revision" };

const productionClass = "flex w-full flex-col gap-6 text-[var(--cg-text)]";
const developmentClass = "mx-auto flex w-full max-w-3xl flex-col gap-6 text-[var(--cg-text)]";
const linkClass =
  "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline hover:bg-[var(--cg-primary-dark)]";
const textLink = "text-sm font-semibold text-[var(--cg-primary-dark)] no-underline";
const headingClass = "text-xl font-semibold text-[var(--cg-primary-dark)]";

function businessReviewBlock(role: CollaborationWorkspace["session"]["role"], status: string) {
  if (role === "creator") return "Review actions are available to business accounts.";
  return reviewBlockReason(status);
}

function roleLabel(role: AccountRole) {
  if (role === "business") return "business";
  if (role === "creator") return "creator";
  return "administrator";
}

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
  const { pathname } = useLocation();
  const production = pathname.startsWith("/dashboard/");
  const returnPath = production ? "/dashboard/business/review" : "/dev/collaborations/business";
  const { view, workspace, reload, updateAccess } = useRoleWorkspace("business", production);

  return (
    <div className={production ? productionClass : developmentClass}>
      <div className="max-w-2xl">
        {production ? (
          <Link to="/dashboard/business" className={textLink}>
            Overview
          </Link>
        ) : (
          <p className="eyebrow">Development</p>
        )}
        <h1 className={production ? "mt-3 text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl" : undefined}>
          {production ? "Review deliverables" : "Business review"}
        </h1>
        <p className="mt-2 text-base text-[var(--cg-muted)]">
          Approve submitted deliverables or request a revision for this business.
        </p>
        {production ? null : (
          <Link to="/dev/collaborations/creator" className={`mt-2 inline-block ${textLink}`}>
            Creator deliverables
          </Link>
        )}
      </div>

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
            message={`This page is for business accounts. You are signed in as ${view.role === "admin" ? "an" : "a"} ${roleLabel(view.role)} account.`}
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

      {view.kind === "ready" && workspace && (
        production ? (
          <ScopedBusinessReview workspace={workspace} onAccess={updateAccess} reload={reload} />
        ) : (
          <BusinessWorkspace workspace={workspace} onAccess={updateAccess} reload={reload} />
        )
      )}
    </div>
  );
}

function ScopedBusinessReview({
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
  const ids = verifiedBusinessIds(workspace.session);
  const { selected, choose } = useSelectedBusiness(
    workspace.session.userId,
    ids,
    workspace.session.businessId,
    true,
  );
  const names = useBusinessNames(ids);
  const scoped = selected == null
    ? workspace
    : {
        ...workspace,
        access: workspace.access.filter((entry) => entry.campaign.business_id === selected),
      };

  return (
    <>
      <BusinessSwitcher ids={ids} names={names} selected={selected} onChange={choose} />
      <BusinessWorkspace workspace={scoped} onAccess={onAccess} reload={reload} showSessionLine={false} />
    </>
  );
}

function BusinessWorkspace({
  workspace,
  onAccess,
  reload,
  showSessionLine = true,
}: {
  workspace: CollaborationWorkspace;
  onAccess: (
    update: (access: CollaborationWorkspace["access"]) => CollaborationWorkspace["access"],
  ) => void;
  reload: () => void;
  showSessionLine?: boolean;
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = useRef(false);
  const available = workspace.access.filter((entry) => !entry.error);
  const denied = workspace.access.filter((entry) => entry.error);
  const unlinkedBusiness = workspace.session.role === "business"
    && verifiedBusinessIds(workspace.session).length === 0;

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
      if (clearSessionIfUnauthorized(error)) return;
      showFeedback({ tone: "error", message: collaborationErrorMessage(error) });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showSessionLine ? (
          <p className="text-sm text-[var(--cg-muted)]">
            Signed in{workspace.session.email ? ` as ${workspace.session.email}` : ""}
            {workspace.session.role ? ` (${workspace.session.role})` : ""}.
          </p>
        ) : <span />}
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
            blockedReason={businessReviewBlock(workspace.session.role, deliverable.status)}
            pending={pending?.id === deliverable.deliverable_id ? pending.action : null}
            error=""
          />
        ))
      )}
    </section>
  );
}
