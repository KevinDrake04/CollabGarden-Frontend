/// <reference types="vite/client" />

import { profileImageProblem } from "../utils/profileImage";
import { isSocialPlatform, type CreatorSocialLink } from "../utils/socialLinks";

const ownCreatorProfilePath = "/api/v1/creators/me";
const ownCreatorPhotoPath = `${ownCreatorProfilePath}/photo`;
const samplePostsPath = `${ownCreatorProfilePath}/sample-posts`;

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
  displayName: 100,
  niche: 60,
  bio: 2000,
  caption: 500,
  postUrl: 500,
} as const;

type CreatorSamplePostInput = {
  url: string;
  caption: string | null;
};

export type CreatorSamplePost = CreatorSamplePostInput & { post_id: number };
export type CreatorSamplePostEdit = CreatorSamplePostInput & { post_id: number | null };

export type CreatorProfile = {
  creator_id: number;
  status: string;
  display_name: string;
  niche: string | null;
  photo_url: string | null;
  bio: string | null;
  follower_range: string | null;
  county_id: number | null;
  sample_posts: CreatorSamplePost[];
  social_links: CreatorSocialLink[];
};

export type CreatorProfileUpdate = {
  display_name: string;
  bio: string | null;
  niche: string | null;
  county_id: number | null;
  follower_range: string | null;
  social_links: CreatorSocialLink[];
};

export class CreatorProfileError extends Error {
  readonly status: number;
  readonly savedProfile: CreatorProfile | null;

