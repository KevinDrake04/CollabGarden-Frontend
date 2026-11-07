import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
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
  loadCounties,
  loadDirectory,
  profilePath,
  readCounties,
  readDirectory,
  type County,
  type DirectoryEntry,
  type DirectoryType,
} from "../../api/directory";
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
    counties: [...new Set(params.getAll("county"))],
    query: params.get("q") ?? "",
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.type === right.type
    && left.query === right.query
    && left.counties.join("\0") === right.counties.join("\0");
}

// Keep the existing parameter names. Business is the default tab, so its type
// stays out of the URL. Other parameters, such as preview, are left in place.
function writeFilterParams(filters: Filters, current: URLSearchParams) {
  const params = new URLSearchParams(current);
  params.delete("type");
  params.delete("q");
  params.delete("county");
  if (filters.type === "creator") params.set("type", "creator");
  if (filters.query) params.set("q", filters.query);
  filters.counties.forEach((county) => params.append("county", county));
  return params;
}

function locationLabel(county: string) {
  if (!county) return "New Jersey";
  // One name stays "Essex County, NJ". Several names stay a list.
  const names = county.split(", ");
  if (names.length === 1) return `${names[0]} County, NJ`;
  return `${names.map((name) => `${name} County`).join(", ")}, NJ`;
}

let didPrefetchOtherTab = false;

