import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useNavigationType } from "react-router";
import { ArrowUpRight, MapPin } from "lucide-react";
import {
  AppAvatar,
  AppButton,
  AppNotice,
  AppSearch,
  EmptyState,
  LoadingSkeleton,
} from "../../components";
import {
  directoryCacheKey,
  isFresh,
  loadDirectory,
  profilePath,
  readDirectory,
  searchEntries,
  type DirectoryEntry,
  type DirectoryType,
} from "../../api/directory";
import { NJCountyMap } from "../../components/maps/NJCountyMap";
import { NJ_COUNTY_NAMES, readCountyParams } from "../../components/maps/countyPaths";
import CountyFilter from "./CountyFilter";

type Filters = {
  type: DirectoryType;
  counties: string[];
  query: string;
};

function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  return {
    type: params.get("type") === "creator" ? "creator" : "business",
    counties: readCountyParams(params),
    query: params.get("q") ?? "",
  };
}

function sameCounties(left: string[], right: string[]) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

function sameFilters(left: Filters, right: Filters) {
  return left.type === right.type
    && left.query === right.query
    && sameCounties(left.counties, right.counties);
}

function writeCountyParams(params: URLSearchParams, counties: string[]) {
  params.delete("county");
  counties.forEach((county) => params.append("county", county));
}

// Business is the default tab, so its type stays out of the URL.
function writeFilterParams(filters: Partial<Filters>, current: URLSearchParams) {
  const params = new URLSearchParams(current);
  if (filters.type === "creator") params.set("type", "creator");
  if (filters.type === "business") params.delete("type");
  if (filters.query) params.set("q", filters.query);
  if (filters.query === "") params.delete("q");
  if (filters.counties) writeCountyParams(params, filters.counties);
  return params;
}

function emptyCountyPlace(names: string[]) {
  const labeled = names.map((name) => `${name} County`);
  if (labeled.length === 1) return labeled[0];
  if (labeled.length === 2) return `${labeled[0]} or ${labeled[1]}`;
  return "these counties";
}

function locationLabel(county: string) {
  if (!county) return "New Jersey";
  // One name stays "Essex County, NJ". Several names stay a list.
  const names = county.split(", ");
  if (names.length === 1) return `${names[0]} County, NJ`;
  return `${names.map((name) => `${name} County`).join(", ")}, NJ`;
}

let didPrefetchOtherTab = false;

function prefetchOtherTab(type: DirectoryType) {
  if (didPrefetchOtherTab) return;
  didPrefetchOtherTab = true;

  const other: DirectoryType = type === "business" ? "creator" : "business";
  const saved = readDirectory(other, []);
  if (saved && isFresh(saved.savedAt)) return;
  loadDirectory(other, []).catch(() => {});
}

function DirectoryCard({ entry }: { entry: DirectoryEntry }) {
  const location = useLocation();

  return (
    <Link
      to={profilePath(entry)}
      state={{ discoverFrom: `${location.pathname}${location.search}${location.hash}` }}
      className="flex min-w-0 items-center gap-4 rounded-2xl border border-[var(--cg-border)] bg-white p-5 text-[var(--cg-text)] no-underline shadow-sm transition hover:border-[var(--cg-accent)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary)]"
    >
      <AppAvatar name={entry.name} imageUrl={entry.imageUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-lg font-semibold text-[var(--cg-text)]">{entry.name}</h2>
        <p className="mt-1 text-sm text-[var(--cg-muted)]">{entry.category}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--cg-muted)]">
          <MapPin size={15} className="shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
          {locationLabel(entry.county)}
        </p>
      </div>
      <ArrowUpRight size={18} className="shrink-0 text-[var(--cg-muted)]" aria-hidden="true" />
    </Link>
  );
}

