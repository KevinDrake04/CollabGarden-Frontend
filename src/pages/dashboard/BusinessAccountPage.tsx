import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppAvatar, AppNotice } from "../../components";
import { verifiedBusinessIds } from "../../api/auth";
import { getBusiness, getCounties, type Business, type County } from "../../api/directory";
import { countyLabel } from "./businessFormat";
import { BusinessSwitcher, useBusinessNames, useSelectedBusiness } from "./selectedBusiness";
import {
  AccountCheck,
  AccountField,
  textLinkClass,
  titleClass,
  useWorkspaceSession,
  WorkspaceAccess,
} from "./workspaceSession";

const panelClass = "max-w-2xl rounded-2xl border border-[var(--cg-border)] bg-white p-6 shadow-sm";

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export default function BusinessAccountPage() {
  const { session, accountState, accountError, retry } = useWorkspaceSession();
  const ids = session?.role === "business" ? verifiedBusinessIds(session) : [];
  const ready = accountState === "ready" && session?.role === "business";
  const { selected, choose } = useSelectedBusiness(session?.userId ?? null, ids, session?.businessId ?? null, ready);
  const names = useBusinessNames(ready ? ids : []);
  const [profile, setProfile] = useState<Business | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    if (!ready || selected == null) {
      setProfile(null);
      setProfileMissing(false);
      return;
    }
    const controller = new AbortController();
    const businessId = selected;
    Promise.all([
      getBusiness(businessId, controller.signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return null;
      }),
      getCounties(controller.signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return [] as County[];
      }),
    ])
      .then(([nextProfile, nextCounties]) => {
        if (controller.signal.aborted) return;
        setCounties(nextCounties);
        setProfile(nextProfile && nextProfile.business_id === businessId ? nextProfile : null);
        setProfileMissing(nextProfile == null || nextProfile.business_id !== businessId);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setProfile(null);
        setProfileMissing(true);
      });
    return () => controller.abort();
  }, [ready, selected]);

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

  const directoryName = selected != null ? names.get(selected) : undefined;
  const displayName = profile?.name?.trim() || directoryName || "";
  const countiesText = profile ? countyLabel(profile.county_ids ?? [], counties) : "";
  const showCounties = Boolean(profile && countiesText && countiesText !== "No county listed");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-5">
        <h1 className={titleClass}>Account</h1>
        {ready && (
          <BusinessSwitcher ids={ids} names={names} selected={selected} onChange={choose} />
        )}
      </div>

      <AccountCheck state={accountState} message={accountError} onRetry={retry} />

      {ready && ids.length === 0 && (
        <AppNotice tone="info" message="This account is not linked to a business." />
      )}

      {ready && ids.length > 0 && (
        <section className={panelClass}>
          <div className="flex items-center gap-4">
            <AppAvatar name={displayName || session.email} imageUrl={profile?.logo_url ?? undefined} size="lg" />
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold text-[var(--cg-primary-dark)]">
                {displayName || "Business"}
              </h2>
              <p className="text-sm text-[var(--cg-muted)]">Business account</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <AccountField label="Email">{session.email}</AccountField>
            {displayName && <AccountField label="Name">{displayName}</AccountField>}
            {profile?.category && <AccountField label="Category">{profile.category}</AccountField>}
            {showCounties && <AccountField label="Counties">{countiesText}</AccountField>}
            {profile && (
              <AccountField label="Public profile">
                <Link to={`/businesses/${profile.business_id}`} className={textLinkClass}>
                  View profile
                </Link>
              </AccountField>
            )}
          </dl>
          {profileMissing && (
            <p className="mt-4 text-sm text-[var(--cg-muted)]">A public profile is not listed yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
