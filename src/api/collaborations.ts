/// <reference types="vite/client" />

import { verifiedBusinessIds, type Session } from "./auth";
import { listCampaigns, type Campaign } from "./campaigns";

// Callers pass a session. Requests send its access token, and a 401 is returned
// to the caller. A business only loads deliverables for its verified business ids.

type AttachmentType = "link" | "image";

type Attachment = {
  attachment_id?: number;
  attachment_type: AttachmentType;
  url: string;
};

export type DeliverableFeedback = {
  feedback_id: number;
  feedback_type: "approval" | "revision_request";
  comment?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
};

export type Deliverable = {
  deliverable_id: number;
  campaign_id: number;
  creator_id: number;
  title: string;
  description: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  attachments: Attachment[];
  latest_feedback?: DeliverableFeedback | null;
};

export type DeliverableWrite = {
  title: string;
  description: string | null;
  attachments: { attachment_type: AttachmentType; url: string }[];
};

export type CampaignAccess = {
  campaign: Campaign;
  deliverables: Deliverable[];
  error: string | null;
};

export type CollaborationWorkspace = {
  session: Session;
  access: CampaignAccess[];
  creatorNames: Record<number, string>;
};

export class CollaborationApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CollaborationApiError";
    this.status = status;
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function collaborationErrorMessage(error: unknown) {
  if (error instanceof CollaborationApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not load deliverables.";
}

export function isUncertainDeliverableWrite(error: unknown) {
  return !(error instanceof CollaborationApiError) || error.status === 0 || error.status === 408 ||
    error.status >= 500 || (error.status >= 200 && error.status < 300);
}

function baseUrl() {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!url) throw new CollaborationApiError(0, "Missing VITE_API_URL in .env.local");
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function errorMessage(status: number, body: unknown) {
  if (isRecord(body) && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item) => {
        if (!isRecord(item) || typeof item.msg !== "string" || !item.msg.trim()) return [];
        const loc = Array.isArray(item.loc)
          ? item.loc.filter((part) => typeof part === "string" || typeof part === "number").join(".")
          : "";
        return [loc ? `${loc}: ${item.msg}` : item.msg];
      });
      if (messages.length > 0) return messages.join(" ");
    }
  }
  if (status === 401) return "Not authenticated";
  return `API request failed: ${status}`;
}

async function request(path: string, options: {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
} = {}) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new CollaborationApiError(0, "Could not reach the CollabGarden API.");
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new CollaborationApiError(response.status, `API request failed: ${response.status}`);
    }
  }
  if (!response.ok) {
    throw new CollaborationApiError(response.status, errorMessage(response.status, body));
  }
  return body;
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseAttachment(value: unknown): Attachment | null {
  if (!isRecord(value)) return null;
  const type = value.attachment_type;
  if ((type !== "link" && type !== "image") || typeof value.url !== "string") {
    return null;
  }
  return {
    attachment_type: type,
    url: value.url,
    ...(typeof value.attachment_id === "number" ? { attachment_id: value.attachment_id } : {}),
  };
}

function parseDeliverable(value: unknown): Deliverable {
  if (
    !isRecord(value) ||
    typeof value.deliverable_id !== "number" ||
    typeof value.campaign_id !== "number" ||
    typeof value.creator_id !== "number" ||
    typeof value.title !== "string" ||
    typeof value.status !== "string" ||
    !value.status
  ) {
    throw new CollaborationApiError(200, "The API response did not include a deliverable.");
  }

  return {
    deliverable_id: value.deliverable_id,
    campaign_id: value.campaign_id,
    creator_id: value.creator_id,
    title: value.title,
    description: optionalText(value.description),
    status: value.status,
    submitted_at: optionalText(value.submitted_at),
    created_at: optionalText(value.created_at),
    updated_at: optionalText(value.updated_at),
    attachments: Array.isArray(value.attachments)
      ? value.attachments.flatMap((item) => {
          const attachment = parseAttachment(item);
          return attachment ? [attachment] : [];
        })
      : [],
    latest_feedback: value.latest_feedback as Deliverable["latest_feedback"],
  };
}

export async function listCreatorNames(signal: AbortSignal) {
  try {
    const body = await request("/api/v1/creators", { signal });
    const names: Record<number, string> = {};
    if (!Array.isArray(body)) return names;
    for (const creator of body) {
      if (!isRecord(creator) || typeof creator.creator_id !== "number") continue;
      if (typeof creator.display_name !== "string" || !creator.display_name.trim()) continue;
      names[creator.creator_id] = creator.display_name;
    }
    return names;
  } catch (error) {
    if (isAbortError(error)) throw error;
    return {};
  }
}

function campaignsForAccount(campaigns: Campaign[], session: Session) {
  if (session.role !== "business") return campaigns;
  const allowed = new Set(verifiedBusinessIds(session));
  return campaigns.filter((campaign) => allowed.has(campaign.business_id));
}

