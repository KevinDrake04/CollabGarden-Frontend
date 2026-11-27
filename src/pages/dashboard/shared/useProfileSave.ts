import { useLayoutEffect, useRef } from "react";
import { type ProfileSave } from "../../../api/profileRequest";
import { expireSession, readSession, type Session } from "../../auth/session";

export function isCurrentProfileSession({ userId, accessToken, role }: Session) {
  const current = readSession();
  return current?.userId === userId && current.accessToken === accessToken && current.role === role;
}

export function useProfileSave<T>(
  session: Session,
  selection: number | null,
  onResult: (saved: T, complete: boolean) => void,
  onInterrupted?: () => void,
) {
  const scope = useRef<{ controller: AbortController; saving: boolean; unconfirmed: boolean } | null>(null);

  useLayoutEffect(() => {
    if (scope.current?.saving || scope.current?.unconfirmed) onInterrupted?.();
    const active = { controller: new AbortController(), saving: false, unconfirmed: false };
    scope.current = active;
    return () => active.controller.abort();
  }, [session.userId, session.accessToken, selection]);

  async function run(
    active: NonNullable<typeof scope.current>,
    action: (signal: AbortSignal) => Promise<ProfileSave<T> | undefined>,
    closeEditor: boolean,
  ): Promise<ProfileSave<T> | undefined> {
    const { signal } = active.controller;
    const current = () => !signal.aborted && isCurrentProfileSession(session);
    if (!current() || active.saving) return;
    active.saving = true;
    try {
      const result = await action(signal);
      if (!result || !current()) return;
      if (result.error?.status === 401) {
        expireSession();
        return;
      }
      onResult(result.saved, closeEditor && !result.error);
      const check = result.check;
      active.unconfirmed = Boolean(check);
      return check ? { ...result, check: () => run(active, check, false) } : result;
    } catch (error) {
      if (current()) throw error;
    } finally {
      active.saving = false;
    }
  }

  return async (action: (signal: AbortSignal) => Promise<ProfileSave<T>>) => {
    if (scope.current) return run(scope.current, action, true);
  };
}
