/// <reference types="vite/client" />

// Login: POST /auth/login returns access_token and user { id, email, role }.
// The OpenAPI document leaves that response schema untyped.
// GET /auth/me is also untyped in OpenAPI and now returns the signed-in account:
// id, email, role, business_id, and business_ids.
// Creators receive null business identifiers. role is "business" or "creator".
// The browser copy of this session lives in src/pages/auth/session.ts.

export type AccountRole = "business" | "creator";

export type Session = {
  accessToken: string;
  userId: string;
  email: string;
  role: AccountRole;
  businessId: number | null;
  businessIds: number[] | null;
};

export class AuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function apiUrl() {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!url) throw new AuthError(0, "Missing VITE_API_URL in .env.local");
  return url;
}

function errorMessage(status: number, body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item) => {
        if (!item || typeof item !== "object" || typeof item.msg !== "string") return [];
        return item.msg.trim() ? [item.msg] : [];
      });
      if (messages.length > 0) return messages.join(" ");
    }
  }
  return `API request failed: ${status}`;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AuthError(response.status, `API request failed: ${response.status}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function roleOf(value: unknown): AccountRole | null {
  return value === "business" || value === "creator" ? value : null;
}

function integerId(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function accountRecord(body: unknown) {
  if (!isRecord(body)) return null;
  if ("role" in body || "business_id" in body || "business_ids" in body || "id" in body) return body;
  return isRecord(body.user) ? body.user : body;
}

export type AccountProfile = {
  id: string;
  email: string;
  role: AccountRole;
  businessId: number | null;
  businessIds: number[] | null;
};

export function parseAccount(body: unknown): AccountProfile {
  const account = accountRecord(body);
  if (!account) {
    throw new AuthError(200, "The account response did not include this user.");
  }

  const id = typeof account.id === "string" ? account.id : "";
  const email = typeof account.email === "string" ? account.email : "";
  const role = roleOf(account.role);
  if (!id || !role) {
    throw new AuthError(200, "The account response did not include an id and role.");
  }

  if ("business_id" in account && account.business_id != null && integerId(account.business_id) == null) {
    throw new AuthError(200, "The account response included an invalid business id.");
  }
  const businessId = integerId(account.business_id);

  let businessIds: number[] | null = null;
  if ("business_ids" in account && account.business_ids != null) {
    if (!Array.isArray(account.business_ids)) {
      throw new AuthError(200, "The account response included an invalid business list.");
    }
    businessIds = account.business_ids.map((item) => {
      const idValue = integerId(item);
      if (idValue == null) {
        throw new AuthError(200, "The account response included an invalid business id.");
      }
      return idValue;
    });
  }

  return { id, email, role, businessId, businessIds };
}

// Ids the account is allowed to use. Nothing is added that /auth/me did not return.
export function verifiedBusinessIds(account: {
  businessId: number | null;
  businessIds: number[] | null;
}) {
  const ids: number[] = [];
  const seen = new Set<number>();
  const add = (id: number | null) => {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  if (account.businessIds) {
    for (const id of account.businessIds) add(id);
  }
  add(account.businessId);
  return ids;
}

export async function fetchAccount(token: string, signal?: AbortSignal) {
  const response = await fetch(`${apiUrl()}/auth/me`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    signal,
  });
  const body = await readBody(response);
  if (!response.ok) throw new AuthError(response.status, errorMessage(response.status, body));
  return parseAccount(body);
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${apiUrl()}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await readBody(response);
  if (!response.ok) throw new AuthError(response.status, errorMessage(response.status, body));

  const record = isRecord(body) ? body : null;
  const token = record && typeof record.access_token === "string" ? record.access_token : "";
  const user = record && isRecord(record.user) ? record.user : null;
  const userId = user && typeof user.id === "string" ? user.id : "";
  const userEmail = user && typeof user.email === "string" ? user.email : email;
  if (!token || !user || !userId) {
    throw new AuthError(response.status, "The login response did not include an access token and account.");
  }

  const account = await fetchAccount(token);
  if (account.id !== userId) {
    throw new AuthError(200, "The account response did not match the signed-in user.");
  }

  return {
    accessToken: token,
    userId: account.id,
    email: account.email || userEmail,
    role: account.role,
    businessId: account.businessId,
    businessIds: account.businessIds,
  };
}