export default function DirectoryPage() {
  const { search, hash, state, key: locationKey } = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = state?.focusDirectoryHeading === true;
  const filterState = focusHeading ? undefined : state;
  const filters = useMemo(() => readFilters(search), [search]);
  const { type, counties, query } = filters;
  const resultKey = directoryCacheKey(type, counties);
  const [result, setResult] = useState(() => ({
    key: resultKey,
    entries: readDirectory(type, counties)?.entries ?? null,
    loadFailed: false,
  }));
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const handledRetry = useRef(retry);
  const wroteFilters = useRef(false);
  const replacingSearch = useRef(false);

  // Use the next type and county list before paint so previous results never flash.
  if (result.key !== resultKey) {
    setResult({
      key: resultKey,
      entries: readDirectory(type, counties)?.entries ?? null,
      loadFailed: false,
    });
  }

  useEffect(() => {
    if (!focusHeading || navigationType === "POP") return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusHeading, locationKey, navigationType]);

  useEffect(() => {
    if (wroteFilters.current) {
      wroteFilters.current = false;
      return;
    }
    replacingSearch.current = false;
    setNotice("");

    const params = new URLSearchParams(search);
    if (!sameCounties(params.getAll("county"), filters.counties)) {
      writeCountyParams(params, filters.counties);
      navigate({ search: params.toString(), hash }, { replace: true, state: filterState });
    }
  }, [search, filters.counties, hash, filterState, navigate]);

  // Recheck freshness when URL filters change, keeping saved results during a refresh.
  useEffect(() => {
    const forceRefresh = handledRetry.current !== retry;
    handledRetry.current = retry;
    if (counties.length === 0 && !query.trim()) prefetchOtherTab(type);

    const saved = readDirectory(type, counties);
    if (saved && isFresh(saved.savedAt) && !forceRefresh) {
      setResult((shown) => shown.key === resultKey && shown.entries !== saved.entries
        ? { key: resultKey, entries: saved.entries, loadFailed: false }
        : shown);
      return;
    }

    let current = true;
    async function refreshDirectory() {
      let entries: DirectoryEntry[] | null;
      let loadFailed = false;
      try {
        entries = await loadDirectory(type, counties);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        // A failed county lookup can invalidate the saved list before retry.
        entries = readDirectory(type, counties)?.entries ?? null;
        loadFailed = true;
      }

      if (!current) return;
      setResult((shown) => shown.key === resultKey
        ? { key: resultKey, entries, loadFailed }
        : shown);
    }
    void refreshDirectory();

    return () => {
      current = false;
    };
  }, [type, counties, query, resultKey, retry]);

  function updateFilters(changes: Partial<Filters>, kind: "search" | "commit" = "commit") {
    const nextFilters = { ...filters, ...changes };
    if (sameFilters(filters, nextFilters)) return;
    setNotice("");
    const replace = kind === "search" && replacingSearch.current;
    wroteFilters.current = true;
    replacingSearch.current = kind === "search";
    const params = writeFilterParams(changes, new URLSearchParams(search));
    navigate({ search: params.toString(), hash }, { replace, state: filterState });
  }

  function clearFilters() {
    updateFilters({ counties: [], query: "" });
  }

  async function copyFilterLink() {
    const params = writeFilterParams(
      { ...filters, query: filters.query.trim() },
      new URLSearchParams(),
    );
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = params.toString();

    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Filter link copied.");
    } catch {
      setNotice(`Copy this link: ${url.toString()}`);
    }
  }

  const entries = searchEntries(result.entries ?? [], query);
  const loading = result.entries === null && !result.loadFailed;
  const error = result.entries === null && result.loadFailed;
  const hasSearch = Boolean(query.trim());
  const hasCounty = counties.length > 0;
  const hasFilters = hasSearch || hasCounty;
  const countyHasNoListings = hasCounty && result.entries?.length === 0;
  const place = emptyCountyPlace(filters.counties);
  const itemName = filters.type === "business" ? "business" : "creator";
  const pluralName = filters.type === "business" ? "businesses" : "creators";
  const countLabel = entries.length === 1 ? itemName : pluralName;
  const noResultsDescription = hasSearch && hasCounty
    ? `Nothing in ${place} matches this search.`
    : hasFilters
      ? "Try a different search or county."
      : "There are no listings to show right now.";
  const clearFiltersButton = hasFilters && (
    <AppButton variant="secondary" onPress={clearFilters}>
      Clear filters
    </AppButton>
  );

  return (
    <div className="-m-12 min-h-[calc(100dvh-4.5rem)] bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-my-8">
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10 text-[var(--cg-text)] md:px-8 md:py-14">
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="max-w-2xl lg:col-start-1 lg:row-start-1">
        <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-24 font-bold tracking-tight text-[var(--cg-primary-dark)]">
          Explore CollabGarden
        </h1>
        <p className="mt-3 text-base">
          Discover local businesses and creators across New Jersey.
        </p>
      </div>

      <aside
        aria-labelledby="directory-map-heading"
        className="mx-auto w-full max-w-[320px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:max-w-none lg:sticky lg:top-24"
      >
        <h2 id="directory-map-heading" className="mb-3 text-center text-sm font-semibold text-[var(--cg-primary-dark)] lg:text-left">
          Counties
        </h2>
        <NJCountyMap
          selected={filters.counties}
          onSelect={(name) => updateFilters({ counties: [name] })}
        />
      </aside>

      <div className="space-y-8 lg:col-start-1 lg:row-start-2">
      <div
        className="inline-flex w-full gap-1 rounded-2xl border border-[var(--cg-border)] bg-white p-1 shadow-sm sm:w-auto"
        role="group"
        aria-label="Directory type"
      >
        {(["business", "creator"] as const).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={filters.type === type}
            onClick={() => updateFilters({ type })}
            className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors sm:flex-none ${
              filters.type === type
                ? "bg-[var(--cg-primary)] text-white"
                : "text-[var(--cg-muted)] hover:bg-[var(--cg-background)] hover:text-[var(--cg-primary-dark)]"
            }`}
          >
            {type === "business" ? "Businesses" : "Creators"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--cg-border)] bg-white p-4 shadow-sm md:p-5">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2">
          <AppSearch
            label="Search directory"
            placeholder="Search name or category"
            value={filters.query}
            onChange={(query) => updateFilters({ query }, "search")}
          />
          <CountyFilter
            options={NJ_COUNTY_NAMES}
            selected={filters.counties}
            onChange={(selected) => updateFilters({ counties: selected })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!loading && !error && !countyHasNoListings && (
          <p className="text-sm font-medium" aria-live="polite">
            {entries.length} {countLabel} found
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {clearFiltersButton}
          <AppButton variant="secondary" onPress={copyFilterLink}>
            Copy filter link
          </AppButton>
        </div>
      </div>

      {notice && <AppNotice message={notice} onClose={() => setNotice("")} />}
      {result.entries && result.loadFailed && (
        <AppNotice
          tone="error"
          message="Couldn't refresh the directory. Showing the last results."
          onClose={() => setResult((shown) => ({ ...shown, loadFailed: false }))}
        />
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading directory">
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      ) : error ? (
        <div role="alert" className="space-y-3">
          <AppNotice tone="error" message="Couldn't load the directory. Please try again." />
          <AppButton variant="secondary" onPress={() => setRetry((value) => value + 1)}>
            Try again
          </AppButton>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title={countyHasNoListings ? `No ${pluralName} in ${place} yet` : "No results found"}
          description={countyHasNoListings
            ? `Nobody is listed for ${place} yet. Sign up, and an approved profile can appear in the directory.`
            : noResultsDescription}
          action={countyHasNoListings ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                to={`/signup?role=${filters.type}`}
                className="cg-focus inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 py-2 text-sm font-semibold text-white no-underline"
              >
                Sign up
              </Link>
              {clearFiltersButton}
            </div>
          ) : clearFiltersButton}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {entries.map((entry) => <DirectoryCard key={entry.id} entry={entry} />)}
        </div>
      )}
      </div>
      </div>
    </div>
    </div>
  );
}
