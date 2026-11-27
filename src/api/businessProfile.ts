import {
  completeProfileRecord,
  confirmProfileWrite,
  profileId,
  profileImageUrl,
  profileRecord,
  profileRequest,
  ProfileRequestError,
  profileSaveResult,
  profileText,
  sameSelection,
} from "./profileRequest";

const profilePath = "/api/v1/businesses/me";
export const businessOfferTypes = ["gifted", "dining", "paid"] as const;

export const businessProfileLimits = {
  name: 120,
  category: 60,
  description: 2000,
  phone: 30,
  website: 500,
} as const;

export type BusinessProfileUpdate = {
  name: string;
  description: string | null;
  category: string | null;
  offer_types: string[];
  county_ids: number[];
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
};

export type BusinessProfile = BusinessProfileUpdate & {
  business_id: number;
  logo_url: string | null;
  status: string;
};

export function businessOfferLabel(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readBusiness(row: Record<string, unknown>): BusinessProfile {
  const business_id = profileId(row.business_id);
  const status = profileText(row.status);
  if (!business_id || !status || typeof row.name !== "string") {
    throw new ProfileRequestError(200, "The business profile response was incomplete.");
  }
  return {
    business_id,
    status,
    name: row.name.trim(),
    description: profileText(row.description),
    category: profileText(row.category),
    logo_url: profileImageUrl(row.logo_url),
    offer_types: Array.isArray(row.offer_types)
      ? row.offer_types.filter((offer): offer is string => typeof offer === "string") : [],
    county_ids: Array.isArray(row.county_ids)
      ? row.county_ids.filter((id): id is number => profileId(id) !== null) : [],
    contact_email: profileText(row.contact_email),
    contact_phone: profileText(row.contact_phone),
    website: profileText(row.website),
  };
}

export async function getOwnBusinessProfile(token: string, signal?: AbortSignal) {
  return readBusiness(profileRecord(await profileRequest(profilePath, token, { signal })));
}

export function saveBusinessProfile(
  token: string,
  original: BusinessProfile,
  changes: Partial<BusinessProfileUpdate>,
  logo: File | null,
  signal: AbortSignal,
) {
  let profile = original;
  let detailsSaved = false;
  let imageSaved = false;

  function checkAssignment(id: unknown) {
    if (id !== original.business_id) {
      throw new ProfileRequestError(403, "The assigned business changed. Reload your account before saving.");
    }
  }

  async function checkAssignedBusiness() {
    const row = profileRecord(await profileRequest(profilePath, token, { signal }));
    checkAssignment(row.business_id);
  }

  function decodeResponse(body: unknown, mutation: boolean) {
    const row = profileRecord(body);
    const id = profileId(row.business_id);
    if (id) checkAssignment(id);
    return readBusiness(mutation ? completeProfileRecord(row, original) : row);
  }

  async function readProfile() {
    profile = decodeResponse(await profileRequest(profilePath, token, { signal }), false);
    return profile;
  }

  return profileSaveResult(async () => {
    if (Object.keys(changes).length) {
      await checkAssignedBusiness();
      await confirmProfileWrite(async () => {
        profile = decodeResponse(await profileRequest(profilePath, token, { method: "PATCH", body: JSON.stringify(changes), signal }), true);
        detailsSaved = true;
      }, async (acknowledged) => {
        const current = await readProfile();
        detailsSaved = acknowledged || Object.entries(changes).every(([key, value]) => {
          if (key === "county_ids") return sameSelection(changes.county_ids ?? [], current.county_ids);
          if (key === "offer_types") return sameSelection(changes.offer_types ?? [], current.offer_types);
          return current[key as keyof BusinessProfileUpdate] === value;
        });
        return detailsSaved;
      }, "the business profile");
    }

    if (logo) {
      await checkAssignedBusiness();
      const previous = profile.logo_url;
      const body = new FormData();
      body.append("file", logo);
      await confirmProfileWrite(async () => {
        const response = decodeResponse(await profileRequest(`${profilePath}/logo`, token, { method: "POST", body, signal }), true);
        if (!response.logo_url) throw new ProfileRequestError(200, "The logo response was incomplete.");
        profile = response;
        imageSaved = true;
      }, async (acknowledged) => {
        const current = await readProfile();
        imageSaved = Boolean(current.logo_url && (acknowledged || current.logo_url !== previous));
        return imageSaved;
      }, "the business logo");
    }
  }, () => ({ profile, detailsSaved, imageSaved }));
}

export type BusinessSave = Awaited<ReturnType<typeof saveBusinessProfile>>;
