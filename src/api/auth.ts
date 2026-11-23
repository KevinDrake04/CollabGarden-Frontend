/// <reference types="vite/client" />

// Login: POST /auth/login returns access_token and user { id, email, role }.
// Signup: POST /auth/signup takes email, password, role, and business_name or display_name.
// A successful signup body may be empty, or it may include access_token and refresh_token.
// Tokens are read from that JSON body only. They are never written to a URL.
// Both login and signup open a session the same way: GET /auth/me must confirm the
// account before a Session is returned. The role on that Session comes from /auth/me.
// The OpenAPI document leaves the login and signup response schemas untyped.
// GET /auth/me is also untyped in OpenAPI and now returns the signed-in account:
// id, email, role, business_id, and business_ids.
// Creators receive null business identifiers. role is "business", "creator", or "admin".
// The browser copy of this session lives in src/pages/auth/session.ts.

export type AccountRole = "business" | "creator" | "admin";

export type Session = {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email: string;
  role: AccountRole;
  businessId: number | null;
  businessIds: number[] | null;
};

// signed-in: signup returned a token and /auth/me confirmed the account.
// created: the account exists, but no session could be opened from the response.
export type SignupResult =
  | { status: "signed-in"; session: Session }
  | { status: "created" };

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
  return value === "business" || value === "creator" || value === "admin" ? value : null;
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
  creatorId: number | null;
  displayName: string | null;
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

  let creatorId: number | null = null;
  if ("creator_id" in account && account.creator_id != null) {
    creatorId = integerId(account.creator_id);
  }
  const displayName = typeof account.display_name === "string" && account.display_name.trim()
    ? account.display_name.trim()
    : null;

  return { id, email, role, businessId, businessIds, creatorId, displayName };
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

function authPayload(body: unknown) {
  const record = isRecord(body) ? body : null;
  const accessToken = record && typeof record.access_token === "string" ? record.access_token : "";
  const refreshToken = record && typeof record.refresh_token === "string" ? record.refresh_token : "";
  const user = record && isRecord(record.user) ? record.user : null;
  const userId = user && typeof user.id === "string" ? user.id : "";
  const email = user && typeof user.email === "string" ? user.email : "";
  return { accessToken, refreshToken, user, userId, email };
}

// Confirm the access token with /auth/me, then build the same Session login stores.
// A refresh token is kept only after that confirmation. It is not required.
async function sessionFromTokens(input: {
  accessToken: string;
  refreshToken: string;
  fallbackEmail: string;
  expectedUserId: string;
}): Promise<Session> {
  const account = await fetchAccount(input.accessToken);
  if (input.expectedUserId && account.id !== input.expectedUserId) {
    throw new AuthError(200, "The account response did not match the signed-in user.");
  }

  const session: Session = {
    accessToken: input.accessToken,
    userId: account.id,
    email: account.email || input.fallbackEmail,
    role: account.role,
    businessId: account.businessId,
    businessIds: account.businessIds,
  };
  if (input.refreshToken) session.refreshToken = input.refreshToken;
  return session;
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${apiUrl()}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await readBody(response);
  if (!response.ok) throw new AuthError(response.status, errorMessage(response.status, body));

  const parsed = authPayload(body);
  if (!parsed.accessToken || !parsed.user || !parsed.userId) {
    throw new AuthError(response.status, "The login response did not include an access token and account.");
  }

  return sessionFromTokens({
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    fallbackEmail: parsed.email || email,
    expectedUserId: parsed.userId,
  });
}

export async function signup(input: {
  email: string;
  password: string;
  role: "business" | "creator";
  name: string;
}): Promise<SignupResult> {
  const payload: {
    email: string;
    password: string;
    role: "business" | "creator";
    business_name?: string;
    display_name?: string;
  } = {
    email: input.email,
    password: input.password,
    role: input.role,
  };
  if (input.role === "business") payload.business_name = input.name;
  else payload.display_name = input.name;

  const response = await fetch(`${apiUrl()}/auth/signup`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let body: unknown;
  try {
    body = await readBody(response);
  } catch (error) {
    if (response.ok) return { status: "created" };
    throw error;
  }
  if (!response.ok) throw new AuthError(response.status, errorMessage(response.status, body));

  const parsed = authPayload(body);
  if (!parsed.accessToken) return { status: "created" };

  try {
    const session = await sessionFromTokens({
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      fallbackEmail: parsed.email || input.email,
      expectedUserId: parsed.userId,
    });
    return { status: "signed-in", session };
  } catch {
    return { status: "created" };
  }
}
