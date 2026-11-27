import { type ReactNode, useState } from "react";
import { Card, Chip } from "@heroui/react";
import { AppButton } from "../ui/Buttons";
import { AppInput, AppSelect, AppTextarea, type SelectOption } from "../ui/Fields";
import { AppNotice } from "../feedback/Feedback";
import type { DeliverableWrite } from "../../api/collaborations";

const cardClass = "rounded-2xl border border-[var(--cg-border)] bg-white p-5";

export const deliverableStatuses = [
  "draft",
  "submitted",
  "approved",
  "revision_requested",
] as const;

export type DeliverableStatus = (typeof deliverableStatuses)[number];

const statusLabels: Record<DeliverableStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  revision_requested: "Revision Requested",
};

const statusColors: Record<DeliverableStatus, "default" | "accent" | "success" | "warning"> = {
  draft: "default",
  submitted: "accent",
  approved: "success",
  revision_requested: "warning",
};

export function deliverableStatusLabel(status: string) {
  return status in statusLabels ? statusLabels[status as DeliverableStatus] : status;
}

export function draftSubmitBlockReason(status: string) {
  if (status === "draft" || status === "revision_requested") return "";
  return "Submit is available for drafts and revision requests.";
}

export function reviewBlockReason(status: string) {
  if (status === "submitted") return "";
  return "Approve and request revision are available for submitted deliverables.";
}

export function DeliverableStatusBadge({ status }: { status: string }) {
  const known = status in statusLabels;
  return (
    <span data-status={status}>
      <Chip
        size="sm"
        variant="soft"
        color={known ? statusColors[status as DeliverableStatus] : "default"}
        className={status === "revision_requested" ? "bg-[#f6e4c4] text-[#6d4510]" : undefined}
      >
        {deliverableStatusLabel(status)}
      </Chip>
    </span>
  );
}

export type DeliverableAttachment = {
  id?: number;
  type: "link" | "image";
  url: string;
};

export type DeliverableSummary = {
  id: number;
  title: string;
  campaignName: string;
  status: string;
  description?: string | null;
  creatorId?: number;
  creatorName?: string;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  attachments: DeliverableAttachment[];
};

export function toDeliverableSummary(
  deliverable: {
    deliverable_id: number;
    title: string;
    status: string;
    description?: string | null;
    creator_id?: number;
    submitted_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    attachments?: {
      attachment_id?: number;
      attachment_type: "link" | "image";
      url: string;
    }[];
  },
  campaignName: string,
  creatorName?: string,
): DeliverableSummary {
  return {
    id: deliverable.deliverable_id,
    title: deliverable.title,
    campaignName,
    status: deliverable.status,
    description: deliverable.description,
    creatorId: deliverable.creator_id,
    creatorName,
    submittedAt: deliverable.submitted_at,
    createdAt: deliverable.created_at,
    updatedAt: deliverable.updated_at,
    attachments: (deliverable.attachments ?? []).map((attachment) => ({
      id: attachment.attachment_id,
      type: attachment.attachment_type,
      url: attachment.url,
    })),
  };
}

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function safeHref(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    return null;
  }
  return null;
}

function creatorLabel(deliverable: DeliverableSummary) {
  if (deliverable.creatorId == null) return "";
  if (deliverable.creatorName) return `${deliverable.creatorName} (#${deliverable.creatorId})`;
  return `Creator #${deliverable.creatorId}`;
}

function AttachmentLine({ attachment }: { attachment: DeliverableAttachment }) {
  const [failed, setFailed] = useState(false);
  const href = safeHref(attachment.url);
  const label = attachment.type === "image" ? "Image" : "Link";

  return (
    <li className="flex flex-col gap-2">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sm font-medium text-[var(--cg-primary-dark)]"
        >
          {label}: {attachment.url}
        </a>
      ) : (
        <span className="break-all text-sm">
          {label}: {attachment.url}
        </span>
      )}
      {attachment.type === "image" && href && !failed && (
        <img
          src={href}
          alt=""
          className="max-h-40 max-w-full rounded-lg object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </li>
  );
}

