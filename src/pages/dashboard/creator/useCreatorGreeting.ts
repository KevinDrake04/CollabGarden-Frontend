import { useEffect, useState } from "react";
import type { AccountProfile } from "../../../api/auth";
import { getCreator } from "../../../api/directory";

export function useCreatorGreeting(account: AccountProfile | null) {
  const [greeting, setGreeting] = useState<{ account: AccountProfile; displayName: string; bio: string } | null>(null);

  useEffect(() => {
    if (!account || account.creatorId == null) return;
    const controller = new AbortController();
    getCreator(account.creatorId, controller.signal)
      .then((creator) => {
        if (controller.signal.aborted) return;
        if (creator.creator_id !== account.creatorId) return;
        setGreeting({ account, displayName: creator.display_name.trim(), bio: creator.bio?.trim() || "" });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [account]);

  const current = greeting?.account === account ? greeting : null;
  return { displayName: current?.displayName || account?.displayName, bio: current?.bio || "" };
}
