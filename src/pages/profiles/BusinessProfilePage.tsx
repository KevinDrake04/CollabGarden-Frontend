import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  ApiError,
  countyNamesForIds,
  isFresh,
  loadBusiness,
  readBusiness,
  type Business,
  type County,
} from "../directory/api";
import {
  AppNotice,
  CountyList,
  ProfileActions,
  ProfileDetails,
  ProfileHeader,
} from "../../components";
import {
  BackToDiscover,
  ProfilePage,
  ProfileStatus,
  isAbortError,
  parseProfileId,
  type ProfileLoadStatus,
} from "./ProfileChrome";

function offerLabel(value: string) {
  return value
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function BusinessProfile({
  business,
  counties,
}: {
  business: Business;
  counties: County[];
}) {
  const name = business.name.trim() || "Unnamed business";
  const category = business.category?.trim() || "";
  const description = business.description?.trim() || "";
  const countyNames = countyNamesForIds(business.county_ids, counties);
  const countyMissing = (business.county_ids ?? []).length > 0
    ? "County names are unavailable."
    : "No counties listed.";
  const offers = (business.offer_types ?? [])
    .map((offer, index) => ({ label: offerLabel(offer), index }))
    .filter((offer) => offer.label);

  return (
    <>
      <ProfileHeader
        eyebrow="Business"
        name={name}
        imageUrl={business.logo_url || undefined}
        summary={category}
        emptySummary="No category listed."
        action={
          <ProfileActions
            actions={[{ label: "Contact business", disabled: true, badge: "Coming soon" }]}
          />
        }
      >
        <div className="mt-4">
          <div className="mb-2 text-sm text-[var(--cg-muted)]">Counties</div>
          <CountyList names={countyNames} missingLabel={countyMissing} />
        </div>
      </ProfileHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ProfileDetails
            title="About"
            text={description}
            emptyLabel="No description yet."
          />
        </div>
        <div className="lg:col-span-2">
          <ProfileDetails
            title="Collaboration types"
            emptyLabel={offers.length === 0 ? "No collaboration types listed." : undefined}
          >
            {offers.length > 0 ? (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {offers.map((offer) => (
                  <li
                    key={`${offer.label}-${offer.index}`}
                    className="rounded-full border border-[var(--cg-border)] bg-[var(--cg-background)] px-3 py-1 text-sm font-medium text-[var(--cg-primary-dark)]"
                  >
                    {offer.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </ProfileDetails>
        </div>
      </div>
    </>
  );
}

export default function BusinessProfilePage() {
  const { id: idParam } = useParams();
  const routeId = parseProfileId(idParam);
  const initial = routeId ? readBusiness(routeId) : null;
  const [trackedId, setTrackedId] = useState(routeId);
  const [status, setStatus] = useState<ProfileLoadStatus>(
    routeId ? (initial ? "ready" : "loading") : "missing",
  );
  const [business, setBusiness] = useState<Business | null>(initial?.business ?? null);
  const [counties, setCounties] = useState<County[]>(initial?.counties ?? []);
  const [refreshNote, setRefreshNote] = useState("");
  const [retry, setRetry] = useState(0);
  const handledRetry = useRef(retry);
  const idRef = useRef(routeId);
  idRef.current = routeId;

  if (trackedId !== routeId) {
    const saved = routeId ? readBusiness(routeId) : null;
    setTrackedId(routeId);
    setRefreshNote("");
    if (!routeId) {
      setBusiness(null);
      setStatus("missing");
    } else if (saved) {
      setBusiness(saved.business);
      setCounties(saved.counties);
      setStatus("ready");
    } else {
      setBusiness(null);
      setCounties([]);
      setStatus("loading");
    }
  }

  useEffect(() => {
    if (!routeId) return;
    const forceRefresh = handledRetry.current !== retry;
    handledRetry.current = retry;
    const saved = readBusiness(routeId);
    if (saved && isFresh(saved.savedAt) && !forceRefresh) return;

    let active = true;
    const requestedId = routeId;
    loadBusiness(requestedId)
      .then((next) => {
        if (!active || idRef.current !== requestedId) return;
        setBusiness(next.business);
        setCounties(next.counties);
        setStatus("ready");
        setRefreshNote("");
      })
      .catch((error: unknown) => {
        if (!active || idRef.current !== requestedId || isAbortError(error)) return;
        const latest = readBusiness(requestedId);
        if (latest) {
          setBusiness(latest.business);
          setCounties(latest.counties);
          setStatus("ready");
          setRefreshNote("Couldn't refresh this profile. Showing the last results.");
          return;
        }
        setBusiness(null);
        setStatus(error instanceof ApiError && error.status === 404 ? "missing" : "error");
      });

    return () => {
      active = false;
    };
  }, [routeId, retry]);

  const discoverTo = "/discover";

  return (
    <ProfilePage>
      <BackToDiscover to={discoverTo} />
      {refreshNote && status === "ready" && (
        <AppNotice tone="error" message={refreshNote} onClose={() => setRefreshNote("")} />
      )}
      {status === "ready" && business ? (
        <BusinessProfile business={business} counties={counties} />
      ) : (
        <ProfileStatus
          status={status === "ready" ? "missing" : status}
          loadingLabel="Loading business profile"
          errorMessage="Couldn't load this business. Please try again."
          missingTitle="Business not found"
          missingDescription="This business is not listed in the directory."
          discoverTo={discoverTo}
          onRetry={() => {
            setBusiness(null);
            setStatus("loading");
            setRetry((value) => value + 1);
          }}
        />
      )}
    </ProfilePage>
  );
}