export function DeliverableCard({
  deliverable,
  children,
}: {
  deliverable: DeliverableSummary;
  children?: ReactNode;
}) {
  const creator = creatorLabel(deliverable);
  const submitted = formatTimestamp(deliverable.submittedAt);
  const created = formatTimestamp(deliverable.createdAt);
  const updated = formatTimestamp(deliverable.updatedAt);

  return (
    <Card role="article" aria-label={deliverable.title} className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="break-words text-lg font-semibold text-[var(--cg-text)]">{deliverable.title}</h3>
          <p className="text-sm">Deliverable #{deliverable.id}</p>
        </div>
        <DeliverableStatusBadge status={deliverable.status} />
      </div>

      <p className="text-sm text-[var(--cg-text)]">Campaign: {deliverable.campaignName}</p>
      {deliverable.description && <p className="text-sm">{deliverable.description}</p>}

      <div>
        <h4 className="text-sm font-semibold text-[var(--cg-text)]">Attachments</h4>
        {deliverable.attachments.length === 0 ? (
          <p className="text-sm">No attachments</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {deliverable.attachments.map((attachment, index) => (
              <AttachmentLine
                key={attachment.id ?? `${index}-${attachment.url}`}
                attachment={attachment}
              />
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {creator && (
          <>
            <dt>Creator</dt>
            <dd>{creator}</dd>
          </>
        )}
        <dt>Submitted</dt>
        <dd>{submitted || "Not yet"}</dd>
        {created && (
          <>
            <dt>Created</dt>
            <dd>{created}</dd>
          </>
        )}
        {updated && (
          <>
            <dt>Updated</dt>
            <dd>{updated}</dd>
          </>
        )}
      </dl>

      {children}
    </Card>
  );
}

type AttachmentDraft = {
  key: string;
  type: "link" | "image";
  url: string;
};

export type DeliverableFormValues = {
  campaignId: string;
  title: string;
  description: string;
  attachments: AttachmentDraft[];
};

export type DeliverableInput =
  | { kind: "create"; campaignId: number; content: DeliverableWrite }
  | { kind: "edit"; changes: Partial<DeliverableWrite> };

const attachmentTypeOptions: SelectOption[] = [
  { value: "link", label: "Link" },
  { value: "image", label: "Image" },
];

type FormErrors = {
  campaignId?: string;
  title?: string;
  description?: string;
  attachmentRows?: Record<string, string>;
};

function attachmentUrlError(url: string) {
  if (!url) return "Enter a URL.";
  if (Array.from(url).length > 500) return "Use a URL of 500 characters or fewer.";
  if (!/^https?:\/\/\S+$/.test(url)) return "Enter an http or https URL.";
  try {
    new URL(url);
  } catch {
    return "Enter an http or https URL.";
  }
  return "";
}

function normalizeContent(values: DeliverableFormValues): DeliverableWrite {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    attachments: values.attachments.map(({ type, url }) => ({ attachment_type: type, url: url.trim() })),
  };
}

function prepareInput(values: DeliverableFormValues, campaigns?: SelectOption[], original?: DeliverableFormValues) {
  const errors: FormErrors = {};
  if (campaigns && !campaigns.some((option) => option.value === values.campaignId)) {
    errors.campaignId = campaigns.length === 0 ? "No campaign is available." : "Choose a campaign.";
  }
  const content = normalizeContent(values);
  const previous = original ? normalizeContent(original) : null;
  const changes: Partial<DeliverableWrite> = {};

  if (!previous || content.title !== previous.title) {
    changes.title = content.title;
    if (!content.title) errors.title = "Enter a title.";
    else if (previous && Array.from(content.title).length > 200) {
      errors.title = "Use a title of 200 characters or fewer.";
    }
  }
  if (previous && content.description !== previous.description) {
    changes.description = content.description;
    if (Array.from(content.description ?? "").length > 5000) {
      errors.description = "Use a description of 5,000 characters or fewer.";
    }
  }

  // The API replaces the whole list when attachments are included in a PATCH.
  const attachmentsChanged = !previous || content.attachments.length !== previous.attachments.length ||
    content.attachments.some(({ attachment_type, url }, index) =>
      attachment_type !== previous.attachments[index].attachment_type || url !== previous.attachments[index].url,
    );
  if (attachmentsChanged) {
    changes.attachments = content.attachments;
    const attachmentRows: Record<string, string> = {};
    content.attachments.forEach(({ url }, index) => {
      const message = attachmentUrlError(url);
      if (message) attachmentRows[values.attachments[index].key] = message;
    });
    if (Object.keys(attachmentRows).length > 0) errors.attachmentRows = attachmentRows;
  }

  const input: DeliverableInput = previous
    ? { kind: "edit", changes }
    : { kind: "create", campaignId: Number(values.campaignId), content };
  return { errors, input };
}

export function DeliverableForm({
  initialValues,
  campaigns,
  mode = "create",
  onSave,
  onSubmit,
  pending = null,
  error = "",
}: {
  initialValues: DeliverableFormValues;
  campaigns?: SelectOption[];
  mode?: "create" | "edit" | "revise";
  onSave: (input: DeliverableInput) => void;
  onSubmit: (input: DeliverableInput) => void;
  pending?: "save" | "submit" | null;
  error?: string;
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [nextKey, setNextKey] = useState(initialValues.attachments.length + 1);

  function update(next: DeliverableFormValues) {
    setValues(next);
    setErrors({});
  }

  function run(action: "save" | "submit") {
    if (pending) return;
    const { input, errors: nextErrors } = prepareInput(values, campaigns, mode === "create" ? undefined : initialValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (action === "save") onSave(input);
    else onSubmit(input);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        run("submit");
      }}
    >
      {campaigns && (
        <AppSelect
          label="Campaign"
          name="deliverable-campaign"
          value={values.campaignId}
          onChange={(campaignId) => update({ ...values, campaignId })}
          options={campaigns}
          placeholder="Choose a campaign"
          error={errors.campaignId}
        />
      )}

      <AppInput
        label="Title"
        name="deliverable-title"
        value={values.title}
        onChange={(title) => update({ ...values, title })}
        placeholder="Spring tasting reel"
        required={mode === "create"}
        error={errors.title}
      />

      <AppTextarea
        label="Description"
        name="deliverable-description"
        value={values.description}
        onChange={(description) => update({ ...values, description })}
        placeholder="What the business should review"
        rows={3}
        helper="Optional."
        error={errors.description}
      />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cg-text)]">Attachments</h3>
          <p className="text-sm">Add a link or image URL.</p>
        </div>

        {values.attachments.map((attachment, index) => (
          <div key={attachment.key} className="grid grid-cols-1 gap-3 md:grid-cols-[10rem_1fr_auto] md:items-end">
            <AppSelect
              label={`Attachment ${index + 1} type`}
              value={attachment.type}
              onChange={(type) => {
                if (type !== "link" && type !== "image") return;
                update({
                  ...values,
                  attachments: values.attachments.map((item) =>
                    item.key === attachment.key ? { ...item, type } : item,
                  ),
                });
              }}
              options={attachmentTypeOptions}
            />
            <AppInput
              label={`Attachment ${index + 1} URL`}
              value={attachment.url}
              onChange={(url) =>
                update({
                  ...values,
                  attachments: values.attachments.map((item) =>
                    item.key === attachment.key ? { ...item, url } : item,
                  ),
                })
              }
              placeholder="https://example.com/post"
              error={errors.attachmentRows?.[attachment.key]}
            />
            <AppButton
              type="button"
              variant="secondary"
              onPress={() =>
                update({
                  ...values,
                  attachments: values.attachments.filter((item) => item.key !== attachment.key),
                })
              }
            >
              Remove
            </AppButton>
          </div>
        ))}

        <AppButton
          type="button"
          variant="secondary"
          className="self-start"
          onPress={() => {
            const key = `attachment-${nextKey}`;
            setNextKey(nextKey + 1);
            update({
              ...values,
              attachments: [...values.attachments, { key, type: "link", url: "" }],
            });
          }}
        >
          Add link or image
        </AppButton>
      </div>

      {error && <AppNotice tone="error" message={error} />}

      <div className="flex flex-wrap gap-3">
        <AppButton
          type="button"
          variant="secondary"
          isDisabled={pending !== null}
          onPress={() => run("save")}
        >
          {pending === "save" ? "Saving..." : mode === "create" ? "Save draft" : "Save changes"}
        </AppButton>
        <AppButton type="button" isDisabled={pending !== null} onPress={() => run("submit")}>
          {pending === "submit" ? "Submitting..." : mode === "revise" ? "Resubmit" : "Submit"}
        </AppButton>
      </div>
    </form>
  );
}

export function DeliverableReview({
  deliverable,
  children,
  comment,
  onCommentChange,
  onApprove,
  onRequestRevision,
  blockedReason = "",
  disabled = false,
  pending = null,
}: {
  deliverable: DeliverableSummary;
  children?: ReactNode;
  comment: string;
  onCommentChange: (comment: string) => void;
  onApprove: () => void;
  onRequestRevision: () => void;
  blockedReason?: string;
  disabled?: boolean;
  pending?: "approve" | "revision" | null;
}) {
  const commentMissing = comment.trim().length === 0;
  const locked = Boolean(blockedReason) || disabled || pending !== null;

  return (
    <DeliverableCard deliverable={deliverable}>
      {children}
      <div className="flex flex-col gap-3 border-t border-[var(--cg-border)] pt-3">
        <AppTextarea
          label="Revision feedback"
          name={`revision-${deliverable.id}`}
          value={comment}
          onChange={onCommentChange}
          placeholder="What should the creator change?"
          rows={3}
          disabled={locked}
          helper="Required for a revision request. Approve can include this comment, and it can be left blank."
        />
        {blockedReason && <p className="text-sm">{blockedReason}</p>}
        <div className="flex flex-wrap gap-3">
          <AppButton
            isDisabled={locked}
            aria-label={`Approve ${deliverable.title}`}
            onPress={onApprove}
          >
            {pending === "approve" ? "Approving..." : "Approve"}
          </AppButton>
          <AppButton
            variant="secondary"
            isDisabled={locked || commentMissing}
            aria-label={`Request revision for ${deliverable.title}`}
            onPress={onRequestRevision}
          >
            {pending === "revision" ? "Requesting revision..." : "Request revision"}
          </AppButton>
        </div>
      </div>
    </DeliverableCard>
  );
}
