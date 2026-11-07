// This branch does not sign administrators in.
// The login work stores a session at sessionStorage "collabgarden.session"
// with accessToken, email, and role ("business" or "creator"). When that
// session exists, administrator requests send Authorization: Bearer.
// Business and creator roles cannot send administrator changes. Any other
// token is treated as an administrator only after the admin list endpoints accept it.

const storageKey = "collabgarden.session";
const sessionEvent = "collabgarden-session";

export type StoredSession = {
  accessToken: string;
  role: string | null;
  email: string | null;
};

export function isBlockedRole(role: string | null | undefined) {
  return role === "business" || role === "creator";
}

export function readStoredSession(): StoredSession | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const accessToken = typeof parsed.accessToken === "string" ? parsed.accessToken.trim() : "";
    if (!accessToken) return null;
    const role = typeof parsed.role === "string" && parsed.role.trim() ? parsed.role.trim() : null;
    const email = typeof parsed.email === "string" && parsed.email.trim() ? parsed.email.trim() : null;
    return { accessToken, role, email };
  } catch {
    return null;
  }
}

export function watchStoredSession(onChange: () => void) {
  const notify = () => onChange();
  window.addEventListener(sessionEvent, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(sessionEvent, notify);
    window.removeEventListener("storage", notify);
  };
}
