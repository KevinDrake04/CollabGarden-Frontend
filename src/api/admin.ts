/// <reference types="vite/client" />

// Administrator contract from the production OpenAPI document.
// Bearer token required:
// GET   /api/v1/admin/accounts?status=pending|approved|suspended
// GET   /api/v1/admin/waitlist
// PATCH /api/v1/admin/waitlist/{founding_member_id}
// GET   /api/v1/admin/campaigns
// PATCH /api/v1/admin/businesses/{business_id}
// PATCH /api/v1/admin/creators/{creator_id}
// GET   /auth/me
// Public display data: GET /api/v1/businesses
// There is no administrator statistics route. Campaign create and update
// are not administrator routes and are not called here.

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export type AccountStatus = "pending" | "approved" | "suspended";
export type AccountType = "business" | "creator";

export type AccountSummary = {
  account_type: AccountType;
  account_id: number;
  name: string;
  status: AccountStatus;
};

export type CampaignStatus = "draft" | "open" | "closed";

export type CampaignRecord = {
  campaign_id: number;
  business_id: number;
  name: string;
  description: string | null;
  status: string;
  offer_type: string | null;
  starts_on: string | null;
  ends_on: string | null;
  county_ids: number[];
};

export type WaitlistStatus = "waiting" | "invited" | "active" | "rejected";

export type WaitlistEntry = {
  founding_member_id: number;
  role: string;
  name: string | null;
  owner_name: string | null;
  email: string | null;
  county_id: number | null;
  link: string | null;
  niche_or_category: string | null;
  status: string | null;
  review_note: string | null;
  invited_at: string | null;
  activated_at: string | null;
  created_at: string | null;
};

export type WaitlistSort = "created_at" | "name" | "status" | "county_id";

export type WaitlistQuery = {
  role?: "creator" | "business";
  status?: string;
  county_id?: number;
  sort_by?: WaitlistSort;
  descending?: boolean;
};

export type CampaignQuery = {
  county_id?: number;
  status?: CampaignStatus;
  starts_after?: string;
  ends_before?: string;
};

export type CurrentAccount = {
  id: string | null;
  email: string | null;
  role: string | null;
};

export type BusinessName = {
  business_id: number;
  name: string;
};

export function messageFromApiBody(status: number, body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item) => {
        if (!item || typeof item !== "object" || !("msg" in item)) return [];
        const record = item as { msg: unknown; loc?: unknown };
        if (typeof record.msg !== "string" || !record.msg.trim()) return [];
        const loc = Array.isArray(record.loc)
          ? record.loc
              .filter((part) => part !== "body" && part !== "query" && part !== "path")
              .join(".")
          : "";
        return [loc ? `${loc}: ${record.msg}` : record.msg];
      });
      if (messages.length > 0) return messages.join(" ");
    }
  }
  if (status === 401) return "Not authenticated";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 0) return "The administrator API could not be reached.";
  return `API request failed: ${status}`;
}

function apiUrl() {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!url) throw new AdminApiError(0, "Missing VITE_API_URL in .env.local");
  return url;
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function toQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      ...init,
      headers,
      credentials: "omit",
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new AdminApiError(0, "The administrator API could not be reached.");
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new AdminApiError(response.status, messageFromApiBody(response.status, body));
  }
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function optionalText(value: unknown) {
  if (value == null) return null;
  return typeof value === "string" ? value : null;
}

function integerList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => Number.isInteger(item));
}

function requireId(id: number, label: string) {
  if (!Number.isInteger(id) || id < 1) {
    throw new AdminApiError(0, `A valid ${label} is required.`);
  }
  return String(id);
}

function parseList<T>(body: unknown, label: string, parse: (value: unknown) => T | null) {
  if (!Array.isArray(body)) {
    throw new AdminApiError(0, `The administrator API returned an unexpected ${label} list.`);
  }
  const parsed = body.map(parse);
  if (body.length > 0 && parsed.every((item) => item == null)) {
    throw new AdminApiError(0, `The administrator API returned ${label} records in an unexpected shape.`);
  }
  return parsed.filter((item): item is T => item != null);
}

const accountStatuses = new Set<AccountStatus>(["pending", "approved", "suspended"]);