function prefetchOtherTab(type: DirectoryType, selectedCounties: string[]) {
  if (didPrefetchOtherTab) return;
  didPrefetchOtherTab = true;

  const other: DirectoryType = type === "business" ? "creator" : "business";
  const saved = readDirectory(other, selectedCounties, "");
  if (saved && isFresh(saved.savedAt)) return;
  loadDirectory(other, selectedCounties).catch(() => {});
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
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const filters = useMemo(() => readFilters(searchKey), [searchKey]);
  const [counties, setCounties] = useState<County[]>(() => readCounties()?.value ?? []);
  const [entries, setEntries] = useState<DirectoryEntry[]>(() => {
    const initial = readFilters(searchKey);
    return readDirectory(initial.type, initial.counties, initial.query)?.entries ?? [];
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() => {
    const initial = readFilters(searchKey);
    return readDirectory(initial.type, initial.counties, initial.query) ? "ready" : "loading";
  });
  const [notice, setNotice] = useState("");
  const [refreshNote, setRefreshNote] = useState("");
  const [retry, setRetry] = useState(0);
  const filtersRef = useRef(filters);
  const handledRetry = useRef(retry);
  const wroteFilters = useRef(false);
  const replacingSearch = useRef(false);
  filtersRef.current = filters;

  const viewKey = directoryCacheKey(filters.type, filters.counties, filters.query);
  const viewRef = useRef(viewKey);
  viewRef.current = viewKey;
  const [shownKey, setShownKey] = useState(viewKey);

  // Swap in the saved list before paint so another tab never flashes on screen.
  if (shownKey !== viewKey) {
    const saved = readDirectory(filters.type, filters.counties, filters.query);
    setShownKey(viewKey);
    setRefreshNote("");
    if (saved) {
      setEntries(saved.entries);
      setStatus("ready");
    } else {
      setEntries([]);
      setStatus("loading");
    }
  }

  useEffect(() => {
    if (wroteFilters.current) {
      wroteFilters.current = false;
      return;
    }
    replacingSearch.current = false;
    setNotice("");
  }, [searchKey]);

  // The county dropdown can fill from memory. A slow county request must not
  // hide directory cards that are already saved.
  useEffect(() => {
    const saved = readCounties();
    if (saved && isFresh(saved.savedAt)) {
      setCounties(saved.value);
      return;
    }

    let active = true;
    loadCounties(Boolean(saved))
      .then((data) => {
        if (active) setCounties(data);
      })
      .catch((error: Error) => {
        if (!active || error.name === "AbortError" || readCounties()) return;
        const latest = filtersRef.current;
        if (!readDirectory(latest.type, latest.counties, latest.query)) {
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);

  // Show a saved list immediately, then refresh it in the background when it is stale.
  useEffect(() => {
    const type = filters.type;
    const selectedCounties = filters.counties;
    const query = filters.query;
    const key = directoryCacheKey(type, selectedCounties, query);
    const forceRefresh = handledRetry.current !== retry;
    handledRetry.current = retry;
    prefetchOtherTab(type, selectedCounties);

    const saved = readDirectory(type, selectedCounties, query);
    if (saved && isFresh(saved.savedAt) && !forceRefresh) return;

    let current = true;
    loadDirectory(type, selectedCounties)
      .then(() => {
        const next = readDirectory(type, selectedCounties, query);
        if (!current || !next || viewRef.current !== key) return;
        setEntries(next.entries);
        setStatus("ready");
        setRefreshNote("");
      })
      .catch((error: Error) => {
        if (!current || error.name === "AbortError" || viewRef.current !== key) return;
        const latest = readDirectory(type, selectedCounties, query);
        if (latest) {
          setEntries(latest.entries);
          setStatus("ready");
          setRefreshNote("Couldn't refresh the directory. Showing the last results.");
        } else {
          setStatus("error");
        }
      });

    return () => {
      current = false;
    };
  }, [filters.type, filters.counties, filters.query, retry]);

  function updateFilters(changes: Partial<Filters>, kind: "search" | "commit" = "commit") {
    const nextFilters = { ...filters, ...changes };
    if (sameFilters(filters, nextFilters)) return;
    setNotice("");
    const replace = kind === "search" && replacingSearch.current;
    wroteFilters.current = true;
    replacingSearch.current = kind === "search";
    setSearchParams(writeFilterParams(nextFilters, searchParams), { replace });
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

  const hasFilters = Boolean(filters.query.trim() || filters.counties.length);

  // Preserve the preview states used for Jira 7.1 testing.
  const preview = searchParams.get("preview");
  const loading = preview === "loading" || (!preview && status === "loading");
  const error = preview === "error" || (!preview && status === "error");
  const visibleResults = preview === "empty" ? [] : entries;
  const itemName = filters.type === "business" ? "business" : "creator";
  const countLabel = visibleResults.length === 1
    ? itemName
    : filters.type === "business" ? "businesses" : "creators";

  return (
    <div className="-m-12 min-h-[calc(100dvh-4.5rem)] bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-my-8">
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 px-4 py-10 text-[var(--cg-text)] md:px-8 md:py-14">
      <div className="max-w-2xl">
        <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">Explore CollabGarden</h1>
        <p className="mt-3 text-base">
          Discover local businesses and creators across New Jersey.
        </p>
      </div>

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
            options={counties.map((county) => county.name)}
            selected={filters.counties}
            onChange={(selected) => updateFilters({ counties: selected })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!loading && !error && (
          <p className="text-sm font-medium" aria-live="polite">
            {visibleResults.length} {countLabel} found
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {hasFilters && (
            <AppButton variant="secondary" onPress={() => updateFilters({ counties: [], query: "" })}>
              Clear filters
            </AppButton>
          )}
          <AppButton variant="secondary" onPress={copyFilterLink}>
            Copy filter link
          </AppButton>
        </div>
      </div>

      {notice && <AppNotice message={notice} onClose={() => setNotice("")} />}
      {refreshNote && !loading && !error && (
        <AppNotice
          tone="error"
          message={refreshNote}
          onClose={() => setRefreshNote("")}
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
      ) : visibleResults.length === 0 ? (
        <EmptyState
          title="No results found"
          description={hasFilters ? "Try a different search or county." : "There are no listings to show right now."}
          action={hasFilters ? (
            <AppButton variant="secondary" onPress={() => updateFilters({ counties: [], query: "" })}>
              Clear filters
            </AppButton>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleResults.map((entry) => <DirectoryCard key={entry.id} entry={entry} />)}
        </div>
      )}
    </div>
    </div>
  );
}
