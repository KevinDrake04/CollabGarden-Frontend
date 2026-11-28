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
  getDeliverable,
  isUncertainDeliverableWrite,
  loadCampaignDeliverables,
  submitDeliverable,
  updateDeliverable,
  upsertDeliverable,
  type CollaborationWorkspace,
  type Deliverable,
  type DeliverableWrite,
} from "../../../api/collaborations";
import { dashboardPath, isCurrentSession } from "../../auth/session";
import { DeliverableFeedback } from "../shared/DeliverableFeedback";
import { clearSessionIfUnauthorized, useRoleWorkspace } from "../shared/useRoleWorkspace";
import { linkClass, signedInAs, textLinkClass, titleClass } from "../shared/workspaceSession";

type Feedback = { tone: "success" | "error"; message: string };
type Pending = { action: "save" | "submit"; id?: number } | { action: "check"; id: number };
type Editor = { kind: "new" } | { kind: "edit"; deliverable: Deliverable };
type PendingCreate = { requestId: string; previousIds: number[]; content: DeliverableWrite };

const pageClass = "flex w-full flex-col gap-6 text-[var(--cg-text)]";
const headingClass = "text-xl font-semibold text-[var(--cg-primary-dark)]";

function readPendingCreates(key: string): Record<number, PendingCreate> {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function matchesDraft(deliverable: Deliverable, content: DeliverableWrite) {
  return deliverable.title === content.title &&
    (deliverable.description || null) === content.description &&
    deliverable.attachments.length === content.attachments.length &&
    deliverable.attachments.every((attachment, index) => {
      const original = content.attachments[index];
      return attachment.attachment_type === original.attachment_type && attachment.url === original.url;
    });
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
        <CreatorWorkspace
          key={`${view.workspace.session.userId}:${view.workspace.session.accessToken}`}
          workspace={view.workspace}
          onAccess={updateAccess}
          reload={reload}
        />
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
  const { session } = workspace;
  const createKey = `collabgarden.pendingDeliverables.${session.userId}`;
  const [pendingCreates, setPendingCreates] = useState(() => readPendingCreates(createKey));
  const available = workspace.access.filter((entry) => !entry.error);
  const denied = workspace.access.filter((entry) => entry.error);
  const addReason = available.length === 0
    ? "Add a deliverable once a campaign is available."
    : "";
  const formPending = pending?.action !== "check" && pending?.id == null ? pending?.action ?? null : null;
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

  function rememberCreate(campaignId: number, draft: PendingCreate, action: "lock" | "clear") {
    // A response can arrive after this page has been reopened and another save has started.
    const next = readPendingCreates(createKey);
    if (action === "lock") {
      next[campaignId] = draft;
    } else {
      if (next[campaignId]?.requestId !== draft.requestId) return;
      delete next[campaignId];
    }
    sessionStorage.setItem(createKey, JSON.stringify(next));
    setPendingCreates(next);
  }

  async function save(input: DeliverableInput, action: "save" | "submit") {
    if (busy.current || !editor || !isCurrentSession(session)) return;
    const campaign = input.kind === "create"
      ? available.find(({ campaign }) => campaign.campaign_id === input.campaignId)
      : null;
    if (input.kind === "create" && (!campaign || readPendingCreates(createKey)[input.campaignId])) {
      setFormError(campaign ? "Check the previous draft before creating another for this campaign." : "Choose an available campaign.");
      return;
    }
    if (input.kind === "edit" && (!editing || draftSubmitBlockReason(editing.status))) return;

    busy.current = true;
    setPending({ action });
    setFormError("");
    setFeedback(null);
    try {
      let saved: Deliverable | null = null;
      if (input.kind === "create" && campaign) {
        // Keep the lock across reloads in case the server saves before the connection drops.
        const draft = {
          requestId: crypto.randomUUID(),
          previousIds: campaign.deliverables.map((item) => item.deliverable_id),
          content: input.content,
        };
        rememberCreate(input.campaignId, draft, "lock");
        try {
          saved = await createDeliverable(input.campaignId, input.content, session.accessToken);
        } catch (error) {
          if (!isCurrentSession(session)) return;
          if (isUncertainDeliverableWrite(error)) {
            setEditor(null);
            showFeedback({ tone: "error", message: "Couldn't confirm the draft. Check the campaign before creating it again." });
            return;
          }
          rememberCreate(input.campaignId, draft, "clear");
          throw error;
        }
        if (!isCurrentSession(session)) return;
        rememberCreate(input.campaignId, draft, "clear");
      } else if (input.kind === "edit" && editing && Object.keys(input.changes).length > 0) {
        saved = await updateDeliverable(editing.deliverable_id, input.changes, session.accessToken);
      }

      if (!isCurrentSession(session)) return;
      if (saved) place(saved);

      const target = saved ?? editing;
      if (action === "submit" && target) {
        try {
          await submit(target);
        } catch (error) {
          if (!isCurrentSession(session) || clearSessionIfUnauthorized(error, session)) return;
          if (!saved) {
            setFormError(collaborationErrorMessage(error));
            return;
          }
          showFeedback({
            tone: "error",
            message: `Saved "${saved.title}". Submission failed. ${collaborationErrorMessage(error)}`,
          });
        }
      } else if (saved) {
        showFeedback({
          tone: "success",
          message: `${editing ? "Changes saved" : "Draft saved"} for "${saved.title}". Status is ${deliverableStatusLabel(saved.status)}.`,
        });
      } else {
        showFeedback({ tone: "success", message: "No changes to save." });
      }
      setEditor(null);
    } catch (error) {
      if (!isCurrentSession(session) || clearSessionIfUnauthorized(error, session)) return;
      setFormError(collaborationErrorMessage(error));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function checkDraft(campaignId: number) {
    const entry = available.find(({ campaign }) => campaign.campaign_id === campaignId);
    if (!entry || busy.current || !isCurrentSession(session)) return;
    const stored = readPendingCreates(createKey);
    const draft = stored[campaignId];
    if (!draft) {
      setPendingCreates(stored);
      return;
    }
    busy.current = true;
    setPending({ action: "check", id: campaignId });
    try {
      const [fresh] = await loadCampaignDeliverables([entry.campaign], session);
      if (!isCurrentSession(session)) return;
      if (!fresh || fresh.error) throw new Error(fresh?.error ?? "Could not read this campaign's deliverables.");
      onAccess((access) => access.map((item) => item.campaign.campaign_id === campaignId ? fresh : item));
      const matches = fresh.deliverables.filter((item) =>
        !draft.previousIds.includes(item.deliverable_id) && matchesDraft(item, draft.content),
      );
      if (matches.length === 1) {
        rememberCreate(campaignId, draft, "clear");
        showFeedback({ tone: "success", message: `Found "${matches[0].title}" in this campaign. Use the existing deliverable below.` });
      } else {
        showFeedback({ tone: "error", message: "The draft couldn't be identified. Check again before creating another." });
      }
    } catch (error) {
      if (!isCurrentSession(session) || clearSessionIfUnauthorized(error, session)) return;
      showFeedback({ tone: "error", message: collaborationErrorMessage(error) });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function submit(deliverable: Deliverable) {
    const id = deliverable.deliverable_id;
    let updated: Deliverable;
    try {
      updated = await submitDeliverable(id, session.accessToken);
    } catch (error) {
      if (!isUncertainDeliverableWrite(error) || !isCurrentSession(session)) throw error;
      updated = await getDeliverable(id, session.accessToken);
      if (updated.deliverable_id !== id || updated.status !== "submitted") throw error;
    }
    if (!isCurrentSession(session)) return;
    place(updated);
    showFeedback({
      tone: "success",
      message: `${deliverable.status === "revision_requested" ? "Resubmitted" : "Submitted"} "${updated.title}".`,
    });
  }

  async function submitExisting(deliverable: Deliverable) {
    if (busy.current || draftSubmitBlockReason(deliverable.status) || !isCurrentSession(session)) return;
    busy.current = true;
    setPending({ action: "submit", id: deliverable.deliverable_id });
    setFeedback(null);
    try {
      await submit(deliverable);
    } catch (error) {
      if (!isCurrentSession(session) || clearSessionIfUnauthorized(error, session)) return;
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

      {available.filter(({ campaign }) => pendingCreates[campaign.campaign_id]).map(({ campaign }) => (
        <div key={campaign.campaign_id} className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Check the previous draft for {campaign.name}.</span>
          <AppButton variant="secondary" isDisabled={pending !== null} onPress={() => checkDraft(campaign.campaign_id)}>
            {pending?.action === "check" && pending.id === campaign.campaign_id ? "Checking..." : "Check saved draft"}
          </AppButton>
        </div>
      ))}

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
                      <DeliverableFeedback deliverable={deliverable} session={workspace.session} />
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
