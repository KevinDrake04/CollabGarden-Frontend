/// <reference types="vite/client" />

import { profileImageProblem } from "../utils/profileImage";
import { type Business } from "./directory";

const ownBusinessPath = "/api/v1/businesses/me";
const ownBusinessLogoPath = `${ownBusinessPath}/logo`;

export const businessOfferTypes = ["gifted", "dining", "paid"] as const;

export const businessProfileLimits = {
  name: 120,
  category: 60,
  description: 2000,
  phone: 30,
  website: 500,
} as const;

export type BusinessProfile = {
  business_id: number;
  name: string;
  category: string | null;
  logo_url: string | null;
  description: string | null;
  offer_types: string[];
  county_ids: number[];
  status: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
};

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

export class BusinessProfileError extends Error {
  readonly status: number;
  readonly savedProfile: BusinessProfile | null;

  constructor(status: number, message: string, savedProfile: BusinessProfile | null = null) {
    super(message);
    this.name = "BusinessProfileError";
    this.status = status;
    this.savedProfile = savedProfile;
  }
}

export function businessOfferLabel(value: string) {
  if (value === "gifted") return "Gifted";
  if (value === "dining") return "Dining";
  if (value === "paid") return "Paid";
  return value
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function profileFromDirectory(business: Business) {
  return parseBusinessProfile({
    business_id: business.business_id,
    name: business.name,
    category: business.category,
    logo_url: business.logo_url,
    description: business.description,
    offer_types: business.offer_types,
    county_ids: business.county_ids,
  }, false);
}

function apiUrl() {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!url) throw new BusinessProfileError(0, "Missing VITE_API_URL in .env.local");
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function detailMessage(status: number, body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item) => {
        if (!item || typeof item !== "object" || !("msg" in item)) return [];
        const record = item as { msg: unknown };
        return typeof record.msg === "string" && record.msg.trim() ? [record.msg.trim()] : [];
      });
      if (messages.length > 0) return messages.join(" ");
    }
  }
  if (status === 401) return "Not authenticated";
  if (status === 403) return "You can only edit a business on this account.";
  return `API request failed: ${status}`;
}

async function readBody(response: Response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) as unknown : null;
  } catch {
    throw new BusinessProfileError(response.status, `API request failed: ${response.status}`);
  }
}

function integerId(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function parseName(value: unknown, max: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
}

function parseOptional(value: unknown, max: number) {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

function isKnownOffer(value: string) {
  return (businessOfferTypes as readonly string[]).includes(value);
}

function parseOffers(value: unknown, strict: boolean) {
  if (value == null) return [];
  if (!Array.isArray(value)) return strict ? null : [];
  const offers: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      if (strict) return null;
      continue;
    }
    const offer = item.trim();
    if (!isKnownOffer(offer)) {
      if (strict) return null;
      continue;
    }
    if (seen.has(offer)) continue;
    seen.add(offer);
    offers.push(offer);
  }
  return offers;
}

function parseCountyIds(value: unknown, strict: boolean) {
  if (value == null) return [];
  if (!Array.isArray(value)) return strict ? null : [];
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1) {
      if (strict) return null;
      continue;
    }
    if (seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function safeLogoUrl(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2000) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\") && !trimmed.includes("://")) {
    return new URL(trimmed, apiUrl()).href;
  }
  try {
    const url = new URL(trimmed);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function parseBusinessProfile(body: unknown, strict: boolean): BusinessProfile {
  if (!isRecord(body)) {
    throw new BusinessProfileError(200, "The business profile response was not in the expected format.");
  }
  const businessId = integerId(body.business_id);
  const name = parseName(body.name, strict ? businessProfileLimits.name : 500);
  const category = parseOptional(body.category, strict ? businessProfileLimits.category : 500);
  const description = parseOptional(body.description, strict ? businessProfileLimits.description : 20000);
  const logoUrl = safeLogoUrl(body.logo_url);
  const status = typeof body.status === "string" ? body.status : null;
  const offerTypes = parseOffers(body.offer_types, strict);
  const countyIds = parseCountyIds(body.county_ids, strict);
  if (
    businessId == null
    || (strict && !status)
    || !name
    || category === undefined
    || description === undefined
    || logoUrl === undefined
    || offerTypes == null
    || countyIds == null
  ) {
    throw new BusinessProfileError(200, "The business profile response was not in the expected format.");
  }
  return {
    business_id: businessId,
    name,
    category,
    logo_url: logoUrl,
    description,
    offer_types: offerTypes,
    county_ids: countyIds,
    status,
    contact_email: parseOptional(body.contact_email, 500) ?? null,
    contact_phone: parseOptional(body.contact_phone, 30) ?? null,
    website: parseOptional(body.website, 500) ?? null,
  };
}

function sameBusiness(profile: BusinessProfile, businessId: number) {
  if (profile.business_id !== businessId) {
    throw new BusinessProfileError(409, "The assigned business changed. Reload your account before saving.");
  }
  return profile;
}

export function businessProfileSaveMessage(error: unknown) {
  if (!(error instanceof BusinessProfileError)) return "Profile changes were not saved.";
  if (error.savedProfile) return `Profile details were saved. ${error.message} Check the logo and try again.`;
  return error.message || "Profile changes were not saved.";
}

async function send(
  path: string,
  token: string,
  init: { method: string; body?: BodyInit; signal?: AbortSignal },
) {
  if (!token.trim()) throw new BusinessProfileError(401, "Not authenticated");
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (typeof init.body === "string") headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      method: init.method,
      body: init.body,
      signal: init.signal,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new BusinessProfileError(0, "The profile service could not be reached.");
  }
  const body = await readBody(response);
  if (!response.ok) throw new BusinessProfileError(response.status, detailMessage(response.status, body));
  return body;
}

export async function getOwnBusinessProfile(token: string, signal?: AbortSignal) {
  return parseBusinessProfile(await send(ownBusinessPath, token, { method: "GET", signal }), true);
}

export async function saveBusinessProfile(
  token: string,
  original: BusinessProfile,
  update: BusinessProfileUpdate,
  logo: File | null,
) {
  if (logo) {
    const problem = await profileImageProblem(logo);
    if (problem) throw new BusinessProfileError(0, problem);
  }

  const changes = Object.fromEntries(Object.entries(update).filter(([key, value]) => {
    const previous = original[key as keyof BusinessProfileUpdate];
    if (Array.isArray(value) && Array.isArray(previous)) {
      return value.length !== previous.length || value.some((item: string | number) => !previous.some((old) => old === item));
    }
    return value !== previous;
  }));
  let saved = original;
  // The API chooses the business for /me, so check its assignment before writing.
  if (Object.keys(changes).length) {
    sameBusiness(await getOwnBusinessProfile(token), original.business_id);
    saved = sameBusiness(parseBusinessProfile(await send(ownBusinessPath, token, {
      method: "PATCH", body: JSON.stringify(changes),
    }), true), original.business_id);
  }
  if (!logo) return saved;

  const body = new FormData();
  body.append("file", logo, logo.name || "business-logo");
  try {
    sameBusiness(await getOwnBusinessProfile(token), original.business_id);
    const uploaded = sameBusiness(parseBusinessProfile(await send(ownBusinessLogoPath, token, {
      method: "POST", body,
    }), true), original.business_id);
    if (!uploaded.logo_url) throw new BusinessProfileError(200, "The upload response did not include a logo URL.");
    return uploaded;
  } catch (error) {
    if (error instanceof BusinessProfileError && saved !== original) {
      throw new BusinessProfileError(error.status, error.message, saved);
    }
    throw error;
  }
}
