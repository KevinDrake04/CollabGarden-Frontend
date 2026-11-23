/// <reference types="vite/client" />

import { type AccountProfile } from "./auth";
import { type Creator } from "./directory";

// Creator profile writes are not on the production API.
// GET /api/v1/creators and GET /api/v1/creators/{creator_id} are public and allow GET only.
// A pending creator is omitted from those routes. GET /auth/me still returns
// id, email, role, creator_id, and display_name, which is enough to open this page.
// PATCH /api/v1/admin/creators/{creator_id} is an administrator status change.
// It is not a profile editor and is not called here.
//
// There is no creator-owned PATCH and no media upload. Calling either path today
// returns 404 {"detail":"Not Found"}. This module does not treat that as a saved
// profile, and it does not write the directory cache.
//
// Required endpoints, to be registered as their own routes (not /creators/{creator_id},
// because a non-numeric segment such as "me" is rejected as an integer path):
//
// GET /api/v1/account/creator
//   Authorization: Bearer access token
//   200 for the signed-in creator, including status pending.
//   404 when that user has no creator profile.
//
// PATCH /api/v1/account/creator
//   Authorization: Bearer access token
//   Content-Type: application/json
//   Replaces the fields below. Deploy this with the GET so the form is filled
//   before a creator saves. Omitted response fields are treated as empty.
//   200 body is the saved profile, including social_links and sample_posts.
//
// POST /api/v1/account/creator/photo
//   Authorization: Bearer access token
//   Content-Type: multipart/form-data
//   Field name: photo
//   JPEG, PNG, or WebP, larger than 0 bytes and at most 5 MiB.
//   200 body: { "photo_url": "https://..." }
//   photo_url is not accepted on the JSON patch.
//
// JSON fields:
//   display_name: string, trimmed, 1 to 80 characters
//   bio: string | null, trimmed, up to 500 characters
//   niche: string | null, trimmed, up to 80 characters
//   county_id: number | null, an id from GET /api/v1/counties?state=NJ
//   follower_range: string | null, one of followerRanges
//   social_links: { platform, url }[]
//     platform: instagram | tiktok | youtube | twitch | x | facebook
//     one link per platform, https, matching the hosts checked by CreatorSocialLinks
//   sample_posts: { url: string | null, caption: string | null }[]
//     up to 6, each with a link, a caption, or both
//     url is http or https, without login details, up to 500 characters
//     caption is up to 280 characters

export const ownCreatorProfilePath = "/api/v1/account/creator";
export const ownCreatorPhotoPath = "/api/v1/account/creator/photo";

export const followerRanges = [
  "Under 1K",
  "1K-10K",
  "10K-50K",
  "50K-100K",
  "100K-500K",
  "500K-1M",
  "1M+",
] as const;

export const creatorProfileLimits = {
  displayName: 80,
  niche: 80,
  bio: 500,
  caption: 280,
  postUrl: 500,
  samplePosts: 6,
  imageBytes: 5 * 1024 * 1024,
} as const;

const socialPlatforms = ["instagram", "tiktok", "youtube", "twitch", "x", "facebook"] as const;

export type CreatorSocialPlatform = (typeof socialPlatforms)[number];

export type CreatorProfileSocialLink = {
  platform: CreatorSocialPlatform;
  url: string;
};

export type CreatorSamplePost = {
  url: string | null;
  caption: string | null;
};

export type CreatorProfile = {
  creator_id: number | null;
  display_name: string;
  niche: string | null;
  photo_url: string | null;
  bio: string | null;
  follower_range: string | null;
  county_id: number | null;
  sample_posts: CreatorSamplePost[];
  social_links: CreatorProfileSocialLink[];
};

export type CreatorProfileUpdate = {
  display_name: string;
  bio: string | null;
  niche: string | null;
  county_id: number | null;
  follower_range: string | null;
  social_links: CreatorProfileSocialLink[];
  sample_posts: CreatorSamplePost[];
};

export class CreatorProfileError extends Error {
  readonly status: number;
  readonly savedProfile: CreatorProfile | null;

  constructor(status: number, message: string, savedProfile: CreatorProfile | null = null) {
    super(message);
    this.name = "CreatorProfileError";
    this.status = status;
    this.savedProfile = savedProfile;
  }
}

export function profileFromDirectory(creator: Creator) {
  return parseCreatorProfile(creator, false);
}

export function profileFromAccount(account: AccountProfile): CreatorProfile {
  return {
    creator_id: account.creatorId,
    display_name: account.displayName ?? "",
    niche: null,
    photo_url: null,
    bio: null,
    follower_range: null,
    county_id: null,
    sample_posts: [],
    social_links: [],
  };
}

function apiUrl() {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!url) throw new CreatorProfileError(0, "Missing VITE_API_URL in .env.local");
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
  return `API request failed: ${status}`;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CreatorProfileError(response.status, `API request failed: ${response.status}`);
  }
}

function optionalText(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function integerOrNull(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  return undefined;
}

function safePhotoUrl(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2000) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\") && !trimmed.includes("://")) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function isPlatform(value: unknown): value is CreatorSocialPlatform {
  return typeof value === "string" && socialPlatforms.some((platform) => platform === value);
}

function parseSocialLinks(value: unknown, strict: boolean) {
  if (value == null) return [];
  if (!Array.isArray(value)) return strict ? null : [];
  const links: CreatorProfileSocialLink[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || !isPlatform(item.platform) || typeof item.url !== "string" || !item.url.trim()) {
      if (strict) return null;
      continue;
    }
    if (seen.has(item.platform)) {
      if (strict) return null;
      continue;
    }
    seen.add(item.platform);
    links.push({ platform: item.platform, url: item.url.trim() });
  }
  return links;
}

