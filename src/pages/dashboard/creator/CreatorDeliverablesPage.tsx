import { useRef, useState } from "react";
import { Link } from "react-router";
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
} from "../../../components";
import {
  collaborationErrorMessage,
  createDeliverable,
  submitDeliverable,
  updateDeliverable,
  upsertDeliverable,
  type CollaborationWorkspace,
  type Deliverable,
} from "../../../api/collaborations";
import { dashboardPath } from "../../auth/session";
import { DeliverableFeedback } from "../shared/DeliverableFeedback";
import { clearSessionIfUnauthorized, useRoleWorkspace } from "../shared/useRoleWorkspace";
import { linkClass, signedInAs, textLinkClass, titleClass } from "../shared/workspaceSession";

type Feedback = { tone: "success" | "error"; message: string };
type Pending = { action: "save" | "submit"; id?: number };
type Editor = { kind: "new" } | { kind: "edit"; deliverable: Deliverable };

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

export default function CreatorDeliverablesPage() {
  const returnPath = "/dashboard/creator/deliverables";
  const { view, reload, updateAccess } = useRoleWorkspace("creator");

  return (
    <div className={pageClass}>
      <div className="max-w-2xl">
        <Link to="/dashboard/creator" className={textLinkClass}>
          Overview
        </Link>
        <h1 className={`mt-3 ${titleClass}`}>
          Deliverables
        </h1>
        <p className="mt-2 text-base text-[var(--cg-muted)]">
          Create and submit deliverables for your campaigns.
        </p>
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
            message="Sign in with a creator account to view and submit deliverables."
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
            message={`This page is for creator accounts. You are signed in as ${signedInAs(view.role)} account.`}
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

      {view.kind === "ready" && (
        <CreatorWorkspace workspace={view.workspace} onAccess={updateAccess} reload={reload} />
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
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = useRef(false);
  const available = workspace.access.filter((entry) => !entry.error);
  const denied = workspace.access.filter((entry) => entry.error);
  const addReason = available.length === 0
    ? "Add a deliverable once a campaign is available."
    : "";
  const formPending = pending && pending.id == null ? pending.action : null;
  const editing = editor?.kind === "edit" ? editor.deliverable : null;
  const editorTitle = editing ? "Edit deliverable" : "Add deliverable";

  function openEditor(next: Editor) {
    setFormError("");
    setEditor(next);
  }

  function showFeedback(next: Feedback) {
    setFeedback(next);
    requestAnimationFrame(() => {
      document.getElementById("collaboration-feedback")?.scrollIntoView({ block: "nearest" });
    });
  }

  function place(deliverable: Deliverable) {
    onAccess((access) => upsertDeliverable(access, deliverable));
  }

  async function save(input: DeliverableInput, action: "save" | "submit") {
    if (busy.current || !editor) return;

    busy.current = true;
    setPending({ action });
    setFormError("");
    setFeedback(null);
    let saved: Deliverable | null = null;
    try {
      const token = workspace.session.accessToken;
      const content = {
        title: input.title,
        description: input.description || null,
        attachments: input.attachments.map((attachment) => ({
          attachment_type: attachment.type,
          url: attachment.url,
        })),
      };
      if (editing) {
        const attachmentsChanged = content.attachments.length !== editing.attachments.length ||
          content.attachments.some((attachment, index) => {
            const previous = editing.attachments[index];
            return attachment.attachment_type !== previous.attachment_type || attachment.url !== previous.url;
          });
        const changes = {
          ...(content.title !== editing.title.trim() && { title: content.title }),
          ...(input.description !== (editing.description ?? "").trim() && { description: content.description }),
          ...(attachmentsChanged && { attachments: content.attachments }),
        };
        if (Object.keys(changes).length > 0) {
          saved = await updateDeliverable(editing.deliverable_id, changes, token);
        }
      } else {
        saved = await createDeliverable(Number(input.campaignId), content, token);
      }
      if (saved) place(saved);

      const target = saved ?? editing;
      if (action === "submit" && target) {
        await submit(target);
      } else if (saved) {
        showFeedback({
          tone: "success",
          message: `${editing ? "Changes saved" : "Draft saved"} for "${saved.title}". Status is ${deliverableStatusLabel(saved.status)}.`,
        });
      }
      setEditor(null);
    } catch (error) {
      if (clearSessionIfUnauthorized(error)) return;
      const message = collaborationErrorMessage(error);
      if (saved) {
        setEditor(null);
        showFeedback({ tone: "error", message: `Saved "${saved.title}". Submission failed. ${message}` });
      } else {
        setFormError(message);
      }
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function submit(deliverable: Deliverable) {
    const updated = await submitDeliverable(deliverable.deliverable_id, workspace.session.accessToken);
    place(updated);
    showFeedback({
      tone: "success",
      message: `${deliverable.status === "revision_requested" ? "Resubmitted" : "Submitted"} "${updated.title}".`,
    });
  }

  async function submitExisting(deliverable: Deliverable) {
    if (busy.current || draftSubmitBlockReason(deliverable.status)) return;
    busy.current = true;
    setPending({ action: "submit", id: deliverable.deliverable_id });
    setFeedback(null);
    try {
      await submit(deliverable);
    } catch (error) {
      if (clearSessionIfUnauthorized(error)) return;
      showFeedback({ tone: "error", message: collaborationErrorMessage(error) });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  const initialValues: DeliverableFormValues = {
    campaignId: String(editing?.campaign_id ?? available[0]?.campaign.campaign_id ?? ""),
    title: editing?.title ?? "",
    description: editing?.description ?? "",
    attachments: editing
      ? editing.attachments.map((attachment, index) => ({
          key: `attachment-${index + 1}`,
          type: attachment.attachment_type,
          url: attachment.url,
        }))
      : [{ key: "attachment-1", type: "link", url: "" }],
  };

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
              ? "No campaigns are ready for a deliverable yet."
              : "Deliverables could not be loaded."
          }
        />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className={headingClass}>Campaigns ({available.length})</h2>
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
          onPress={() => openEditor({ kind: "new" })}
        >
          Add deliverable
        </AppButton>
        {addReason && <p className="text-sm">{addReason}</p>}
      </div>

      <StatusGroups
        workspace={workspace}
        pending={pending}
        onEdit={(deliverable) => openEditor({ kind: "edit", deliverable })}
        onSubmit={submitExisting}
      />

      {editor && (
        <Modal>
          <Modal.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (!isOpen && !pending) setEditor(null);
            }}
          >
            <Modal.Container size="lg" placement="center">
              <Modal.Dialog aria-label={editorTitle}>
                <Modal.Header>
                  <Modal.Heading>{editorTitle}</Modal.Heading>
                  <Modal.CloseTrigger isDisabled={pending !== null}>
                    <X size={18} aria-hidden="true" />
                  </Modal.CloseTrigger>
                </Modal.Header>
                <Modal.Body>
                  <DeliverableForm
                    initialValues={initialValues}
                    campaigns={editing ? undefined : available.map((entry) => ({
                      value: String(entry.campaign.campaign_id),
                      label: entry.campaign.name,
                    }))}
                    mode={!editing ? "create" : editing.status === "revision_requested" ? "revise" : "edit"}
                    onSave={(input) => save(input, "save")}
                    onSubmit={(input) => save(input, "submit")}
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
  onEdit,
  onSubmit,
}: {
  workspace: CollaborationWorkspace;
  pending: Pending | null;
  onEdit: (deliverable: Deliverable) => void;
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
      {workspace.access.some((entry) =>
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
                Review the feedback, make any changes, and resubmit when ready.
              </p>
            )}
            {rows.length === 0 ? (
              <p className="text-sm">{empty}</p>
            ) : (
              rows.map(({ deliverable, campaignName }) => {
                const reason = draftSubmitBlockReason(deliverable.status);
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
                    {status !== "draft" && (
                      <DeliverableFeedback deliverable={deliverable} token={workspace.session.accessToken} />
                    )}
                    {!reason && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--cg-border)] pt-3">
                        <AppButton
                          variant="secondary"
                          isDisabled={pending !== null}
                          aria-label={`Edit ${deliverable.title}`}
                          onPress={() => onEdit(deliverable)}
                        >
                          Edit
                        </AppButton>
                        <AppButton
                          isDisabled={pending !== null}
                          aria-label={`${status === "revision_requested" ? "Resubmit" : "Submit"} ${deliverable.title}`}
                          onPress={() => onSubmit(deliverable)}
                        >
                          {submitting ? "Submitting..." : status === "revision_requested" ? "Resubmit" : "Submit"}
                        </AppButton>
                      </div>
                    )}
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
