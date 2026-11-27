import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AppAvatar, AppButton, AppNotice } from "../../../components";
import { verifiedBusinessIds } from "../../../api/auth";
import {
  businessOfferLabel,
  getOwnBusinessProfile,
  saveBusinessProfile,
  type BusinessProfile,
  type BusinessProfileUpdate,
  type BusinessSave,
} from "../../../api/businessProfile";
import { ApiError, getBusiness, loadCounties, type Business, type County } from "../../../api/directory";
import { ProfileRequestError, profileImageUrl } from "../../../api/profileRequest";
import { expireSession, isCurrentSession, type Session } from "../../auth/session";
import { countyLabel } from "../shared/campaignLabels";
import { BusinessSwitcher, useBusinessNames, useSelectedBusiness } from "../shared/selectedBusiness";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { useProfileSave } from "../shared/useProfileSave";
import {
  AccountCheck,
  AccountField,
  textLinkClass,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "../shared/workspaceSession";

const panelClass = "max-w-2xl rounded-2xl border border-[var(--cg-border)] bg-white p-6 shadow-sm";

export default function BusinessAccountPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  if (!session || session.role !== "business") {
    return (
      <WorkspaceAccess
        title="Account"
        role="business"
        session={session}
        from="/dashboard/business/account"
        signedOut="Sign in with a business account to see your account."
      />
    );
  }
  if (accountState === "ready") {
    return <BusinessAccount key={JSON.stringify([session.userId, session.accessToken])} session={session} />;
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className={titleClass}>Account</h1>
      <AccountCheck state={accountState} message={accountError} onRetry={retry} />
    </div>
  );
}

