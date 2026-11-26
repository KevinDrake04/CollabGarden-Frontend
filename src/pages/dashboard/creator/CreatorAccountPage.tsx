import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppAvatar, AppButton, AppNotice } from "../../../components";
import {
  getOwnCreatorProfile,
  saveCreatorProfile,
  type CreatorProfile,
  type CreatorProfileUpdate,
  type CreatorSamplePostEdit,
  type CreatorSave,
} from "../../../api/creatorProfile";
import { ApiError, countyNameForId, getCreator, loadCounties, type County } from "../../../api/directory";
import { ProfileRequestError } from "../../../api/profileRequest";
import { expireSession, type Session } from "../../auth/session";
import { CreatorProfileForm } from "./CreatorProfileForm";
import { isCurrentProfileSession, useProfileSave } from "../shared/useProfileSave";
import {
  AccountCheck,
  AccountField,
  textLinkClass,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "../shared/workspaceSession";

const panelClass = "max-w-2xl rounded-2xl border border-[var(--cg-border)] bg-white p-6 shadow-sm";

export default function CreatorAccountPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
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
  return (
    <div className="flex flex-col gap-6">
      <h1 className={titleClass}>Account</h1>
      <AccountCheck state={accountState} message={accountError} onRetry={retry} />
      {accountState === "ready" && (
        <CreatorAccount key={JSON.stringify([session.userId, session.accessToken])} session={session} />
      )}
    </div>
  );
}

function CreatorAccount({ session }: { session: Session }) {
  const token = session.accessToken;
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [publiclyListed, setPubliclyListed] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(false);
  const save = useProfileSave<CreatorSave["saved"]>(session, null, ({ profile: saved }, complete) => {
    setProfile(saved);
    if (complete) {
      setEditing(false);
      setNotice(true);
    }
  });

  useEffect(() => {
    setProfile(null);
    setLoadError("");
    setEditing(false);
    setNotice(false);
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      getOwnCreatorProfile(token, signal),
      loadCounties().catch(() => []),
    ]).then(([own, options]) => {
      if (signal.aborted || !isCurrentProfileSession(session)) return;
      setProfile(own);
      setCounties(options);
    }).catch((error: unknown) => {
      if (signal.aborted || !isCurrentProfileSession(session)) return;
      if (error instanceof ProfileRequestError && error.status === 401) {
        expireSession();
        return;
      }
      setLoadError("Couldn't load your creator profile. Please try again.");
    });
    return () => controller.abort();
  }, [token, attempt]);

  const publicId = profile?.status === "approved" ? profile.creator_id : null;
  useEffect(() => {
    setPubliclyListed(null);
    if (publicId == null) return;
    const controller = new AbortController();
    const { signal } = controller;
    void getCreator(publicId, signal).then((listed) => {
      if (!signal.aborted) setPubliclyListed(listed.creator_id === publicId);
    }).catch((error: unknown) => {
      if (!signal.aborted && error instanceof ApiError && error.status === 404) setPubliclyListed(false);
    });
    return () => controller.abort();
  }, [publicId]);

  async function onSave(update: Partial<CreatorProfileUpdate>, posts: CreatorSamplePostEdit[], photo: File | null) {
    if (profile) return save((signal) => saveCreatorProfile(token, profile, update, posts, photo, signal));
  }

  const displayName = profile?.display_name ?? "";
  const county = profile ? countyNameForId(profile.county_id, counties) : "";

  return (
    <>
      {!profile && !loadError && (
        <p className="text-sm text-[var(--cg-muted)]">Loading account details...</p>
      )}
      {loadError && (
        <div className="space-y-3">
          <AppNotice tone="error" message={loadError} />
          <AppButton variant="secondary" onPress={() => setAttempt((value) => value + 1)}>Try again</AppButton>
        </div>
      )}
      {profile && (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <AppAvatar name={displayName || session.email} imageUrl={profile.photo_url ?? undefined} size="lg" />
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
                  setNotice(false);
                  setEditing(true);
                }}
              >
                Edit profile
              </AppButton>
            )}
          </div>
          {notice && (
            <div className="mt-4">
              <AppNotice tone="success" message="Profile changes were saved." onClose={() => setNotice(false)} />
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
              onSave={onSave}
            />
          ) : (
            <>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <AccountField label="Email">{session.email}</AccountField>
                {displayName && <AccountField label="Name">{displayName}</AccountField>}
                {profile.niche && <AccountField label="Niche">{profile.niche}</AccountField>}
                {county && <AccountField label="County">{county}</AccountField>}
                {profile.follower_range && (
                  <AccountField label="Followers">{profile.follower_range}</AccountField>
                )}
                {publiclyListed && profile.status === "approved" && (
                  <AccountField label="Public profile">
                    <Link to={`/creators/${profile.creator_id}`} className={textLinkClass}>
                      View profile
                    </Link>
                  </AccountField>
                )}
                {profile.bio && (
                  <div className="sm:col-span-2">
                    <AccountField label="Bio">{profile.bio}</AccountField>
                  </div>
                )}
              </dl>
              {(publiclyListed === false || (publicId == null && profile.status !== "pending")) && (
                <p className="mt-4 text-sm text-[var(--cg-muted)]">
                  A public profile is not listed yet. You can still update this account here.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
