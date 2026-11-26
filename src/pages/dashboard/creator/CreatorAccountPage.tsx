import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppAvatar, AppButton, AppNotice } from "../../../components";
import {
  CreatorProfileError,
  getOwnCreatorProfile,
  saveCreatorProfile,
  type CreatorProfile,
  type CreatorProfileUpdate,
  type CreatorSamplePostEdit,
} from "../../../api/creatorProfile";
import { countyNameForId, getCounties, getCreator, type County } from "../../../api/directory";
import { expireSession } from "../../auth/session";
import { CreatorProfileForm } from "./CreatorProfileForm";
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

export default function CreatorAccountPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const token = accountState === "ready" && session?.role === "creator" ? session.accessToken : null;
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [publiclyListed, setPubliclyListed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setProfile(null);
    setLoadError("");
    setEditing(false);
    setNotice("");
    if (!token) return;
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      getOwnCreatorProfile(token, signal),
      getCounties(signal).catch(() => [] as County[]),
    ]).then(async ([own, options]) => {
      const listed = own.status === "approved"
        ? await getCreator(own.creator_id, signal).catch(() => null)
        : null;
      if (signal.aborted) return;
      setProfile(own);
      setCounties(options);
      setPubliclyListed(listed?.creator_id === own.creator_id);
    }).catch((error: unknown) => {
      if (signal.aborted || isAbort(error)) return;
      if (error instanceof CreatorProfileError && error.status === 401) {
        expireSession();
        return;
      }
      setLoadError("Couldn't load your creator profile. Please try again.");
    });
    return () => controller.abort();
  }, [token, attempt]);

  async function onSave(update: CreatorProfileUpdate, posts: CreatorSamplePostEdit[], photo: File | null) {
    if (!token || !profile) throw new CreatorProfileError(401, "Not authenticated");
    try {
      const saved = await saveCreatorProfile(token, profile, update, posts, photo);
      setProfile(saved);
      setEditing(false);
      setNotice("Profile changes were saved.");
    } catch (error) {
      if (error instanceof CreatorProfileError && error.status === 401) expireSession();
      if (error instanceof CreatorProfileError && error.savedProfile) setProfile(error.savedProfile);
      throw error;
    }
  }

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

  const displayName = profile?.display_name ?? "";
  const county = profile ? countyNameForId(profile.county_id, counties) : "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className={titleClass}>Account</h1>
      <AccountCheck state={accountState} message={accountError} onRetry={retry} />
      {token && !profile && !loadError && (
        <p className="text-sm text-[var(--cg-muted)]">Loading account details...</p>
      )}
      {token && loadError && (
        <div className="space-y-3">
          <AppNotice tone="error" message={loadError} />
          <AppButton variant="secondary" onPress={() => setAttempt((value) => value + 1)}>Try again</AppButton>
        </div>
      )}
      {token && profile && (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <AppAvatar name={displayName || session.email} imageUrl={profile?.photo_url ?? undefined} size="lg" />
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold text-[var(--cg-primary-dark)]">
                  {displayName || "Creator"}
                </h2>
                <p className="text-sm text-[var(--cg-muted)]">Creator account</p>
              </div>
            </div>
            {!editing && (
              <AppButton
                type="button"
                variant="secondary"
                className="shrink-0"
                onPress={() => {
                  setNotice("");
                  setEditing(true);
                }}
              >
                Edit profile
              </AppButton>
            )}
          </div>
          {notice && (
            <div className="mt-4">
              <AppNotice tone="success" message={notice} onClose={() => setNotice("")} />
            </div>
          )}
          {profile.status === "pending" && (
            <p className="mt-4 text-sm text-[var(--cg-muted)]">Pending approval</p>
          )}
          {editing ? (
            <CreatorProfileForm
              email={session.email}
              profile={profile}
              counties={counties}
              onCancel={() => setEditing(false)}
              onReload={() => setAttempt((value) => value + 1)}
              onSave={onSave}
            />
          ) : (
            <>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <AccountField label="Email">{session.email}</AccountField>
                {displayName && <AccountField label="Name">{displayName}</AccountField>}
                {profile?.niche && <AccountField label="Niche">{profile.niche}</AccountField>}
                {county && <AccountField label="County">{county}</AccountField>}
                {profile?.follower_range && (
                  <AccountField label="Followers">{profile.follower_range}</AccountField>
                )}
                {publiclyListed && profile.status === "approved" && (
                  <AccountField label="Public profile">
                    <Link to={`/creators/${profile.creator_id}`} className={textLinkClass}>
                      View profile
                    </Link>
                  </AccountField>
                )}
                {profile?.bio?.trim() && (
                  <div className="sm:col-span-2">
                    <AccountField label="Bio">{profile.bio.trim()}</AccountField>
                  </div>
                )}
              </dl>
              {!publiclyListed && profile.status !== "pending" && (
                <p className="mt-4 text-sm text-[var(--cg-muted)]">
                  A public profile is not listed yet. You can still update this account here.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
