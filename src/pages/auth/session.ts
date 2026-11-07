import type { AccountRole, Session } from "../../api/auth";

const storageKey = "collabgarden.session";
const sessionEvent = "collabgarden-session";

export type { AccountRole, Session };

function roleOf(value: unknown): AccountRole | null {
  return value === "business" || value === "creator" ? value : null;
}

function storedBusinessId(value: Partial<Session>) {
  return typeof value.businessId === "number" && Number.isInteger(value.businessId)
    ? value.businessId
    : null;
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