function parsePosts(value: unknown, strict: boolean) {
  if (value == null) return [];
  if (!Array.isArray(value)) return strict ? null : [];
  const posts: CreatorSamplePost[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      if (strict) return null;
      continue;
    }
    const url = optionalText(item.url);
    const caption = optionalText(item.caption);
    if (url === undefined || caption === undefined) {
      if (strict) return null;
      continue;
    }
    if (!url && !caption) continue;
    posts.push({ url, caption });
  }
  return posts;
}

function parseCreatorProfile(body: unknown, strict: boolean): CreatorProfile {
  if (!isRecord(body)) {
    throw new CreatorProfileError(200, "The creator profile response was not in the expected format.");
  }
  const displayName = optionalText(body.display_name);
  const creatorId = integerOrNull(body.creator_id);
  const countyId = integerOrNull(body.county_id);
  const niche = optionalText(body.niche);
  const bio = optionalText(body.bio);
  const followerRange = optionalText(body.follower_range);
  const photoUrl = safePhotoUrl(body.photo_url);
  const socialLinks = parseSocialLinks(body.social_links, strict);
  const samplePosts = parsePosts(body.sample_posts, strict);
  if (
    !displayName
    || creatorId === undefined
    || countyId === undefined
    || niche === undefined
    || bio === undefined
    || followerRange === undefined
    || photoUrl === undefined
    || socialLinks == null
    || samplePosts == null
  ) {
    throw new CreatorProfileError(200, "The creator profile response was not in the expected format.");
  }
  return {
    creator_id: creatorId,
    display_name: displayName,
    niche,
    photo_url: photoUrl,
    bio,
    follower_range: followerRange,
    county_id: countyId,
    sample_posts: samplePosts,
    social_links: socialLinks,
  };
}

function genericUnavailable(status: number, message: string) {
  if (status !== 404 && status !== 405 && status !== 501) return false;
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "not found"
    || normalized === "method not allowed"
    || normalized === "api request failed: 404"
    || normalized === "api request failed: 405"
    || normalized === "api request failed: 501"
  );
}

export function creatorProfileSaveMessage(error: unknown) {
  if (!(error instanceof CreatorProfileError)) return "Profile changes were not saved.";
  if (error.status === 0) return "Profile changes were not saved. The profile service could not be reached.";
  if (genericUnavailable(error.status, error.message)) {
    return "Profile changes were not saved. The profile update endpoint is not available yet.";
  }
  return error.message.trim() || "Profile changes were not saved.";
}

async function send(
  path: string,
  token: string,
  init: { method: string; body?: BodyInit; signal?: AbortSignal },
) {
  if (!token.trim()) throw new CreatorProfileError(401, "Not authenticated");
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
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new CreatorProfileError(0, "The profile service could not be reached.");
  }
  const body = await readBody(response);
  if (!response.ok) throw new CreatorProfileError(response.status, detailMessage(response.status, body));
  return body;
}

export async function getOwnCreatorProfile(token: string, signal?: AbortSignal) {
  try {
    const body = await send(ownCreatorProfilePath, token, { method: "GET", signal });
    return parseCreatorProfile(body, false);
  } catch (error) {
    if (error instanceof CreatorProfileError && genericUnavailable(error.status, error.message)) return null;
    throw error;
  }
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

async function imageKind(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes.length >= 12
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return "";
}

export async function profileImageProblem(file: File) {
  if (file.size <= 0) return "Choose an image file.";
  if (file.size > creatorProfileLimits.imageBytes) return "Use an image that is 5 MB or smaller.";
  const kind = await imageKind(file);
  if (!kind) return "Use a JPG, PNG, or WebP image.";
  return "";
}

async function uploadCreatorPhoto(token: string, file: File, signal?: AbortSignal) {
  const problem = await profileImageProblem(file);
  if (problem) throw new CreatorProfileError(0, problem);
  const body = new FormData();
  body.append("photo", file, file.name || "profile-image");
  let responseBody: unknown;
  try {
    responseBody = await send(ownCreatorPhotoPath, token, { method: "POST", body, signal });
  } catch (error) {
    if (error instanceof CreatorProfileError && genericUnavailable(error.status, error.message)) {
      throw new CreatorProfileError(
        error.status,
        "The image was not saved. The image upload endpoint is not available yet.",
      );
    }
    throw error;
  }
  const photoUrl = isRecord(responseBody) ? safePhotoUrl(responseBody.photo_url) : undefined;
  if (!photoUrl) {
    throw new CreatorProfileError(200, "The image upload response did not include a photo URL.");
  }
  return photoUrl;
}

export async function saveCreatorProfile(
  token: string,
  update: CreatorProfileUpdate,
  photo: File | null,
  signal?: AbortSignal,
) {
  if (photo) {
    const problem = await profileImageProblem(photo);
    if (problem) throw new CreatorProfileError(0, problem);
  }

  const saved = parseCreatorProfile(
    await send(ownCreatorProfilePath, token, {
      method: "PATCH",
      signal,
      body: JSON.stringify({
        display_name: update.display_name,
        bio: update.bio,
        niche: update.niche,
        county_id: update.county_id,
        follower_range: update.follower_range,
        social_links: update.social_links.map((link) => ({ platform: link.platform, url: link.url })),
        sample_posts: update.sample_posts.map((post) => ({ url: post.url, caption: post.caption })),
      }),
    }),
    true,
  );

  if (!photo) return saved;
  try {
    const photoUrl = await uploadCreatorPhoto(token, photo, signal);
    return { ...saved, photo_url: photoUrl };
  } catch (error) {
    if (error instanceof CreatorProfileError) {
      throw new CreatorProfileError(error.status, error.message, saved);
    }
    throw new CreatorProfileError(0, "The image was not saved.", saved);
  }
}
