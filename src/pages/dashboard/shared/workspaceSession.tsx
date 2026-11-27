import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AppButton, AppNotice } from "../../../components";
import type { AccountProfile } from "../../../api/auth";
import {
  dashboardPath,
  isCurrentSession,
  readSession,
  readSessionExpired,
  sameSessionIdentity,
  useExpiredSessionRedirect,
  useLiveSession,
  verifySession,
  type Session,
} from "../../auth/session";

export const titleClass =
  "text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl";
export const linkClass =
  "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline hover:bg-[var(--cg-primary-dark)]";
export const textLinkClass =
  "text-sm font-semibold text-[var(--cg-primary-dark)] no-underline";

export function signedInAs(role: Session["role"]) {
  if (role === "admin") return "an administrator";
  return `a ${role}`;
}

export function useWorkspaceSession() {
  useExpiredSessionRedirect();
  const session = useLiveSession();
  const [check, setCheck] = useState<
    | { session: Session; account: AccountProfile }
    | { session: Session; error: string }
    | null
  >(null);
  const [attempt, setAttempt] = useState(0);
  const userId = session?.userId;
  const accessToken = session?.accessToken;
  const role = session?.role;

  useEffect(() => {
    const stored = readSession();
    setCheck(null);
    if (!stored) return;

    const controller = new AbortController();
    verifySession(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted && next && isCurrentSession(next.session)) setCheck(next);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !isCurrentSession(stored)) return;
        setCheck({
          session: stored,
          error: error instanceof Error && error.message ? error.message : "Couldn't confirm this account.",
        });
      });
    return () => controller.abort();
  }, [userId, accessToken, role, attempt]);

  const verified = check && sameSessionIdentity(check.session, session) ? check : null;
  const confirmed = verified && "account" in verified ? verified : null;
  const accountError = verified && "error" in verified ? verified.error : "";
  const accountState = accountError ? "error" : session && !confirmed ? "pending" : "ready";
  return {
    session: confirmed?.session ?? session,
    account: confirmed?.account ?? null,
    accountState,
    accountError,
    retry: () => {
      setCheck(null);
      setAttempt((value) => value + 1);
    },
  } as const;
}

export function AccountCheck({
  state,
  message,
  onRetry,
}: {
  state: "pending" | "ready" | "error";
  message: string;
  onRetry: () => void;
}) {
  if (state === "pending") {
    return <p className="text-sm text-[var(--cg-muted)]">Checking this account...</p>;
  }
  if (state === "error") {
    return (
      <div className="space-y-3">
        <AppNotice tone="error" message={message || "Couldn't confirm this account."} />
        <AppButton variant="secondary" onPress={onRetry}>Try again</AppButton>
      </div>
    );
  }
  return null;
}

export function AccountField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-[0.08em] text-[var(--cg-muted)] uppercase">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[var(--cg-text)]">{children}</dd>
    </div>
  );
}

export function WorkspaceAccess({
  title,
  role,
  session,
  from,
  signedOut,
}: {
  title: string;
  role: "business" | "creator";
  session: Session | null;
  from: string;
  signedOut: string;
}) {
  if (!session) {
    if (readSessionExpired()) {
      return <p className="text-sm text-[var(--cg-muted)]">Checking this account...</p>;
    }
    return (
      <div className="flex flex-col gap-4">
        <h1 className={titleClass}>{title}</h1>
        <AppNotice tone="info" message={signedOut} />
        <Link to="/login" state={{ from }} className={linkClass}>Log in</Link>
      </div>
    );
  }

  if (session.role !== role) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className={titleClass}>{title}</h1>
        <AppNotice
          tone="info"
          message={`This page is for ${role} accounts. You are signed in as ${signedInAs(session.role)} account.`}
        />
        <Link to={dashboardPath(session.role)} className={linkClass}>Go to your dashboard</Link>
      </div>
    );
  }

  return null;
}
