/// <reference types="vite/client" />

import { verifiedBusinessIds, type Session } from "./auth";

// Callers pass a session. Requests send its access token, and a 401 is returned
// to the caller. A business only loads deliverables for its verified business ids.

export type AttachmentType = "link" | "image";
export type CampaignStatus = "draft" | "open" | "closed";
export type OfferType = "gifted" | "dining" | "paid";

export type Attachment = {
  attachment_id?: number;
  attachment_type: AttachmentType;
  url: string;
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
};

type DeliverableWrite = {
  title: string;
  description: string | null;
  attachments: { attachment_type: AttachmentType; url: string }[];
};

export type Campaign = {
  campaign_id: number;
  business_id: number;
  name: string;
  description: string | null;
  status: CampaignStatus;
  offer_type: OfferType | null;
  starts_on: string | null;
  ends_on: string | null;
  county_ids: number[];
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

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function collaborationErrorMessage(error: unknown) {
  if (error instanceof CollaborationApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not load deliverables.";
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
  if ((type !== "link" && type !== "image") || typeof value.url !== "string" || !value.url.trim()) {
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
  };
}

function parseCampaign(value: unknown): Campaign | null {
  if (!isRecord(value)) return null;
  const campaignId = value.campaign_id;
  const businessId = value.business_id;
  const name = value.name;
  const status = value.status;
  if (typeof campaignId !== "number" || !Number.isInteger(campaignId)) return null;
  if (typeof businessId !== "number" || !Number.isInteger(businessId)) return null;
  if (typeof name !== "string" || !name.trim()) return null;
  if (status !== "draft" && status !== "open" && status !== "closed") return null;

  const offer = value.offer_type;
  return {
    campaign_id: campaignId,
    business_id: businessId,
    name,
    description: optionalText(value.description),
    status,
    offer_type: offer === "gifted" || offer === "dining" || offer === "paid" ? offer : null,
    starts_on: optionalText(value.starts_on),
    ends_on: optionalText(value.ends_on),
    county_ids: Array.isArray(value.county_ids)
      ? value.county_ids.filter((id): id is number => typeof id === "number" && Number.isInteger(id))
      : [],
  };
}

async function listCampaigns(token: string, signal?: AbortSignal) {
  const body = await request("/api/v1/campaigns", { token, signal });
  if (!Array.isArray(body)) {
    throw new CollaborationApiError(200, "Campaign list was not in the expected format.");
  }
  const campaigns = body.flatMap((item) => {
    const campaign = parseCampaign(item);
    return campaign ? [campaign] : [];
  });
  if (body.length > 0 && campaigns.length === 0) {
    throw new CollaborationApiError(200, "Campaign list was not in the expected format.");
  }
  return campaigns;
}

async function listCreatorNames(signal?: AbortSignal) {
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

export async function loadCollaborationWorkspace(
  session: Session,
  signal?: AbortSignal,
  options?: { includeCreatorNames?: boolean },
) {
  if (session.role === "business" && verifiedBusinessIds(session).length === 0) {
    return {
      session,
      access: [],
      creatorNames: {},
    };
  }

  const includeCreatorNames = options?.includeCreatorNames !== false;
  const [campaigns, creatorNames] = await Promise.all([
    listCampaigns(session.accessToken, signal),
    includeCreatorNames ? listCreatorNames(signal) : Promise.resolve({}),
  ]);
  const probed = await Promise.all(
    campaignsForAccount(campaigns, session).map((campaign) =>
      loadCampaign(campaign, session.accessToken, session.role, signal),
    ),
  );
  const workspace: CollaborationWorkspace = {
    session,
    access: probed.filter((entry): entry is CampaignAccess => entry !== null),
    creatorNames,
  };
  return workspace;
}

export function createDeliverable(
  campaignId: number,
  input: DeliverableWrite,
  token: string,
  signal?: AbortSignal,
) {
  const description = input.description?.trim() ?? "";
  const body: {
    title: string;
    description?: string;
    attachments: DeliverableWrite["attachments"];
  } = {
    title: input.title.trim(),
    attachments: input.attachments
      .map((attachment) => ({
        attachment_type: attachment.attachment_type,
        url: attachment.url.trim(),
      }))
      .filter((attachment) => attachment.url),
  };
  if (description) body.description = description;

  return request(`/api/v1/campaigns/${campaignId}/deliverables`, {
    method: "POST",
    body,
    token,
    signal,
  }).then(parseDeliverable);
}

export function submitDeliverable(deliverableId: number, token: string, signal?: AbortSignal) {
  return request(`/api/v1/deliverables/${deliverableId}/submit`, {
    method: "POST",
    token,
    signal,
  }).then(parseDeliverable);
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
