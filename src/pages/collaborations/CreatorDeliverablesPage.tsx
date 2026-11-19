import { useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Chip, Modal } from "@heroui/react";
import { X } from "lucide-react";
import {
  AppButton,
  AppNotice,
  campaignStatusChip,
  DeliverableCard,
  DeliverableForm,
  draftSubmitBlockReason,
  deliverableStatusLabel,
  EmptyState,
  LoadingSkeleton,
  toDeliverableSummary,
  type DeliverableFormValues,
  type DeliverableInput,
} from "../../components";
import {
  collaborationErrorMessage,
  createDeliverable,
  submitDeliverable,
  upsertDeliverable,
  type CollaborationWorkspace,
  type Deliverable,
} from "../../api/collaborations";
import { dashboardPath, type AccountRole } from "../auth/session";
import { clearSessionIfUnauthorized, useRoleWorkspace } from "./useRoleWorkspace";

type Feedback = { tone: "success" | "error"; message: string };
type Pending = { action: "draft" | "submit"; id?: number };

const productionClass = "flex w-full flex-col gap-6 text-[var(--cg-text)]";
const developmentClass = "mx-auto flex w-full max-w-3xl flex-col gap-6 text-[var(--cg-text)]";
const linkClass =
  "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline hover:bg-[var(--cg-primary-dark)]";
const textLink = "text-sm font-semibold text-[var(--cg-primary-dark)] no-underline";
const headingClass = "text-xl font-semibold text-[var(--cg-primary-dark)]";

function createBlockReason(role: CollaborationWorkspace["session"]["role"], available: number) {
  if (role === "business") {
    return "This session is a business account. Use Business review to approve or request a revision.";
  }
  if (available === 0) return "Add a deliverable after this account can read a campaign's deliverables.";
  return "";
}

function submitBlockReason(role: CollaborationWorkspace["session"]["role"], status: string) {
  if (role === "business") {
    return "This session is a business account. Use Business review to approve or request a revision.";
  }
  return draftSubmitBlockReason(status);
}