  constructor(
    status: number,
    message: string,
    savedProfile: CreatorProfile | null = null,
    readonly createdPostIds: ReadonlyMap<number, number> = new Map(),
    readonly reloadRequired = false,
  ) {
    super(message);
    this.name = "CreatorProfileError";
    this.status = status;
    this.savedProfile = savedProfile;
  }
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
  try {
    const text = await response.text();
    return text ? JSON.parse(text) as unknown : null;
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

function parseSocialLinks(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const links: CreatorSocialLink[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.platform !== "string") return null;
    if (!isSocialPlatform(item.platform)) continue;
    if (typeof item.url !== "string" || !item.url.trim()) return null;
    if (seen.has(item.platform)) continue;
    seen.add(item.platform);
    links.push({ platform: item.platform, url: item.url.trim() });
  }
  return links;
}

function parseSamplePost(value: unknown): CreatorSamplePost {
  if (isRecord(value)) {
    const id = integerOrNull(value.post_id);
    const url = optionalText(value.url);
    const caption = optionalText(value.caption);
    if (id && url && caption !== undefined) return { post_id: id, url, caption };
  }
  throw new CreatorProfileError(200, "The sample post response was not in the expected format.");
}

function parseCreatorProfile(body: unknown): Omit<CreatorProfile, "sample_posts"> {
  if (isRecord(body)) {
    const creatorId = integerOrNull(body.creator_id);
    const status = optionalText(body.status);
    const displayName = optionalText(body.display_name);
    const countyId = integerOrNull(body.county_id);
    const niche = optionalText(body.niche);
    const bio = optionalText(body.bio);
    const followerRange = optionalText(body.follower_range);
    const photoUrl = safePhotoUrl(body.photo_url);
    const socialLinks = parseSocialLinks(body.social_links);
    if (creatorId && status && displayName && countyId !== undefined && niche !== undefined
      && bio !== undefined && followerRange !== undefined && photoUrl !== undefined && socialLinks) {
      return {
        creator_id: creatorId, status, display_name: displayName, niche, photo_url: photoUrl, bio,
        follower_range: followerRange, county_id: countyId, social_links: socialLinks,
      };
    }
  }
  throw new CreatorProfileError(200, "The creator profile response was not in the expected format.");
}

export function creatorProfileSaveMessage(error: unknown) {
  if (!(error instanceof CreatorProfileError)) return "Profile changes were not saved.";
  if (error.savedProfile) return `Some changes were saved. ${error.message} Review the remaining changes before retrying.`;
  return error.message || "Profile changes were not saved.";
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
      cache: "no-store",
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
  const [profile, posts] = await Promise.all([
    send(ownCreatorProfilePath, token, { method: "GET", signal }).then(parseCreatorProfile),
    getSamplePosts(token, signal),
  ]);
  return { ...profile, sample_posts: posts };
}

async function getSamplePosts(token: string, signal?: AbortSignal) {
  const posts = await send(samplePostsPath, token, { method: "GET", signal });
  if (!Array.isArray(posts)) {
    throw new CreatorProfileError(200, "The sample post list was not in the expected format.");
  }
  return posts.map(parseSamplePost);
}

function uncertainResponse(status: number) {
  return status === 0 || status >= 500 || (status >= 200 && status < 300);
}

export async function saveCreatorProfile(
  token: string,
  original: CreatorProfile,
  update: CreatorProfileUpdate,
  posts: CreatorSamplePostEdit[],
  photo: File | null,
) {
  if (photo) {
    const problem = await profileImageProblem(photo);
    if (problem) throw new CreatorProfileError(0, problem);
  }

  let saved = original;
  const createdPostIds = new Map<number, number>();
  try {
    const changes = Object.fromEntries(Object.entries(update).filter(([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(original[key as keyof CreatorProfileUpdate]),
    ));
    if (Object.keys(changes).length) {
      const response = parseCreatorProfile(await send(ownCreatorProfilePath, token, {
        method: "PATCH", body: JSON.stringify(changes),
      }));
      saved = { ...response, sample_posts: saved.sample_posts };
    }

    const retained = new Set(posts.map((post) => post.post_id));
    for (const post of original.sample_posts) {
      if (retained.has(post.post_id)) continue;
      try {
        await send(`${samplePostsPath}/${post.post_id}`, token, { method: "DELETE" });
      } catch (error) {
        if (!(error instanceof CreatorProfileError)
          || (error.status !== 404 && !uncertainResponse(error.status))) throw error;
        const currentPosts = await getSamplePosts(token);
        if (currentPosts.some((item) => item.post_id === post.post_id)) throw error;
      }
      saved = { ...saved, sample_posts: saved.sample_posts.filter((item) => item.post_id !== post.post_id) };
    }
    const previousPosts = new Map(original.sample_posts.map((post) => [post.post_id, post]));
    for (const [index, { post_id: id, url, caption }] of posts.entries()) {
      if (id == null) {
        let created: CreatorSamplePost;
        try {
          created = parseSamplePost(await send(samplePostsPath, token, {
            method: "POST", body: JSON.stringify({ url, caption }),
          }));
        } catch (error) {
          if (error instanceof CreatorProfileError && uncertainResponse(error.status)) {
            throw new CreatorProfileError(
              error.status,
              "Could not confirm whether the sample post was created. Reload the profile before trying again.",
              saved === original ? null : saved,
              createdPostIds,
              true,
            );
          }
          throw error;
        }
        createdPostIds.set(index, created.post_id);
        saved = { ...saved, sample_posts: [...saved.sample_posts, created] };
        continue;
      }
      const previous = previousPosts.get(id);
      const changes = {
        ...(previous?.url !== url ? { url } : {}),
        ...(previous?.caption !== caption ? { caption } : {}),
      };
      if (!Object.keys(changes).length) continue;
      const edited = parseSamplePost(await send(`${samplePostsPath}/${id}`, token, {
        method: "PATCH", body: JSON.stringify(changes),
      }));
      saved = { ...saved, sample_posts: saved.sample_posts.map((post) => post.post_id === id ? edited : post) };
    }
    if (photo) {
      const body = new FormData();
      body.append("file", photo, photo.name || "profile-image");
      const response = parseCreatorProfile(await send(ownCreatorPhotoPath, token, { method: "POST", body }));
      if (!response.photo_url) throw new CreatorProfileError(200, "The upload response did not include a photo URL.");
      saved = { ...response, sample_posts: saved.sample_posts };
    }
    return saved;
  } catch (error) {
    if (error instanceof CreatorProfileError && !error.reloadRequired && saved !== original) {
      throw new CreatorProfileError(error.status, error.message, saved, createdPostIds);
    }
    throw error;
  }
}
