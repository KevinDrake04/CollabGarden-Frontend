import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { MapPin } from "lucide-react";
import {
  AppAvatar,
  AppButton,
  AppNotice,
  AppSearch,
  EmptyState,
  LoadingSkeleton,
} from "../../components";
import {
  getCounties,
  getDirectory,
  type County,
  type DirectoryEntry,
  type DirectoryType,
} from "./api";
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

function locationLabel(county: string) {
  if (!county) return "New Jersey";
  // One name stays "Essex County, NJ". Several names stay a list.
  const names = county.split(", ");
  if (names.length === 1) return `${names[0]} County, NJ`;
  return `${names.map((name) => `${name} County`).join(", ")}, NJ`;
}

function DirectoryCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-[var(--cg-border)] bg-white p-5 shadow-sm transition hover:border-[var(--cg-accent)] hover:shadow-md">
      <AppAvatar name={entry.name} imageUrl={entry.imageUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-lg font-semibold text-[var(--cg-text)]">{entry.name}</h2>
        <p className="mt-1 text-sm text-[var(--cg-muted)]">{entry.category}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--cg-muted)]">
          <MapPin size={15} className="shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
          {locationLabel(entry.county)}
        </p>
      </div>
    </article>
  );
}

export default function DirectoryPage() {
  const location = useLocation();
  const [filters, setFilters] = useState<Filters>(() => readFilters(location.search));
  const [counties, setCounties] = useState<County[]>([]);
  const [countyReady, setCountyReady] = useState(false);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setFilters(readFilters(location.search));
    setNotice("");
  }, [location.search]);

  // Load the 21 NJ counties from Railway once, and again on retry.
  useEffect(() => {
    const controller = new AbortController();
    setCountyReady(false);
    setStatus("loading");
    getCounties(controller.signal)
      .then((data) => {
        setCounties(data);
        setCountyReady(true);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [retry]);

  // Refetch when the tab or selected counties change. Search stays local.
  useEffect(() => {
    if (!countyReady) return;
    const controller = new AbortController();
    setStatus("loading");
    getDirectory(filters.type, filters.counties, counties, controller.signal)
      .then((data) => {
        setEntries(data);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [countyReady, counties, filters.type, filters.counties]);

  function updateFilters(changes: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...changes }));
    setNotice("");
  }

  async function copyFilterLink() {
    const params = new URLSearchParams();
    if (filters.type === "creator") params.set("type", "creator");
    if (filters.query.trim()) params.set("q", filters.query.trim());
    filters.counties.forEach((county) => params.append("county", county));

    const url = new URL(window.location.pathname, window.location.origin);
    url.search = params.toString();

    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Filter link copied.");
    } catch {
      setNotice(`Copy this link: ${url.toString()}`);
    }
  }

  const search = filters.query.trim().toLowerCase();
  const hasFilters = Boolean(search || filters.counties.length);
  const results = entries.filter((entry) =>
    !search || [entry.name, entry.category, entry.county].some((value) =>
      value.toLowerCase().includes(search),
    ),
  );

  // Preserve the preview states used for Jira 7.1 testing.
  const preview = new URLSearchParams(location.search).get("preview");
  const loading = preview === "loading" || (!preview && status === "loading");
  const error = preview === "error" || (!preview && status === "error");
  const visibleResults = preview === "empty" ? [] : results;
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
            onChange={(query) => updateFilters({ query })}
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
