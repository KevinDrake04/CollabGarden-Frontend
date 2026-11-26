import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AppAvatar, AppButton, AppNotice } from "../../../components";
import { verifiedBusinessIds } from "../../../api/auth";
import {
  BusinessProfileError,
  businessOfferLabel,
  getOwnBusinessProfile,
  profileFromDirectory,
  saveBusinessProfile,
  type BusinessProfile,
  type BusinessProfileUpdate,
} from "../../../api/businessProfile";
import { getBusiness, getCounties, type County } from "../../../api/directory";
import { expireSession } from "../../auth/session";
import { countyLabel } from "../shared/campaignLabels";
import { BusinessSwitcher, useBusinessNames, useSelectedBusiness } from "../shared/selectedBusiness";
import { BusinessProfileForm } from "./BusinessProfileForm";
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
  const token = accountState === "ready" && session?.role === "business" ? session.accessToken : null;
  const [own, setOwn] = useState<BusinessProfile | null>();
  const [counties, setCounties] = useState<County[]>([]);
  const [listed, setListed] = useState<{ id: number; profile: BusinessProfile | null } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState<number | null>(null);
  const saving = useRef(false);
  const ownLoaded = own !== undefined;
  const ownId = own?.business_id;
  const ids = session?.role === "business" ? verifiedBusinessIds(session) : [];
  if (ownId != null && !ids.includes(ownId)) ids.push(ownId);
  const { selected, choose } = useSelectedBusiness(
    session?.userId ?? null, ids, ownId ?? session?.businessId ?? null, Boolean(token && ownLoaded),
  );
  const names = useBusinessNames(token && ownLoaded ? ids : []);
  const displayNames = new Map(names);
  if (own) displayNames.set(own.business_id, own.name);

  useEffect(() => {
    setOwn(undefined);
    setLoadError("");
    setEditing(null);
    setNotice(null);
    if (!token) return;
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      getOwnBusinessProfile(token, signal).catch((error: unknown) => {
        if (error instanceof BusinessProfileError && error.status === 404) return null;
        throw error;
      }),
      getCounties(signal).catch(() => [] as County[]),
    ]).then(([profile, options]) => {
      if (signal.aborted) return;
      setOwn(profile);
      setCounties(options);
    }).catch((error: unknown) => {
      if (signal.aborted) return;
      if (error instanceof BusinessProfileError && error.status === 401) {
        expireSession();
        return;
      }
      setLoadError("Couldn't load your business profile. Please try again.");
    });
    return () => controller.abort();
  }, [token, attempt]);

  const canEdit = own != null && selected === own.business_id;
  const checkPublic = selected != null && (!canEdit || own.status === "approved");
  useEffect(() => {
    setEditing(null);
    setNotice(null);
    setListed(null);
    if (!selected || !checkPublic) return;
    const controller = new AbortController();
    const { signal } = controller;
    void getBusiness(selected, signal).then((business) => {
      if (!signal.aborted && business.business_id === selected) {
        setListed({ id: selected, profile: profileFromDirectory(business) });
      } else if (!signal.aborted) {
        setListed({ id: selected, profile: null });
      }
    }).catch(() => {
      if (!signal.aborted) setListed({ id: selected, profile: null });
    });
    return () => controller.abort();
  }, [selected, checkPublic]);

  async function onSave(update: BusinessProfileUpdate, logo: File | null) {
    if (!token || !canEdit || !own) {
      throw new BusinessProfileError(403, "This business profile can't be edited here.");
    }
    if (saving.current) throw new BusinessProfileError(409, "A profile save is already in progress.");
    saving.current = true;
    try {
      const saved = await saveBusinessProfile(token, own, update, logo);
      setOwn((current) => current === own ? saved : current);
      setEditing(null);
      setNotice(saved.business_id);
    } catch (error) {
      if (error instanceof BusinessProfileError && error.status === 401) expireSession();
      if (error instanceof BusinessProfileError && error.savedProfile) {
        const saved = error.savedProfile;
        setOwn((current) => current === own ? saved : current);
      }
      throw error;
    } finally {
      saving.current = false;
    }
  }

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

  const directoryName = selected != null ? displayNames.get(selected) : undefined;
  const listedProfile = listed?.id === selected ? listed?.profile : null;
  const profile = canEdit ? own : listedProfile;
  const displayName = profile?.name.trim() || directoryName || "";
  const countiesText = profile ? countyLabel(profile.county_ids, counties) : "";
  const showCounties = Boolean(profile && countiesText && countiesText !== "No county listed");
  const offerText = profile && profile.offer_types.length > 0
    ? profile.offer_types.map((offer) => businessOfferLabel(offer)).join(", ")
    : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-5">
        <h1 className={titleClass}>Account</h1>
        {token && ownLoaded && (
          <BusinessSwitcher ids={ids} names={displayNames} selected={selected} onChange={choose} />
        )}
      </div>

      <AccountCheck state={accountState} message={accountError} onRetry={retry} />

      {token && ownLoaded && ids.length === 0 && (
        <AppNotice tone="info" message="This account is not linked to a business." />
      )}

      {token && !loadError && (!ownLoaded || (checkPublic && !canEdit && listed?.id !== selected)) && (
        <p className="text-sm text-[var(--cg-muted)]">Loading account details...</p>
      )}
      {token && loadError && (
        <div className="space-y-3">
          <AppNotice tone="error" message={loadError} />
          <AppButton variant="secondary" onPress={() => setAttempt((value) => value + 1)}>Try again</AppButton>
        </div>
      )}
      {token && ownLoaded && selected != null && !canEdit && (
        <AppNotice tone="info" message="The profile API supports editing only the business assigned to this account. Other memberships are read-only here." />
      )}
      {token && profile && (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <AppAvatar name={displayName || session.email} imageUrl={profile.logo_url ?? undefined} size="lg" />
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold text-[var(--cg-primary-dark)]">
                  {displayName || "Business"}
                </h2>
                <p className="text-sm text-[var(--cg-muted)]">Business account</p>
              </div>
            </div>
            {canEdit && editing !== selected && (
              <AppButton
                type="button"
                variant="secondary"
                className="shrink-0"
                onPress={() => {
                  setNotice(null);
                  setEditing(selected);
                }}
              >
                Edit profile
              </AppButton>
            )}
          </div>
          {notice === selected && (
            <div className="mt-4">
              <AppNotice tone="success" message="Profile changes were saved." onClose={() => setNotice(null)} />
            </div>
          )}
          {profile.status === "pending" && (
            <p className="mt-4 text-sm text-[var(--cg-muted)]">Pending approval</p>
          )}
          {canEdit && editing === selected ? (
            <BusinessProfileForm
              key={profile.business_id}
              email={session.email}
              profile={profile}
              counties={counties}
              onCancel={() => setEditing(null)}
              onSave={onSave}
            />
          ) : (
            <>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <AccountField label="Email">{session.email}</AccountField>
                {displayName && <AccountField label="Name">{displayName}</AccountField>}
                {profile.category && <AccountField label="Category">{profile.category}</AccountField>}
                {profile.contact_email && <AccountField label="Contact email">{profile.contact_email}</AccountField>}
                {profile.contact_phone && <AccountField label="Contact phone">{profile.contact_phone}</AccountField>}
                {profile.website && <AccountField label="Website">{profile.website}</AccountField>}
                {offerText && <AccountField label="Collaboration types">{offerText}</AccountField>}
                {showCounties && <AccountField label="Counties">{countiesText}</AccountField>}
                {listedProfile && (
                  <AccountField label="Public profile">
                    <Link to={`/businesses/${profile.business_id}`} className={textLinkClass}>
                      View profile
                    </Link>
                  </AccountField>
                )}
                {profile.description?.trim() && (
                  <div className="sm:col-span-2">
                    <AccountField label="Description">{profile.description.trim()}</AccountField>
                  </div>
                )}
              </dl>
              {canEdit && !listedProfile && profile.status !== "pending" && (
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
