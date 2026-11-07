/// <reference types="vite/client" />

// Campaign contract from the CollabGarden OpenAPI spec.
// POST /api/v1/campaigns requires a bearer token. The body needs business_id
// and name. Status is not part of create.
// PATCH /api/v1/campaigns/{campaign_id} can set status to draft, open, or closed.
// Publishing means status "open". There is no "published" status.
// GET /api/v1/campaigns?status=open is the public discovery list.

export type OfferType = "gifted" | "dining" | "paid";
export type CampaignStatus = "draft" | "open" | "closed";

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

export type CampaignInput = {
  name: string;
  description: string;
  offer_type: OfferType;
  starts_on: string;
  ends_on: string;
  county_ids: number[];
};

export type BusinessSummary = {
  business_id: number;
  name: string;
  logo_url: string | null;
};

export class CampaignApiError extends Error {
  readonly status: number;
  readonly campaign?: Campaign;

  constructor(status: number, message: string, campaign?: Campaign) {
    super(message);
    this.name = "CampaignApiError";
    this.status = status;
    this.campaign = campaign;
  }
}

type RequestOptions = {
  method?: string;
  body?: string;
  token?: string | null;
  signal?: AbortSignal;
};

function baseUrl() {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!url) throw new CampaignApiError(0, "Missing VITE_API_URL in .env.local");
  return url;
}

function errorMessage(status: number, body: unknown) {
  if (!body || typeof body !== "object" || !("detail" in body)) {
    return `API request failed: ${status}`;
  }

  const detail = body.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (!item || typeof item !== "object" || !("msg" in item)) return [];
      if (typeof item.msg !== "string" || !item.msg.trim()) return [];
      return [item.msg];
    });
    if (messages.length > 0) return messages.join(" ");
  }

  return `API request failed: ${status}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? "GET",
    body: options.body,
    headers,
    signal: options.signal,
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new CampaignApiError(response.status, `API request failed: ${response.status}`);
    }
  }

  if (!response.ok) {
    throw new CampaignApiError(response.status, errorMessage(response.status, body));
  }

  return body as T;
}

function campaignBody(input: CampaignInput, businessId?: number) {
  return {
    ...(businessId == null ? {} : { business_id: businessId }),
    name: input.name,
    description: input.description,
    offer_type: input.offer_type,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    county_ids: input.county_ids,
  };
}

export function listOpenCampaigns(signal: AbortSignal) {
  return request<Campaign[]>("/api/v1/campaigns?status=open", { signal }).then(
    (campaigns) => campaigns.filter((campaign) => campaign.status === "open"),
  );
}

export function getBusinesses(signal: AbortSignal) {
  return request<BusinessSummary[]>("/api/v1/businesses", { signal });
}

export function createCampaign(
  input: CampaignInput,
  businessId: number,
  token: string,
  signal?: AbortSignal,
) {
  return request<Campaign>("/api/v1/campaigns", {
    method: "POST",
    body: JSON.stringify(campaignBody(input, businessId)),
    token,
    signal,
  });
}

export function updateCampaign(
  campaignId: number,
  input: Partial<CampaignInput> & { status?: CampaignStatus },
  token: string,
  signal?: AbortSignal,
) {
  return request<Campaign>(`/api/v1/campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
    token,
    signal,
  });
}

// Create sends no status. The follow-up update sets draft or open when the
// created campaign comes back with a different status.
export async function submitCampaign(options: {
  input: CampaignInput;
  target: Extract<CampaignStatus, "draft" | "open">;
  token: string | null;
  businessId: number | null;
  campaignId: number | null;
  signal?: AbortSignal;
}) {
  const { input, target, token, businessId, campaignId, signal } = options;

  if (!token || businessId == null) {
    throw new CampaignApiError(401, "Sign in with a business account before saving a campaign.");
  }

  if (campaignId != null) {
    return updateCampaign(campaignId, { ...input, status: target }, token, signal);
  }

  const created = await createCampaign(input, businessId, token, signal);
  if (created.status === target) return created;

  try {
    return await updateCampaign(created.campaign_id, { status: target }, token, signal);
  } catch (error) {
    if (error instanceof CampaignApiError) {
      throw new CampaignApiError(error.status, error.message, created);
    }
    throw error;
  }
}
