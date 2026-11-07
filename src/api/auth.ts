/// <reference types="vite/client" />

// Login: POST /auth/login returns access_token, refresh_token, token_type "bearer",
// and user { id, email, role } where role is "business" or "creator".
// GET /auth/me returns { id, email }. Neither response includes business_id.
// The browser copy of this session lives in src/pages/auth/session.ts.

export type AccountRole = "business" | "creator";

export type Session = {
  accessToken: string;
  userId: string;
  email: string;
  role: AccountRole;
  businessId: number | null;
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

function roleOf(value: unknown): AccountRole | null {
  return value === "business" || value === "creator" ? value : null;
}

function businessIdOf(value: unknown) {
  if (!value || typeof value !== "object" || !("business_id" in value)) return null;
  const businessId = value.business_id;
  return typeof businessId === "number" && Number.isInteger(businessId) ? businessId : null;
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${apiUrl()}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await readBody(response);
  if (!response.ok) throw new AuthError(response.status, errorMessage(response.status, body));

  const record = body && typeof body === "object" ? body : null;
  const token = record && "access_token" in record && typeof record.access_token === "string"
    ? record.access_token
    : "";
  const user = record && "user" in record && record.user && typeof record.user === "object"
    ? record.user
    : null;
  const role = user && "role" in user ? roleOf(user.role) : null;
  const userId = user && "id" in user && typeof user.id === "string" ? user.id : "";
  const userEmail = user && "email" in user && typeof user.email === "string" ? user.email : email;
  if (!token || !user || !role || !userId) {
    throw new AuthError(response.status, "The login response did not include an access token and account role.");
  }

  const accountResponse = await fetch(`${apiUrl()}/auth/me`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const account = await readBody(accountResponse);
  if (!accountResponse.ok) {
    throw new AuthError(accountResponse.status, errorMessage(accountResponse.status, account));
  }
  const accountId = account && typeof account === "object" && "id" in account && typeof account.id === "string"
    ? account.id
    : "";
  if (accountId !== userId) {
    throw new AuthError(accountResponse.status, "The account response did not match the signed-in user.");
  }

  const accountEmail = account && typeof account === "object" && "email" in account && typeof account.email === "string"
    ? account.email
    : userEmail;

  return {
    accessToken: token,
    userId,
    email: accountEmail,
    role,
    businessId: businessIdOf(user) ?? businessIdOf(account),
  };
}
