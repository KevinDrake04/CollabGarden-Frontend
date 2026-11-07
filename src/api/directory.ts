/// <reference types="vite/client" />

// Railway API data used by the directory and profile pages.
export type DirectoryType = "business" | "creator";

export type County = {
  county_id: number;
  name: string;
  state: string;
};

export type DirectoryEntry = {
  id: string;
  name: string;
  category: string;
  county: string;
  imageUrl?: string;
};

export type Business = {
  business_id: number;
  name: string;
  category: string | null;
  logo_url: string | null;
  description: string | null;
  offer_types: string[] | null;
  county_ids: number[] | null;
};

export type SamplePost = {
  url?: string | null;
  caption?: string | null;
};

export type Creator = {
  creator_id: number;
  display_name: string;
  niche: string | null;
  photo_url: string | null;
  bio: string | null;
  follower_range: string | null;
  county_id: number | null;
  sample_posts: SamplePost[] | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number) {
    super(`API request failed: ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

export function countyNamesForIds(
  ids: number[] | null | undefined,
  counties: County[],
) {
  const names: string[] = [];
  for (const id of ids ?? []) {
    const match = counties.find((county) => county.county_id === id);
    if (match && !names.includes(match.name)) names.push(match.name);
  }
  return names;
}

export function countyNameForId(
  id: number | null | undefined,
  counties: County[],
) {
  if (id == null) return "";
  return counties.find((county) => county.county_id === id)?.name ?? "";
}

function businessCountyNames(
  ids: number[] | null | undefined,
  counties: County[],
) {
  return countyNamesForIds(ids, counties).join(", ");
}

export function profilePath(entry: Pick<DirectoryEntry, "id">) {
  const businessId = /^business-(\d+)$/.exec(entry.id)?.[1];
  if (businessId) return `/businesses/${businessId}`;
  const creatorId = /^creator-(\d+)$/.exec(entry.id)?.[1];
  if (creatorId) return `/creators/${creatorId}`;
  return "/discover";
}

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Missing VITE_API_URL in .env.local");

  const response = await fetch(`${baseUrl}${path}`, { signal });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export async function getCounties(signal: AbortSignal): Promise<County[]> {
  return get<County[]>("/api/v1/counties?state=NJ", signal);
}

export function getBusiness(businessId: number, signal: AbortSignal) {
  return get<Business>(`/api/v1/businesses/${businessId}`, signal);
}

export function getCreator(creatorId: number, signal: AbortSignal) {
  return get<Creator>(`/api/v1/creators/${creatorId}`, signal);
}

export async function getDirectory(
  type: DirectoryType,
  selectedCounties: string[],
  counties: County[],
  signal: AbortSignal,
): Promise<DirectoryEntry[]> {
  if (type === "creator") {
    const creators = await get<Creator[]>("/api/v1/creators", signal);
    const selectedIds = counties
      .filter((county) => selectedCounties.includes(county.name))
      .map((county) => county.county_id);

    return creators
      .filter((creator) => {
        if (selectedCounties.length === 0) return true;
        return creator.county_id != null && selectedIds.includes(creator.county_id);
      })
      .map((creator) => ({
        id: `creator-${creator.creator_id}`,
        name: creator.display_name,
        category: creator.niche || "Creator",
        county: countyNameForId(creator.county_id, counties),
        imageUrl: creator.photo_url ?? undefined,
      }));
  }

  // Ask for each selected county with county_id, then keep one card per business.
  // county_ids on the business lists every county it operates in.
  const targets = selectedCounties.length === 0
    ? [null]
    : counties.filter((county) => selectedCounties.includes(county.name));

  const groups = await Promise.all(
    targets.map(async (county) => {
      const path = county
        ? `/api/v1/businesses?county_id=${county.county_id}`
        : "/api/v1/businesses";
      return get<Business[]>(path, signal);
    }),
  );

  const unique = new Map<string, DirectoryEntry>();
  for (const businesses of groups) {
    for (const business of businesses) {
      const id = `business-${business.business_id}`;
      if (!unique.has(id)) {
        unique.set(id, {
          id,
          name: business.name,
          category: business.category || "Business",
          county: businessCountyNames(business.county_ids, counties),
          imageUrl: business.logo_url ?? undefined,
        });
      }
    }
  }
  return [...unique.values()];
}

// In-memory only. These maps outlive page components, so going back to a
// page can show the last result instead of a loading skeleton.
const CACHE_MS = 60_000;

type Saved<T> = {
  value: T;
  savedAt: number;
};

export function isFresh(savedAt: number) {
  return Date.now() - savedAt < CACHE_MS;
}

let savedCounties: Saved<County[]> | null = null;
let countyRequest: Promise<County[]> | null = null;

export function readCounties() {
  return savedCounties;
}

// Pass force when the saved list is stale and should be requested again.
export function loadCounties(force = false) {
  if (!force && savedCounties && isFresh(savedCounties.savedAt)) {
    return Promise.resolve(savedCounties.value);
  }
  if (countyRequest) return countyRequest;

  const controller = new AbortController();
  const request = get<County[]>("/api/v1/counties?state=NJ", controller.signal)
    .then((counties) => {
      savedCounties = { value: counties, savedAt: Date.now() };
      return counties;
    })
    .finally(() => {
      if (countyRequest === request) countyRequest = null;
    });

  countyRequest = request;
  return request;
}

export function directoryCacheKey(
  type: DirectoryType,
  counties: string[],
  query: string,
) {
  return `${type}|${[...counties].sort().join(",")}|${query.trim().toLowerCase()}`;
}

function directorySourceKey(type: DirectoryType, counties: string[]) {
  return directoryCacheKey(type, counties, "");
}

function searchEntries(entries: DirectoryEntry[], query: string) {
  const search = query.trim().toLowerCase();
  if (!search) return entries;
  return entries.filter((entry) =>
    [entry.name, entry.category, entry.county].some((value) =>
      value.toLowerCase().includes(search),
    ),
  );
}

const directoryCache = new Map<string, Saved<DirectoryEntry[]>>();
const directoryRequests = new Map<string, Promise<DirectoryEntry[]>>();

export function readDirectory(
  type: DirectoryType,
  selectedCounties: string[],
  query: string,
) {
  const saved = directoryCache.get(directorySourceKey(type, selectedCounties));
  if (!saved) return null;
  return {
    entries: searchEntries(saved.value, query),
    savedAt: saved.savedAt,
  };
}

export function loadDirectory(type: DirectoryType, selectedCounties: string[]) {
  const key = directorySourceKey(type, selectedCounties);
  const pending = directoryRequests.get(key);
  if (pending) return pending;

  const controller = new AbortController();
  const request = loadCounties()
    .then((counties) => getDirectory(type, selectedCounties, counties, controller.signal))
    .then((entries) => {
      directoryCache.set(key, { value: entries, savedAt: Date.now() });
      return entries;
    })
    .finally(() => {
      if (directoryRequests.get(key) === request) directoryRequests.delete(key);
    });

  directoryRequests.set(key, request);
  return request;
}

export type SavedBusiness = {
  business: Business;
  counties: County[];
  savedAt: number;
};

export type SavedCreator = {
  creator: Creator;
  counties: County[];
  savedAt: number;
};

const businessCache = new Map<number, SavedBusiness>();
const creatorCache = new Map<number, SavedCreator>();
const profileRequests = new Map<string, Promise<SavedBusiness | SavedCreator>>();

export function readBusiness(id: number) {
  return businessCache.get(id) ?? null;
}

export function readCreator(id: number) {
  return creatorCache.get(id) ?? null;
}

export function loadBusiness(id: number) {
  const key = `business:${id}`;
  const pending = profileRequests.get(key) as Promise<SavedBusiness> | undefined;
  if (pending) return pending;

  const controller = new AbortController();
  const request = Promise.all([
    getBusiness(id, controller.signal),
    loadCounties(),
  ]).then(([business, counties]) => {
    const saved = { business, counties, savedAt: Date.now() };
    businessCache.set(id, saved);
    return saved;
  }).finally(() => {
    if (profileRequests.get(key) === request) profileRequests.delete(key);
  });

  profileRequests.set(key, request);
  return request;
}

export function loadCreator(id: number) {
  const key = `creator:${id}`;
  const pending = profileRequests.get(key) as Promise<SavedCreator> | undefined;
  if (pending) return pending;

  const controller = new AbortController();
  const request = Promise.all([
    getCreator(id, controller.signal),
    loadCounties(),
  ]).then(([creator, counties]) => {
    const saved = { creator, counties, savedAt: Date.now() };
    creatorCache.set(id, saved);
    return saved;
  }).finally(() => {
    if (profileRequests.get(key) === request) profileRequests.delete(key);
  });

  profileRequests.set(key, request);
  return request;
}
