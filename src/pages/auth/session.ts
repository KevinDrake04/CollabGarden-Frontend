import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthError, fetchAccount, roleOf, type AccountRole, type Session } from "../../api/auth";

const storageKey = "collabgarden.session";
const expiredKey = "collabgarden.session-expired";
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
  sessionStorage.removeItem(expiredKey);
  notify();
}

export function clearSession() {
  sessionStorage.removeItem(storageKey);
  sessionStorage.removeItem(expiredKey);
  notify();
}

// A rejected token is removed and remembered so login can explain it.
export function expireSession() {
  sessionStorage.removeItem(storageKey);
  sessionStorage.setItem(expiredKey, "1");
  notify();
}

export function readSessionExpired() {
  return sessionStorage.getItem(expiredKey) === "1";
}

export function takeSessionExpired() {
  const expired = readSessionExpired();
  if (expired) sessionStorage.removeItem(expiredKey);
  return expired;
}

export function watchSession(onChange: () => void) {
  window.addEventListener(sessionEvent, onChange);
  return () => window.removeEventListener(sessionEvent, onChange);
}

export function dashboardPath(role: AccountRole) {
  if (role === "business") return "/dashboard/business";
  if (role === "creator") return "/dashboard/creator";
  return "/dashboard/admin";
}

function allowedPath(pathname: string, role: AccountRole) {
  if (pathname === "/" || pathname === "/discover" || pathname === "/campaigns" || pathname === "/signup") {
    return true;
  }
  if (/^\/businesses\/\d+$/.test(pathname) || /^\/creators\/\d+$/.test(pathname)) return true;
  if (role === "business") {
    return pathname === "/dashboard/business"
      || pathname === "/dashboard/business/campaigns"
      || pathname === "/dashboard/business/review"
      || pathname === "/dashboard/business/account"
      || pathname === "/campaigns/new"
      || /^\/campaigns\/\d+\/edit$/.test(pathname);
  }
  if (role === "creator") {
    return pathname === "/dashboard/creator"
      || pathname === "/dashboard/creator/opportunities"
      || pathname === "/dashboard/creator/deliverables"
      || pathname === "/dashboard/creator/account";
  }
  return pathname === "/dashboard/admin"
    || pathname === "/dashboard/admin/approvals"
    || pathname === "/dashboard/admin/accounts"
    || pathname === "/dashboard/admin/founding-members"
    || pathname === "/dashboard/admin/campaigns";
}

function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, "http://collabgarden.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://collabgarden.local" || url.username || url.password) return null;
  if (!url.pathname.startsWith("/") || url.pathname.includes("//")) return null;
  return url;
}

// Only return to a same-site route this role is allowed to open.
export function pathAfterLogin(from: unknown, role: AccountRole) {
  const fallback = dashboardPath(role);
  const target = safeReturnPath(from);
  if (!target || !allowedPath(target.pathname, role)) return fallback;
  return `${target.pathname}${target.search}${target.hash}`;
}

// Send an expired workspace session to login and remember this page.
export function useExpiredSessionRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    const leave = () => {
      if (readSession() || !readSessionExpired()) return;
      navigate("/login", { replace: true, state: { expired: true, from } });
    };
    leave();
    return watchSession(leave);
  }, [navigate, from]);
}

export function useLiveSession() {
  const { pathname } = useLocation();
  const [session, setSession] = useState<Session | null>(() => readSession());

  useEffect(() => {
    setSession(readSession());
    return watchSession(() => setSession(readSession()));
  }, [pathname]);

  return session;
}

function sameSession(left: Session, right: Session) {
  return left.accessToken === right.accessToken
    && left.userId === right.userId
    && left.email === right.email
    && left.role === right.role
    && left.businessId === right.businessId
    && JSON.stringify(left.businessIds) === JSON.stringify(right.businessIds);
}

// Reload role and business membership from /auth/me.
// A 401 clears the session and marks it expired. Other failures leave it in place.
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
      expireSession();
      return null;
    }
    throw error;
  }
}
