import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppAvatar } from "../../../components";
import { AuthError, fetchAccount, type AccountProfile } from "../../../api/auth";
import { countyNameForId, getCounties, getCreator, type County, type Creator } from "../../../api/directory";
import { expireSession } from "../../auth/session";
import {
  AccountCheck,
  AccountField,
  textLinkClass,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "../shared/workspaceSession";

const panelClass = "max-w-2xl rounded-2xl border border-[var(--cg-border)] bg-white p-6 shadow-sm";

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

type ProfileLoad = {
  account: AccountProfile | null;
  creator: Creator | null;
  missing: boolean;
  counties: County[];
};

const emptyProfile: ProfileLoad = { account: null, creator: null, missing: false, counties: [] };

export default function CreatorAccountPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ready = accountState === "ready" && session?.role === "creator";
  const [profile, setProfile] = useState<ProfileLoad>(emptyProfile);
  const [profileState, setProfileState] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    if (!ready || !session) {
      setProfile(emptyProfile);
      setProfileState("loading");
      return;
    }
    const controller = new AbortController();
    setProfileState("loading");
    fetchAccount(session.accessToken, controller.signal)
      .then(async (account) => {
        if (controller.signal.aborted) return;
        const counties = await getCounties(controller.signal).catch((error: unknown) => {
          if (isAbort(error)) throw error;
          return [] as County[];
        });
        if (account.creatorId == null) {
          setProfile({ account, creator: null, missing: false, counties });
          setProfileState("ready");
          return;
        }
        try {
          const creator = await getCreator(account.creatorId, controller.signal);
          if (controller.signal.aborted) return;
          const matched = creator.creator_id === account.creatorId ? creator : null;
          setProfile({ account, creator: matched, missing: matched == null, counties });
          setProfileState("ready");
        } catch (error) {
          if (controller.signal.aborted || isAbort(error)) return;
          setProfile({ account, creator: null, missing: true, counties });
          setProfileState("ready");
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof AuthError && error.status === 401) {
          expireSession();
          return;
        }
        setProfileState("ready");
      });
    return () => controller.abort();
  }, [ready, session]);

  if (!session || session.role !== "creator") {
    return (
      <WorkspaceAccess
        title="Account"
        role="creator"
        session={session}
        from="/dashboard/creator/account"
        signedOut="Sign in with a creator account to see your account."
      />
    );
  }

  const displayName = profile.creator?.display_name?.trim() || profile.account?.displayName || "";
  const county = profile.creator ? countyNameForId(profile.creator.county_id, profile.counties) : "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className={titleClass}>Account</h1>
      <AccountCheck state={accountState} message={accountError} onRetry={retry} />
      {ready && profileState === "loading" && (
        <p className="text-sm text-[var(--cg-muted)]">Loading account details...</p>
      )}
      {ready && profileState === "ready" && (
        <section className={panelClass}>
          <div className="flex items-center gap-4">
            <AppAvatar name={displayName || session.email} imageUrl={profile.creator?.photo_url ?? undefined} size="lg" />
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold text-[var(--cg-primary-dark)]">
                {displayName || "Creator"}
              </h2>
              <p className="text-sm text-[var(--cg-muted)]">Creator account</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <AccountField label="Email">{session.email}</AccountField>
            {displayName && <AccountField label="Name">{displayName}</AccountField>}
            {profile.creator?.niche && <AccountField label="Niche">{profile.creator.niche}</AccountField>}
            {county && <AccountField label="County">{county}</AccountField>}
            {profile.creator?.follower_range && (
              <AccountField label="Followers">{profile.creator.follower_range}</AccountField>
            )}
            {profile.creator && (
              <AccountField label="Public profile">
                <Link to={`/creators/${profile.creator.creator_id}`} className={textLinkClass}>
                  View profile
                </Link>
              </AccountField>
            )}
            {profile.creator?.bio?.trim() && (
              <div className="sm:col-span-2">
                <AccountField label="Bio">{profile.creator.bio.trim()}</AccountField>
              </div>
            )}
          </dl>
          {!profile.creator && (
            <p className="mt-4 text-sm text-[var(--cg-muted)]">A public profile is not listed yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
