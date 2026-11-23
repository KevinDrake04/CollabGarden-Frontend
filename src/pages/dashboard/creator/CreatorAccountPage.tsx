import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppAvatar, AppButton, AppNotice } from "../../../components";
import { AuthError, fetchAccount, type AccountProfile } from "../../../api/auth";
import {
  CreatorProfileError,
  getOwnCreatorProfile,
  profileFromAccount,
  profileFromDirectory,
  saveCreatorProfile,
  type CreatorProfile,
  type CreatorProfileUpdate,
} from "../../../api/creatorProfile";
import { countyNameForId, getCounties, getCreator, type County, type Creator } from "../../../api/directory";
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

type AccountView = {
  account: AccountProfile | null;
  profile: CreatorProfile | null;
  publiclyListed: boolean;
  counties: County[];
  detailNote: string;
};

const emptyView: AccountView = {
  account: null,
  profile: null,
  publiclyListed: false,
  counties: [],
  detailNote: "",
};

async function loadOwnProfile(token: string, signal: AbortSignal) {
  try {
    return { profile: await getOwnCreatorProfile(token, signal), failed: false };
  } catch (error) {
    if (isAbort(error) || (error instanceof CreatorProfileError && error.status === 401)) throw error;
    return { profile: null, failed: true };
  }
}

async function loadListedCreator(creatorId: number, signal: AbortSignal) {
  try {
    const creator = await getCreator(creatorId, signal);
    return creator.creator_id === creatorId ? creator : null;
  } catch (error) {
    if (isAbort(error)) throw error;
    return null;
  }
}

function profileForAccount(account: AccountProfile, own: CreatorProfile | null, listed: Creator | null) {
  if (own) return own;
  if (!listed) return profileFromAccount(account);
  try {
    return profileFromDirectory(listed);
  } catch (error) {
    if (error instanceof CreatorProfileError) return profileFromAccount(account);
    throw error;
  }
}

export default function CreatorAccountPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ready = accountState === "ready" && session?.role === "creator";
  const [view, setView] = useState<AccountView>(emptyView);
  const [profileState, setProfileState] = useState<"loading" | "ready">("loading");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!ready || !session) {
      setView(emptyView);
      setProfileState("loading");
      setEditing(false);
      return;
    }
    const controller = new AbortController();
    const token = session.accessToken;
    setProfileState("loading");
    setEditing(false);
    setNotice(null);
    fetchAccount(token, controller.signal)
      .then(async (account) => {
        if (controller.signal.aborted) return;
        const [counties, own] = await Promise.all([
          getCounties(controller.signal).catch((error: unknown) => {
            if (isAbort(error)) throw error;
            return [] as County[];
          }),
          loadOwnProfile(token, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const listed = account.creatorId == null
          ? null
          : await loadListedCreator(account.creatorId, controller.signal);
        if (controller.signal.aborted) return;
        setView({
          account,
          profile: profileForAccount(account, own.profile, listed),
          publiclyListed: listed != null,
          counties,
          detailNote: own.failed && !own.profile && !listed
            ? "Saved profile details could not be loaded."
            : "",
        });
        setProfileState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (
          (error instanceof AuthError || error instanceof CreatorProfileError)
          && error.status === 401
        ) {
          expireSession();
          return;
        }
        setView(emptyView);
        setProfileState("ready");
      });
    return () => controller.abort();
  }, [ready, session]);

  async function onSave(update: CreatorProfileUpdate, photo: File | null) {
    if (!session) throw new CreatorProfileError(401, "Not authenticated");
    try {
      const saved = await saveCreatorProfile(session.accessToken, update, photo);
      setView((current) => ({ ...current, profile: saved }));
      setEditing(false);
      setNotice({ tone: "success", message: "Profile changes were saved." });
    } catch (error) {
      if (error instanceof CreatorProfileError && error.status === 401) expireSession();
      if (error instanceof CreatorProfileError && error.savedProfile) {
        const savedProfile = error.savedProfile;
        setView((current) => ({ ...current, profile: savedProfile }));
      }
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

  const displayName = view.profile?.display_name.trim() || view.account?.displayName || "";
  const county = view.profile ? countyNameForId(view.profile.county_id, view.counties) : "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className={titleClass}>Account</h1>
      <AccountCheck state={accountState} message={accountError} onRetry={retry} />
      {ready && profileState === "loading" && (
        <p className="text-sm text-[var(--cg-muted)]">Loading account details...</p>
      )}
      {ready && profileState === "ready" && (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <AppAvatar name={displayName || session.email} imageUrl={view.profile?.photo_url ?? undefined} size="lg" />
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
                  setNotice(null);
                  setEditing(true);
                }}
              >
                Edit profile
              </AppButton>
            )}
          </div>
          {notice && (
            <div className="mt-4">
              <AppNotice tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} />
            </div>
          )}
          {editing ? (
            <CreatorProfileForm
              email={session.email}
              profile={view.profile}
              fallbackName={view.account?.displayName ?? ""}
              counties={view.counties}
              onCancel={() => setEditing(false)}
              onSave={onSave}
            />
          ) : (
            <>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <AccountField label="Email">{session.email}</AccountField>
                {displayName && <AccountField label="Name">{displayName}</AccountField>}
                {view.profile?.niche && <AccountField label="Niche">{view.profile.niche}</AccountField>}
                {county && <AccountField label="County">{county}</AccountField>}
                {view.profile?.follower_range && (
                  <AccountField label="Followers">{view.profile.follower_range}</AccountField>
                )}
                {view.publiclyListed && view.profile?.creator_id != null && (
                  <AccountField label="Public profile">
                    <Link to={`/creators/${view.profile.creator_id}`} className={textLinkClass}>
                      View profile
                    </Link>
                  </AccountField>
                )}
                {view.profile?.bio?.trim() && (
                  <div className="sm:col-span-2">
                    <AccountField label="Bio">{view.profile.bio.trim()}</AccountField>
                  </div>
                )}
              </dl>
              {!view.publiclyListed && (
                <p className="mt-4 text-sm text-[var(--cg-muted)]">
                  A public profile is not listed yet. You can still update this account here.
                </p>
              )}
              {view.detailNote && (
                <p className="mt-4 text-sm text-[var(--cg-muted)]">{view.detailNote}</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