function parseAccount(value: unknown): AccountSummary | null {
  if (!isRecord(value)) return null;
  const accountId = integer(value.account_id);
  const name = text(value.name);
  const accountType = value.account_type === "business" || value.account_type === "creator"
    ? value.account_type
    : null;
  const status = typeof value.status === "string" && accountStatuses.has(value.status as AccountStatus)
    ? (value.status as AccountStatus)
    : null;
  if (accountId == null || name == null || !accountType || !status) return null;
  return {
    account_id: accountId,
    account_type: accountType,
    name,
    status,
  };
}

function parseCampaign(value: unknown): CampaignRecord | null {
  if (!isRecord(value)) return null;
  const campaignId = integer(value.campaign_id);
  const businessId = integer(value.business_id);
  const name = text(value.name);
  const status = text(value.status);
  if (campaignId == null || businessId == null || name == null || !status) return null;
  return {
    campaign_id: campaignId,
    business_id: businessId,
    name,
    description: optionalText(value.description),
    status,
    offer_type: optionalText(value.offer_type),
    starts_on: optionalText(value.starts_on),
    ends_on: optionalText(value.ends_on),
    county_ids: integerList(value.county_ids),
  };
}

function parseWaitlist(value: unknown): WaitlistEntry | null {
  if (!isRecord(value)) return null;
  const id = integer(value.founding_member_id);
  const role = text(value.role);
  if (id == null || role == null) return null;
  return {
    founding_member_id: id,
    role,
    name: optionalText(value.name),
    owner_name: optionalText(value.owner_name),
    email: optionalText(value.email),
    county_id: value.county_id == null ? null : integer(value.county_id),
    link: optionalText(value.link),
    niche_or_category: optionalText(value.niche_or_category),
    status: optionalText(value.status),
    review_note: optionalText(value.review_note),
    invited_at: optionalText(value.invited_at),
    activated_at: optionalText(value.activated_at),
    created_at: optionalText(value.created_at),
  };
}

export async function listAccounts(
  token: string | null,
  status: AccountStatus,
  signal: AbortSignal,
) {
  const body = await request(`/api/v1/admin/accounts?status=${status}`, token, { signal });
  return parseList(body, "account", parseAccount);
}

export async function listWaitlist(
  token: string | null,
  query: WaitlistQuery,
  signal: AbortSignal,
) {
  const body = await request(`/api/v1/admin/waitlist${toQuery({ ...query })}`, token, { signal });
  return parseList(body, "waitlist", parseWaitlist);
}

export async function listAdminCampaigns(
  token: string | null,
  query: CampaignQuery,
  signal: AbortSignal,
) {
  const body = await request(`/api/v1/admin/campaigns${toQuery({ ...query })}`, token, { signal });
  return parseList(body, "campaign", parseCampaign);
}

export async function getAccount(token: string, signal: AbortSignal): Promise<CurrentAccount> {
  const body = await request("/auth/me", token, { signal });
  const record = isRecord(body) ? body : {};
  const user = isRecord(record.user) ? record.user : record;
  return {
    id: text(user.id),
    email: text(user.email),
    role: text(user.role),
  };
}

export async function listBusinessNames(signal: AbortSignal): Promise<BusinessName[]> {
  const body = await request("/api/v1/businesses", null, { signal });
  return parseList(body, "business", (value) => {
    if (!isRecord(value)) return null;
    const id = integer(value.business_id);
    const name = text(value.name);
    if (id == null || name == null) return null;
    return { business_id: id, name };
  });
}

export async function setAccountStatus(
  token: string,
  account: AccountSummary,
  status: AccountStatus,
) {
  if (!token.trim()) throw new AdminApiError(401, "Not authenticated");
  const path = account.account_type === "business"
    ? `/api/v1/admin/businesses/${requireId(account.account_id, "business id")}`
    : `/api/v1/admin/creators/${requireId(account.account_id, "creator id")}`;
  await request(path, token, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function updateWaitlistEntry(
  token: string,
  foundingMemberId: number,
  update: { status?: WaitlistStatus; review_note?: string },
) {
  if (!token.trim()) throw new AdminApiError(401, "Not authenticated");
  const body: { status?: WaitlistStatus; review_note?: string } = {};
  if (update.status) body.status = update.status;
  if (update.review_note) body.review_note = update.review_note;
  if (!body.status && !body.review_note) {
    throw new AdminApiError(0, "Choose a waitlist status or enter a review note.");
  }
  await request(`/api/v1/admin/waitlist/${requireId(foundingMemberId, "founding member id")}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
