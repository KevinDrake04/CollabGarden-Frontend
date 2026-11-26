import { useEffect, useState } from "react";
import { AuthError, type AccountRole } from "../../../api/auth";
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
  | { kind: "ready"; workspace: CollaborationWorkspace };

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
  const [view, setView] = useState<RoleWorkspaceView>(() =>
    readSession() ? { kind: "checking" } : { kind: "signed-out", expired: readSessionExpired() },
  );
  useEffect(() => {
    return watchSession(() => {
      if (!readSession()) {
        setView({ kind: "signed-out", expired: readSessionExpired() });
      }
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      if (!readSession()) {
        setView({ kind: "signed-out", expired: readSessionExpired() });
        return;
      }

      setView({ kind: "checking" });
      try {
        const next = await refreshSession(controller.signal);
        if (controller.signal.aborted) return;
        if (!next) {
          setView({ kind: "signed-out", expired: true });
          return;
        }
        if (next.role !== expectedRole) {
          setView({ kind: "wrong-role", role: next.role });
          return;
        }
        setView({ kind: "loading" });
        const workspace = await loadCollaborationWorkspace(next, controller.signal);
        if (controller.signal.aborted || readSession()?.accessToken !== next.accessToken) return;
        setView({ kind: "ready", workspace });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error) || clearSessionIfUnauthorized(error)) return;
        setView({ kind: "error", message: failureMessage(error) });
      }
    }

    void run();
    return () => controller.abort();
  }, [expectedRole, retry]);

  function updateAccess(
    update: (access: CollaborationWorkspace["access"]) => CollaborationWorkspace["access"],
  ) {
    setView((current) => current.kind === "ready"
      ? { kind: "ready", workspace: { ...current.workspace, access: update(current.workspace.access) } }
      : current);
  }

  return {
    view,
    reload: () => setRetry((value) => value + 1),
    updateAccess,
  };
}
