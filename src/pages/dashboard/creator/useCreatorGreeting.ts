import { useEffect, useState } from "react";
import { AuthError, fetchAccount } from "../../../api/auth";
import { getCreator } from "../../../api/directory";
import { expireSession, type Session } from "../../auth/session";

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function useCreatorGreeting(session: Session | null) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!session) {
      setDisplayName("");
      setBio("");
      return;
    }
    const controller = new AbortController();
    fetchAccount(session.accessToken, controller.signal)
      .then(async (account) => {
        if (controller.signal.aborted) return;
        const fallback = account.displayName || session.email;
        if (account.creatorId == null) {
          setDisplayName(fallback);
          setBio("");
          return;
        }
        try {
          const creator = await getCreator(account.creatorId, controller.signal);
          if (controller.signal.aborted) return;
          const matched = creator.creator_id === account.creatorId ? creator : null;
          setDisplayName(matched?.display_name.trim() || fallback);
          setBio(matched?.bio?.trim() || "");
        } catch (error) {
          if (controller.signal.aborted || isAbort(error)) return;
          setDisplayName(fallback);
          setBio("");
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof AuthError && error.status === 401) expireSession();
      });
    return () => controller.abort();
  }, [session]);

  return { displayName, bio };
}
