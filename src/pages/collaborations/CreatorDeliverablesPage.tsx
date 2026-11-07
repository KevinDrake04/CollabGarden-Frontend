import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Modal } from "@heroui/react";
import { X } from "lucide-react";
import {
  AppButton,
  AppNotice,
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
  isAbortError,
  loadCollaborationWorkspace,
  submitDeliverable,
  upsertDeliverable,
  type CollaborationWorkspace,
  type Deliverable,
} from "../../api/collaborations";

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; workspace: CollaborationWorkspace };

type Feedback = { tone: "success" | "error"; message: string };
type Pending = { action: "draft" | "submit"; id?: number };

const pageClass = "mx-auto flex w-full max-w-3xl flex-col gap-6 text-[var(--cg-text)]";

function createBlockReason(role: CollaborationWorkspace["session"]["role"], available: number) {
  if (role === "business") {
    return "This session is a business account. Use Business review to approve or request a revision.";
  }
  if (available === 0) return "Add a deliverable after this account can read a linked campaign.";
  return "";
}

function submitBlockReason(role: CollaborationWorkspace["session"]["role"], status: string) {
  if (role === "business") {
    return "This session is a business account. Use Business review to approve or request a revision.";
  }
  return draftSubmitBlockReason(status);
}

export default function CreatorDeliverablesPage() {
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
        <h1>Creator deliverables</h1>
        <p>Prepare deliverables for campaigns linked to this creator.</p>
        <Link
          to="/dev/collaborations/business"
          className="text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          Business review
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
              state={{ from: "/dev/collaborations/creator" }}
              className="font-semibold text-[var(--cg-primary-dark)]"
            >
              Log in
            </Link>{" "}
            as a creator to view and submit deliverables.
          </p>
          <AppButton isDisabled>Add deliverable</AppButton>
          <p className="text-sm">Add deliverable is available to a signed-in creator with a linked campaign.</p>
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
        <CreatorWorkspace
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
        setOpen(false);
        showFeedback({
          tone: "error",
          message: `Draft saved for "${created.title}" with status ${deliverableStatusLabel(created.status)}. Submit failed: ${collaborationErrorMessage(error)}`,
        });
      }
    } catch (error) {
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

      {available.length === 0 ? (
        <EmptyState
          title="No assigned campaigns"
          description={
            workspace.access.length === 0
              ? "This account did not receive any campaigns. A creator can prepare deliverables after being linked to a campaign. That link is created outside this page."
              : "This account cannot read deliverables for the campaigns that were returned. A creator has to be linked to a campaign before this page can show them."
          }
        />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Assigned campaigns ({available.length})</h2>
          <p className="text-sm">
            A campaign appears here when this account can read its deliverables. Campaign linking is done outside this page.
          </p>
          {available.map((entry) => (
            <article
              key={entry.campaign.campaign_id}
              className="rounded-2xl border border-[var(--cg-border)] bg-white p-4"
            >
              <h3 className="font-semibold">{entry.campaign.name}</h3>
              <p className="text-sm">
                Campaign #{entry.campaign.campaign_id}, status {entry.campaign.status}
              </p>
              {entry.campaign.description && <p className="text-sm">{entry.campaign.description}</p>}
            </article>
          ))}
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
      {groups.map(([status, title, empty]) => {
        const rows = workspace.access.flatMap((entry) => {
          if (entry.error) return [];
          return entry.deliverables
            .filter((deliverable) => deliverable.status === status)
            .map((deliverable) => ({ deliverable, campaignName: entry.campaign.name }));
        });

        return (
          <section key={status} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {title} ({rows.length})
            </h2>
            {status === "revision_requested" && (
              <p className="text-sm">
                Revision comments are not included in the deliverable response, and attachments cannot be updated after creation.
              </p>
            )}
            {rows.length === 0 ? (
              <p className="text-sm">{empty}</p>
            ) : (
              rows.map(({ deliverable, campaignName }) => {
                const reason = submitBlockReason(workspace.session.role, deliverable.status);
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
                        aria-label={`Submit ${deliverable.title}`}
                        onPress={() => onSubmit(deliverable)}
                      >
                        {submitting ? "Submitting..." : "Submit"}
                      </AppButton>
                      {reason && <p className="text-sm">{reason}</p>}
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
