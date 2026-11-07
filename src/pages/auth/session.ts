import { AuthError, fetchAccount, roleOf, type AccountRole, type Session } from "../../api/auth";

const storageKey = "collabgarden.session";
const sessionEvent = "collabgarden-session";

export type { AccountRole, Session };

function storedBusinessId(value: Partial<Session>) {
  return typeof value.businessId === "number" && Number.isInteger(value.businessId)
    ? value.businessId
    : null;
}

function storedBusinessIds(value: Partial<Session>) {
  if (!Object.prototype.hasOwnProperty.call(value, "businessIds") || value.businessIds == null) {
    return null;
  }
  if (!Array.isArray(value.businessIds)) return null;
  if (!value.businessIds.every((id) => typeof id === "number" && Number.isInteger(id))) return null;
  return value.businessIds;
}

function notify() {
  window.dispatchEvent(new Event(sessionEvent));
}

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    const role = roleOf(parsed.role);
    if (!parsed.accessToken || !parsed.userId || !parsed.email || !role) return null;
    return {
      accessToken: parsed.accessToken,
      userId: parsed.userId,
      email: parsed.email,
      role,
      businessId: storedBusinessId(parsed),
      businessIds: storedBusinessIds(parsed),
    };
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  sessionStorage.setItem(storageKey, JSON.stringify(session));
  notify();
}

export function clearSession() {
  sessionStorage.removeItem(storageKey);
  notify();
}

export function watchSession(onChange: () => void) {
  window.addEventListener(sessionEvent, onChange);
  return () => window.removeEventListener(sessionEvent, onChange);
}

function sameSession(left: Session, right: Session) {
  return left.accessToken === right.accessToken
    && left.userId === right.userId
    && left.email === right.email
    && left.role === right.role
    && left.businessId === right.businessId
    && JSON.stringify(left.businessIds) === JSON.stringify(right.businessIds);
}

// Reload role and business membership from /auth/me into the same stored session.
// An expired token clears that session. Other failures leave it in place.
export async function refreshSession(signal?: AbortSignal): Promise<Session | null> {
  const current = readSession();
  if (!current) return null;

  try {
    const account = await fetchAccount(current.accessToken, signal);
    const next: Session = {
      accessToken: current.accessToken,
      userId: account.id,
      email: account.email || current.email,
      role: account.role,
      businessId: account.businessId,
      businessIds: account.businessIds,
    };
    if (!sameSession(current, next)) writeSession(next);
    return next;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof AuthError && error.status === 401) {
      clearSession();
      return null;
    }
    throw error;
  }
}
