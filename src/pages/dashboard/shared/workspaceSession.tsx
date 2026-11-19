import { useEffect, useState } from "react";
import { type ReactNode } from "react";
import { Link } from "react-router";
import { AppButton, AppNotice } from "../../../components";
import { AuthError } from "../../../api/auth";
import {
  dashboardPath,
  expireSession,
  readSession,
  readSessionExpired,
  refreshSession,
  useExpiredSessionRedirect,
  watchSession,
  type Session,
} from "../../auth/session";

export const titleClass =
  "text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl";
export const linkClass =
  "inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 text-sm font-semibold text-white no-underline hover:bg-[var(--cg-primary-dark)]";
export const textLinkClass =
  "text-sm font-semibold text-[var(--cg-primary-dark)] no-underline";

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function signedInAs(role: Session["role"]) {
  if (role === "admin") return "an administrator";
  return `a ${role}`;
}

export function useWorkspaceSession() {
  useExpiredSessionRedirect();
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [accountState, setAccountState] = useState<"pending" | "ready" | "error">(() =>
    readSession() ? "pending" : "ready",
  );
  const [accountError, setAccountError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => watchSession(() => setSession(readSession())), []);

  useEffect(() => {
    const controller = new AbortController();
    const stored = readSession();
    if (!stored) {
      setSession(null);
      setAccountState("ready");
      setAccountError("");
      return () => controller.abort();
    }

    setAccountState("pending");
    setAccountError("");
    refreshSession(controller.signal)
      .then((next) => {
        if (controller.signal.aborted || !next) return;
        setSession(next);
        setAccountState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof AuthError && error.status === 401) {
          expireSession();
          return;
        }
        setAccountState("error");
        setAccountError(error instanceof Error && error.message ? error.message : "Couldn't confirm this account.");
      });
    return () => controller.abort();
  }, [attempt]);

  return {
    session,
    accountState,
    accountError,
    retry: () => setAttempt((value) => value + 1),
  };
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
