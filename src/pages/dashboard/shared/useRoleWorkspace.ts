import { useEffect, useState } from "react";
import { AuthError, type AccountRole, type Session } from "../../../api/auth";
import {
  CollaborationApiError,
  collaborationErrorMessage,
  isAbortError,
  loadCollaborationWorkspace,
  type CollaborationWorkspace,
} from "../../../api/collaborations";
import {
  expireSession,
  readSession,
  readSessionExpired,
  refreshSession,
  useExpiredSessionRedirect,
  watchSession,
} from "../../auth/session";

type RoleWorkspaceView =
  | { kind: "checking" }
  | { kind: "signed-out"; expired: boolean }
  | { kind: "wrong-role"; role: AccountRole }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

function unauthorized(error: unknown) {
  return (error instanceof CollaborationApiError || error instanceof AuthError) && error.status === 401;
}

export function clearSessionIfUnauthorized(error: unknown) {
  if (!unauthorized(error)) return false;
  expireSession();
  return true;
}

function failureMessage(error: unknown) {
  if (error instanceof AuthError) return error.message || "Could not confirm this account.";
  return collaborationErrorMessage(error);
}

// Refresh the stored session, then load deliverables for this role.
export function useRoleWorkspace(expectedRole: "creator" | "business") {
  useExpiredSessionRedirect();
  const [retry, setRetry] = useState(0);
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [view, setView] = useState<RoleWorkspaceView>(() =>
    readSession() ? { kind: "checking" } : { kind: "signed-out", expired: readSessionExpired() },
  );
  const [workspace, setWorkspace] = useState<CollaborationWorkspace | null>(null);

  useEffect(() => {
    return watchSession(() => {
      const next = readSession();
      setSession(next);
      if (!next) {
        setWorkspace(null);
        setView({ kind: "signed-out", expired: readSessionExpired() });
      }
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    async function run() {
      const stored = readSession();
      if (!stored) {
        if (ignore) return;
        setSession(null);
        setWorkspace(null);
        setView({ kind: "signed-out", expired: readSessionExpired() });
        return;
      }

      setView({ kind: "checking" });
      try {
        const next = await refreshSession(controller.signal);
        if (ignore) return;
        setSession(next);
        if (!next) {
          setSession(null);
          setWorkspace(null);
          setView({ kind: "signed-out", expired: true });
          return;
        }
        if (next.role !== expectedRole) {
          setWorkspace(null);
          setView({ kind: "wrong-role", role: next.role });
          return;
        }
        setView({ kind: "loading" });
        const loaded = await loadCollaborationWorkspace(next, controller.signal);
        if (ignore || !readSession()) return;
        setWorkspace(loaded);
        setView({ kind: "ready" });
      } catch (error) {
        if (ignore || controller.signal.aborted || isAbortError(error)) return;
        if (unauthorized(error)) {
          expireSession();
          setSession(null);
          setWorkspace(null);
          setView({ kind: "signed-out", expired: true });
          return;
        }
        setWorkspace(null);
        setView({ kind: "error", message: failureMessage(error) });
      }
    }

    void run();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [expectedRole, retry]);

  function updateAccess(
    update: (access: CollaborationWorkspace["access"]) => CollaborationWorkspace["access"],
  ) {
    setWorkspace((current) => (current ? { ...current, access: update(current.access) } : current));
  }

  return {
    view,
    session,
    workspace,
    reload: () => setRetry((value) => value + 1),
    updateAccess,
  };
}
