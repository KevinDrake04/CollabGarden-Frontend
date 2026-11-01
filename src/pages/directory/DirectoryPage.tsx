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

function DirectoryCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <article className="flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--cg-border)] bg-white p-4">
      <AppAvatar name={entry.name} imageUrl={entry.imageUrl} size="lg" />
      <div className="min-w-0">
        <h2 className="break-words text-lg font-semibold">{entry.name}</h2>
        <p className="text-sm text-[var(--cg-muted)]">{entry.category}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--cg-muted)]">
          <MapPin size={15} aria-hidden="true" />
          {entry.county ? `${entry.county} County, NJ` : "New Jersey"}
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
    <div className="w-full min-w-0 max-w-5xl space-y-6 text-[var(--cg-text)]">
      <div>
        <h1 className="text-3xl font-bold">Explore CollabGarden</h1>
        <p className="mt-2 text-sm text-[var(--cg-muted)]">
          Discover local businesses and creators across New Jersey.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--cg-border)]" role="group" aria-label="Directory type">
        {(["business", "creator"] as const).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={filters.type === type}
            onClick={() => updateFilters({ type })}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${
              filters.type === type
                ? "border-[var(--cg-primary)] text-[var(--cg-primary-dark)]"
                : "border-transparent text-[var(--cg-muted)]"
            }`}
          >
            {type === "business" ? "Businesses" : "Creators"}
          </button>
        ))}
      </div>

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!loading && !error && (
          <p className="text-sm text-[var(--cg-muted)]" aria-live="polite">
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
  );
}
