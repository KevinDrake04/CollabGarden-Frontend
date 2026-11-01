/// <reference types="vite/client" />

// Railway API data used by the directory.
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

type Business = {
  business_id: number;
  name: string;
  category: string | null;
  logo_url: string | null;
};

type Creator = {
  creator_id: number;
  display_name: string;
  niche: string | null;
  photo_url: string | null;
  county_id: number;
};

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Missing VITE_API_URL in .env.local");

  const response = await fetch(`${baseUrl}${path}`, { signal });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getCounties(signal: AbortSignal): Promise<County[]> {
  return get<County[]>("/api/v1/counties?state=NJ", signal);
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
      .filter((creator) =>
        selectedCounties.length === 0 || selectedIds.includes(creator.county_id),
      )
      .map((creator) => ({
        id: `creator-${creator.creator_id}`,
        name: creator.display_name,
        category: creator.niche || "Creator",
        county: counties.find((c) => c.county_id === creator.county_id)?.name ?? "",
        imageUrl: creator.photo_url ?? undefined,
      }));
  }

  // Businesses don't currently return county_id, so selected counties are
  // requested separately and duplicate businesses are removed by ID.
  const targets = selectedCounties.length === 0
    ? [null]
    : counties.filter((county) => selectedCounties.includes(county.name));

  const groups = await Promise.all(
    targets.map(async (county) => {
      const path = county
        ? `/api/v1/businesses?county_id=${county.county_id}`
        : "/api/v1/businesses";
      return {
        county: county?.name ?? "",
        businesses: await get<Business[]>(path, signal),
      };
    }),
  );

  const unique = new Map<string, DirectoryEntry>();
  for (const group of groups) {
    for (const business of group.businesses) {
      const id = `business-${business.business_id}`;
      if (!unique.has(id)) {
        unique.set(id, {
          id,
          name: business.name,
          category: business.category || "Business",
          county: group.county,
          imageUrl: business.logo_url ?? undefined,
        });
      }
    }
  }
  return [...unique.values()];
}