async function loadCampaign(
  campaign: Campaign,
  token: string,
  role: Session["role"],
  signal?: AbortSignal,
): Promise<CampaignAccess | null> {
  try {
    const body = await request(`/api/v1/campaigns/${campaign.campaign_id}/deliverables`, { token, signal });
    if (!Array.isArray(body)) {
      return {
        campaign,
        deliverables: [],
        error: "Deliverable list was not in the expected format.",
      };
    }
    return { campaign, deliverables: body.map(parseDeliverable), error: null };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (!(error instanceof CollaborationApiError)) throw error;
    if (error.status === 401) throw error;
    if (role !== "business" && (error.status === 403 || error.status === 404)) return null;
    return { campaign, deliverables: [], error: error.message };
  }
}

export async function loadCampaignDeliverables(
  campaigns: Campaign[],
  session: Session,
  signal?: AbortSignal,
) {
  const access = await Promise.all(campaignsForAccount(campaigns, session).map((campaign) =>
    loadCampaign(campaign, session.accessToken, session.role, signal),
  ));
  return access.filter((entry): entry is CampaignAccess => entry !== null);
}

export async function loadCreatorCampaignDeliverables(session: Session, signal: AbortSignal) {
  const campaigns = await listCampaigns({ token: session.accessToken, signal, cache: "no-store" });
  return loadCampaignDeliverables(campaigns, session, signal);
}

export async function createDeliverable(
  campaignId: number,
  input: DeliverableWrite,
  token: string,
  signal?: AbortSignal,
) {
  const created = parseDeliverable(await request(`/api/v1/campaigns/${campaignId}/deliverables`, {
    method: "POST",
    body: { ...input, description: input.description ?? undefined },
    token,
    signal,
  }));
  if (created.campaign_id !== campaignId || created.status !== "draft") {
    throw new CollaborationApiError(201, "Couldn't confirm the saved draft.");
  }
  return created;
}

export async function submitDeliverable(deliverableId: number, token: string) {
  const submitted = parseDeliverable(await request(`/api/v1/deliverables/${deliverableId}/submit`, {
    method: "POST",
    token,
  }));
  if (submitted.deliverable_id !== deliverableId || submitted.status !== "submitted") {
    throw new CollaborationApiError(200, "Couldn't confirm the submission.");
  }
  return submitted;
}

export function getDeliverable(deliverableId: number, token: string) {
  return request(`/api/v1/deliverables/${deliverableId}`, { token }).then(parseDeliverable);
}

export async function updateDeliverable(
  deliverableId: number,
  input: Partial<DeliverableWrite>,
  token: string,
) {
  const updated = parseDeliverable(await request(`/api/v1/deliverables/${deliverableId}`, {
    method: "PATCH",
    body: input,
    token,
  }));
  if (updated.deliverable_id !== deliverableId) {
    throw new CollaborationApiError(200, "Couldn't confirm the deliverable changes.");
  }
  return updated;
}

export async function listDeliverableFeedback(deliverableId: number, token: string) {
  const body = await request(`/api/v1/deliverables/${deliverableId}/feedback`, { token });
  if (!Array.isArray(body)) {
    throw new CollaborationApiError(200, "Feedback history was not in the expected format.");
  }
  return body as DeliverableFeedback[];
}

export function approveDeliverable(
  deliverableId: number,
  comment: string,
  token: string,
  signal?: AbortSignal,
) {
  const trimmed = comment.trim();
  return request(`/api/v1/deliverables/${deliverableId}/approve`, {
    method: "POST",
    body: trimmed ? { comment: trimmed } : undefined,
    token,
    signal,
  }).then(parseDeliverable);
}

export function requestRevision(
  deliverableId: number,
  comment: string,
  token: string,
  signal?: AbortSignal,
) {
  return request(`/api/v1/deliverables/${deliverableId}/revision-requests`, {
    method: "POST",
    body: { comment: comment.trim() },
    token,
    signal,
  }).then(parseDeliverable);
}

const countedStatuses = ["draft", "submitted", "approved", "revision_requested"] as const;

type CountedDeliverableStatus = (typeof countedStatuses)[number];

export function deliverableStatusCounts(access: CampaignAccess[]) {
  const counts: Record<CountedDeliverableStatus, number> = {
    draft: 0,
    submitted: 0,
    approved: 0,
    revision_requested: 0,
  };
  for (const entry of access) {
    if (entry.error) continue;
    for (const deliverable of entry.deliverables) {
      if (
        deliverable.status === "draft"
        || deliverable.status === "submitted"
        || deliverable.status === "approved"
        || deliverable.status === "revision_requested"
      ) {
        counts[deliverable.status] += 1;
      }
    }
  }
  return counts;
}

export function upsertDeliverable(access: CampaignAccess[], deliverable: Deliverable) {
  return access.map((entry) => {
    if (entry.campaign.campaign_id !== deliverable.campaign_id) return entry;
    const exists = entry.deliverables.some((item) => item.deliverable_id === deliverable.deliverable_id);
    const deliverables = exists
      ? entry.deliverables.map((item) =>
          item.deliverable_id === deliverable.deliverable_id ? deliverable : item,
        )
      : [deliverable, ...entry.deliverables];
    return { ...entry, deliverables };
  });
}