function BusinessAccount({ session }: { session: Session }) {
  const token = session.accessToken;
  const [own, setOwn] = useState<BusinessProfile | null>();
  const [counties, setCounties] = useState<County[]>([]);
  const [listed, setListed] = useState<{ id: number; profile: Business | null; missing: boolean } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(false);
  const refreshOwnOnReturn = useRef(false);
  const ownLoaded = own !== undefined;
  const ownId = own?.business_id;
  const ids = verifiedBusinessIds(session);
  if (ownId != null && !ids.includes(ownId)) ids.push(ownId);
  const { selected, choose } = useSelectedBusiness(
    session.userId, ids, ownId ?? session.businessId, ownLoaded,
  );
  const names = useBusinessNames(ownLoaded && ids.length > 1 ? ids.filter((id) => id !== ownId) : []);
  const displayNames = new Map(names);
  if (own) displayNames.set(own.business_id, own.name);

  useEffect(() => {
    setOwn(undefined);
    setLoadError("");
    setEditing(false);
    setNotice(false);
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      getOwnBusinessProfile(token, signal).catch((error: unknown) => {
        if (error instanceof ProfileRequestError && error.status === 404) return null;
        throw error;
      }),
      loadCounties().catch(() => []),
    ]).then(([profile, options]) => {
      if (signal.aborted || !isCurrentSession(session)) return;
      setOwn(profile);
      setCounties(options);
    }).catch((error: unknown) => {
      if (signal.aborted || !isCurrentSession(session)) return;
      if (error instanceof ProfileRequestError && error.status === 401) {
        expireSession(session);
        return;
      }
      setLoadError("Couldn't load your business profile. Please try again.");
    });
    return () => controller.abort();
  }, [token, attempt]);

  const canEdit = own != null && selected === own.business_id;
  const checkPublic = selected != null && (!canEdit || own.status === "approved");
  const save = useProfileSave<BusinessSave["saved"]>(session, selected, ({ profile: saved }, complete) => {
    setOwn(saved);
    if (complete) {
      setEditing(false);
      setNotice(true);
    }
  }, () => { refreshOwnOnReturn.current = true; });

  useLayoutEffect(() => {
    if (canEdit && refreshOwnOnReturn.current) {
      refreshOwnOnReturn.current = false;
      setOwn(undefined);
      setAttempt((value) => value + 1);
    }
  }, [canEdit]);

  useEffect(() => {
    setEditing(false);
    setNotice(false);
  }, [selected]);

  useEffect(() => {
    setListed(null);
    if (!selected || !checkPublic) return;
    const controller = new AbortController();
    const { signal } = controller;
    void getBusiness(selected, signal).then((business) => {
      if (!signal.aborted) {
        const matches = business.business_id === selected;
        setListed({ id: selected, profile: matches ? business : null, missing: !matches });
      }
    }).catch((error: unknown) => {
      if (!signal.aborted) setListed({ id: selected, profile: null, missing: error instanceof ApiError && error.status === 404 });
    });
    return () => controller.abort();
  }, [selected, checkPublic]);

  async function onSave(update: Partial<BusinessProfileUpdate>, logo: File | null) {
    if (canEdit) return save((signal) => saveBusinessProfile(token, own, update, logo, signal));
  }

  const directoryName = selected != null ? displayNames.get(selected) : undefined;
  const listing = listed?.id === selected ? listed : null;
  const listedProfile = listing?.profile;
  const profile = canEdit ? own : listedProfile;
  const displayName = profile?.name.trim() || directoryName || "";
  const countyIds = profile?.county_ids ?? [];
  const offerText = profile?.offer_types?.map(businessOfferLabel).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-5">
        <h1 className={titleClass}>Account</h1>
        {ownLoaded && (
          <BusinessSwitcher ids={ids} names={displayNames} selected={selected} onChange={choose} />
        )}
      </div>

      {ownLoaded && ids.length === 0 && (
        <AppNotice tone="info" message="This account is not linked to a business." />
      )}

      {!loadError && (!ownLoaded || (checkPublic && !canEdit && !listing)) && (
        <p className="text-sm text-[var(--cg-muted)]">Loading account details...</p>
      )}
      {loadError && (
        <div className="space-y-3">
          <AppNotice tone="error" message={loadError} />
          <AppButton variant="secondary" onPress={() => setAttempt((value) => value + 1)}>Try again</AppButton>
        </div>
      )}
      {ownLoaded && selected != null && !canEdit && (
        <AppNotice tone="info" message="The profile API supports editing only the business assigned to this account. Other memberships are read-only here." />
      )}
      {(profile || listing) && (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <AppAvatar name={displayName || session.email}
                imageUrl={(canEdit ? own.logo_url : profileImageUrl(listedProfile?.logo_url)) ?? undefined} size="lg" />
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold text-[var(--cg-primary-dark)]">
                  {displayName || "Business"}
                </h2>
                <p className="text-sm text-[var(--cg-muted)]">Business account</p>
              </div>
            </div>
            {canEdit && !editing && (
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
          {canEdit && notice && (
            <div className="mt-4">
              <AppNotice tone="success" message="Profile changes were saved." onClose={() => setNotice(false)} />
            </div>
          )}
          {canEdit && own.status === "pending" && (
            <p className="mt-4 text-sm text-[var(--cg-muted)]">Pending approval</p>
          )}
          {canEdit && editing ? (
            <BusinessProfileForm
              email={session.email}
              profile={own}
              counties={counties}
              onCancel={() => setEditing(false)}
              onSave={onSave}
            />
          ) : (
            <>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <AccountField label="Email">{session.email}</AccountField>
                {displayName && <AccountField label="Name">{displayName}</AccountField>}
                {profile?.category && <AccountField label="Category">{profile.category}</AccountField>}
                {canEdit && own.contact_email && <AccountField label="Contact email">{own.contact_email}</AccountField>}
                {canEdit && own.contact_phone && <AccountField label="Contact phone">{own.contact_phone}</AccountField>}
                {canEdit && own.website && <AccountField label="Website">{own.website}</AccountField>}
                {offerText && <AccountField label="Collaboration types">{offerText}</AccountField>}
                {countyIds.length > 0 && <AccountField label="Counties">{countyLabel(countyIds, counties)}</AccountField>}
                {listedProfile && (
                  <AccountField label="Public profile">
                    <Link to={`/businesses/${listedProfile.business_id}`} className={textLinkClass}>
                      View profile
                    </Link>
                  </AccountField>
                )}
                {profile?.description?.trim() && (
                  <div className="sm:col-span-2">
                    <AccountField label="Description">{profile.description.trim()}</AccountField>
                  </div>
                )}
              </dl>
              {(listing?.missing || (canEdit && !checkPublic && own.status !== "pending")) && (
                <p className="mt-4 text-sm text-[var(--cg-muted)]">
                  A public profile is not listed yet.{canEdit && " You can still update this account here."}
                </p>
              )}
              {listing && !listing.profile && !listing.missing && (
                <p className="mt-4 text-sm text-[var(--cg-muted)]">The public profile could not be loaded.</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