function roleLabel(role: AccountRole) {
  if (role === "creator") return "creator";
  if (role === "business") return "business";
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

export default function CreatorDeliverablesPage() {
  const { pathname } = useLocation();
  const production = pathname.startsWith("/dashboard/");
  const returnPath = production ? "/dashboard/creator/deliverables" : "/dev/collaborations/creator";
  const { view, workspace, reload, updateAccess } = useRoleWorkspace("creator", production);

  return (
    <div className={production ? productionClass : developmentClass}>
      <div className="max-w-2xl">
        {production ? (
          <Link to="/dashboard/creator" className={textLink}>
            Back to dashboard
          </Link>
        ) : (
          <p className="eyebrow">Development</p>
        )}
        <h1 className={production ? "mt-3 text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl" : undefined}>
          {production ? "Deliverables" : "Creator deliverables"}
        </h1>
        <p className="mt-2 text-base text-[var(--cg-muted)]">
          Create and submit deliverables for campaigns this account can read.
        </p>
        {production ? null : (
          <Link to="/dev/collaborations/business" className={`mt-2 inline-block ${textLink}`}>
            Business review
          </Link>
        )}
      </div>

      {(view.kind === "checking" || view.kind === "loading") && (
        <LoadingBlock label={view.kind === "checking" ? "Checking this account..." : "Loading deliverables."} />
      )}

      {view.kind === "signed-out" && (
        <div className="flex flex-col items-start gap-3">
          <AppNotice
            tone="info"
            message={
              view.expired
                ? "Your session expired. Log in with a creator account to view and submit deliverables."
                : "Sign in with a creator account to view and submit deliverables."
            }
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
            message={`This page is for creator accounts. You are signed in as a ${roleLabel(view.role)} account.`}
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
        <CreatorWorkspace workspace={workspace} onAccess={updateAccess} reload={reload} />
      )}
    </div>
  );
}

function CreatorWorkspace({
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
  const [formError, setFormError] = useState("");
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = useRef(false);
  const available = workspace.access.filter((entry) => !entry.error);
  const denied = workspace.access.filter((entry) => entry.error);
  const addReason = createBlockReason(workspace.session.role, available.length);
  const formPending = pending && pending.id == null ? pending.action : null;

  function showFeedback(next: Feedback) {
    setFeedback(next);
    requestAnimationFrame(() => {
      document.getElementById("collaboration-feedback")?.scrollIntoView({ block: "nearest" });
    });
  }

  function place(deliverable: Deliverable) {
    onAccess((access) => upsertDeliverable(access, deliverable));
  }

  async function save(input: DeliverableInput, action: "draft" | "submit") {
    if (busy.current || workspace.session.role === "business") return;
    const campaignId = Number(input.campaignId);
    if (!Number.isInteger(campaignId)) {
      setFormError("Choose a campaign.");
      return;
    }

    busy.current = true;
    setPending({ action });
    setFormError("");
    setFeedback(null);
    try {
      const created = await createDeliverable(
        campaignId,
        {
          title: input.title,
          description: input.description || null,
          attachments: input.attachments.map((attachment) => ({
            attachment_type: attachment.type,
            url: attachment.url,
          })),
        },
        workspace.session.accessToken,
      );
      place(created);
      if (action === "draft") {
        setOpen(false);
        showFeedback({
          tone: "success",
          message: `Draft saved for "${created.title}". Status is ${deliverableStatusLabel(created.status)}.`,
        });
        return;
      }

      try {
        const submitted = await submitDeliverable(created.deliverable_id, workspace.session.accessToken);
        place(submitted);
        setOpen(false);
        showFeedback({
          tone: "success",
          message: `Submit finished for "${submitted.title}". Status is ${deliverableStatusLabel(submitted.status)}.`,
        });
      } catch (error) {
        if (clearSessionIfUnauthorized(error)) return;
        setOpen(false);
        showFeedback({
          tone: "error",
          message: `Draft saved for "${created.title}" with status ${deliverableStatusLabel(created.status)}. Submit failed: ${collaborationErrorMessage(error)}`,
        });
      }
    } catch (error) {
      if (clearSessionIfUnauthorized(error)) return;
      setFormError(collaborationErrorMessage(error));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function submitExisting(deliverable: Deliverable) {
    if (busy.current || submitBlockReason(workspace.session.role, deliverable.status)) return;
    busy.current = true;
    setPending({ action: "submit", id: deliverable.deliverable_id });
    setFeedback(null);
    try {
      const updated = await submitDeliverable(deliverable.deliverable_id, workspace.session.accessToken);
      place(updated);
      showFeedback({
        tone: "success",
        message: `Submit finished for "${updated.title}". Status is ${deliverableStatusLabel(updated.status)}.`,
      });
    } catch (error) {
      if (clearSessionIfUnauthorized(error)) return;
      showFeedback({ tone: "error", message: collaborationErrorMessage(error) });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  const initialValues: DeliverableFormValues = {
    campaignId: available[0] ? String(available[0].campaign.campaign_id) : "",
    title: "",
    description: "",
    attachments: [{ key: "attachment-1", type: "link", url: "" }],
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--cg-muted)]">
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

      {available.length === 0 ? (
        <EmptyState
          title="No campaigns"
          description={
            workspace.access.length === 0
              ? "No campaigns included a deliverable list this account can read."
              : "Deliverables could not be loaded for the campaigns returned to this account."
          }
        />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className={headingClass}>Campaigns ({available.length})</h2>
          <p className="text-sm text-[var(--cg-muted)]">
            A campaign appears here when this account can read its deliverables.
          </p>
          {available.map((entry) => {
            const campaignStatus = campaignStatusChip(entry.campaign.status);
            return (
            <article
              key={entry.campaign.campaign_id}
              className="rounded-2xl border border-[var(--cg-border)] bg-white p-4"
            >
              <h3 className="break-words font-semibold">{entry.campaign.name}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span>Campaign #{entry.campaign.campaign_id}</span>
                <Chip size="sm" variant="soft" color={campaignStatus.color}>
                  {campaignStatus.label}
                </Chip>
              </p>
              {entry.campaign.description && <p className="text-sm">{entry.campaign.description}</p>}
            </article>
            );
          })}
        </section>
      )}

      <div className="flex flex-col items-start gap-2">
        <AppButton
          isDisabled={Boolean(addReason) || pending !== null}
          onPress={() => {
            setFormError("");
            setFormKey((value) => value + 1);
            setOpen(true);
          }}
        >
          Add deliverable
        </AppButton>
        {addReason && <p className="text-sm">{addReason}</p>}
      </div>

      <StatusGroups
        workspace={workspace}
        pending={pending}
        onSubmit={submitExisting}
      />

      {open && (
        <Modal>
          <Modal.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (!isOpen && !pending) setOpen(false);
            }}
          >
            <Modal.Container size="lg" placement="center">
              <Modal.Dialog aria-label="Add deliverable">
                <Modal.Header>
                  <Modal.Heading>Add deliverable</Modal.Heading>
                  <Modal.CloseTrigger isDisabled={pending !== null}>
                    <X size={18} aria-hidden="true" />
                  </Modal.CloseTrigger>
                </Modal.Header>
                <Modal.Body>
                  <DeliverableForm
                    key={formKey}
                    initialValues={initialValues}
                    campaigns={available.map((entry) => ({
                      value: String(entry.campaign.campaign_id),
                      label: entry.campaign.name,
                    }))}
                    onSaveDraft={(input) => save(input, "draft")}
                    onSubmit={(input) => save(input, "submit")}
                    saveDisabled={pending !== null}
                    submitDisabled={pending !== null}
                    pending={formPending}
                    error={formError}
                  />
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </>
  );
}

function StatusGroups({
  workspace,
  pending,
  onSubmit,
}: {
  workspace: CollaborationWorkspace;
  pending: Pending | null;
  onSubmit: (deliverable: Deliverable) => void;
}) {
  const groups = [
    ["draft", "Drafts", "No draft deliverables."],
    ["submitted", "Submitted", "No submitted deliverables."],
    ["approved", "Approved", "No approved deliverables."],
    ["revision_requested", "Revision requests", "No revision requests."],
  ] as const;

  return (
    <>
      {workspace.session.role !== "business" && workspace.access.some((entry) =>
        !entry.error && entry.deliverables.some((item) => draftSubmitBlockReason(item.status)),
      ) && (
        <p className="text-sm text-[var(--cg-muted)]">
          Submit is available for drafts and revision requests.
        </p>
      )}
      {groups.map(([status, title, empty]) => {
        const rows = workspace.access.flatMap((entry) => {
          if (entry.error) return [];
          return entry.deliverables
            .filter((deliverable) => deliverable.status === status)
            .map((deliverable) => ({ deliverable, campaignName: entry.campaign.name }));
        });

        return (
          <section key={status} className="flex flex-col gap-3">
            <h2 className={headingClass}>
              {title} ({rows.length})
            </h2>
            {status === "revision_requested" && (
              <p className="text-sm text-[var(--cg-muted)]">
                Resubmit sends this deliverable again with its current content and attachment.
              </p>
            )}
            {rows.length === 0 ? (
              <p className="text-sm">{empty}</p>
            ) : (
              rows.map(({ deliverable, campaignName }) => {
                const reason = submitBlockReason(workspace.session.role, deliverable.status);
                const cardReason = reason === draftSubmitBlockReason(deliverable.status) ? "" : reason;
                const submitting = pending?.action === "submit" && pending.id === deliverable.deliverable_id;
                return (
                  <DeliverableCard
                    key={deliverable.deliverable_id}
                    deliverable={toDeliverableSummary(
                      deliverable,
                      campaignName,
                      workspace.creatorNames[deliverable.creator_id],
                    )}
                  >
                    <div className="flex flex-col items-start gap-2 border-t border-[var(--cg-border)] pt-3">
                      <AppButton
                        isDisabled={Boolean(reason) || pending !== null}
                        aria-label={`${status === "revision_requested" ? "Resubmit" : "Submit"} ${deliverable.title}`}
                        onPress={() => onSubmit(deliverable)}
                      >
                        {submitting ? "Submitting..." : status === "revision_requested" ? "Resubmit" : "Submit"}
                      </AppButton>
                      {cardReason && <p className="text-sm">{cardReason}</p>}
                    </div>
                  </DeliverableCard>
                );
              })
            )}
          </section>
        );
      })}
    </>
  );
}
