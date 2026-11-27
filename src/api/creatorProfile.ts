import { type CreatorSocialLink } from "../utils/socialLinks";
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
} from "./profileRequest";

const profilePath = "/api/v1/creators/me";
const postsPath = `${profilePath}/sample-posts`;

export const followerRanges = ["Under 1K", "1K-10K", "10K-50K", "50K-100K", "100K-500K", "500K-1M", "1M+"] as const;

export const creatorProfileLimits = {
  displayName: 100,
  niche: 60,
  bio: 2000,
  caption: 500,
  postUrl: 500,
} as const;

type SamplePostFields = { url: string; caption: string | null };
type SamplePost = SamplePostFields & { post_id: number };
type StoredSocialLink = { platform: string; url: string };

export type CreatorSamplePostEdit = Partial<SamplePostFields> & { key: string; post_id: number | null };

export type CreatorProfileUpdate = {
  display_name: string;
  bio: string | null;
  niche: string | null;
  county_id: number | null;
  follower_range: string | null;
  social_links: CreatorSocialLink[];
};

export type CreatorProfile = Omit<CreatorProfileUpdate, "social_links"> & {
  creator_id: number;
  status: string;
  photo_url: string | null;
  sample_posts: SamplePost[];
  social_links: StoredSocialLink[];
};

export function sameCreatorLinks(left: readonly StoredSocialLink[], right: readonly StoredSocialLink[]) {
  return left.length === right.length && left.every((link) =>
    right.some(({ platform, url }) => link.platform === platform && link.url === url));
}

function readSamplePost(body: unknown): SamplePost {
  const row = profileRecord(body);
  const post_id = profileId(row.post_id);
  if (!post_id) throw new ProfileRequestError(200, "The sample post response was incomplete.");
  return { post_id, url: profileText(row.url) ?? "", caption: profileText(row.caption) };
}

function readPosts(body: unknown) {
  if (!Array.isArray(body)) throw new ProfileRequestError(200, "The sample post list was incomplete.");
  return body.map(readSamplePost);
}

function readSocialLinks(body: unknown): StoredSocialLink[] {
  if (body == null) return [];
  if (!Array.isArray(body)) throw new ProfileRequestError(200, "The social profile response was incomplete.");
  return body.map((item) => {
    const row = profileRecord(item);
    const platform = profileText(row.platform);
    if (!platform) throw new ProfileRequestError(200, "The social profile response was incomplete.");
    return { platform, url: profileText(row.url) ?? "" };
  });
}

function readCreator(row: Record<string, unknown>): Omit<CreatorProfile, "sample_posts"> {
  const creator_id = profileId(row.creator_id);
  const status = profileText(row.status);
  if (!creator_id || !status || typeof row.display_name !== "string") {
    throw new ProfileRequestError(200, "The creator profile response was incomplete.");
  }
  return {
    creator_id,
    status,
    display_name: row.display_name.trim(),
    photo_url: profileImageUrl(row.photo_url),
    bio: profileText(row.bio),
    niche: profileText(row.niche),
    follower_range: profileText(row.follower_range),
    county_id: profileId(row.county_id),
    social_links: readSocialLinks(row.social_links),
  };
}

async function getSamplePosts(token: string, signal?: AbortSignal) {
  return readPosts(await profileRequest(postsPath, token, { signal }));
}

export async function getOwnCreatorProfile(token: string, signal?: AbortSignal): Promise<CreatorProfile> {
  const body = profileRecord(await profileRequest(profilePath, token, { signal }));
  const profile = readCreator(body);
  const sample_posts = body.sample_posts === undefined
    ? await getSamplePosts(token, signal)
    : readPosts(body.sample_posts);
  return { ...profile, sample_posts };
}

function postMatches(post: SamplePost, changes: Partial<SamplePostFields>) {
  return (changes.url === undefined || post.url === changes.url)
    && (changes.caption === undefined || post.caption === changes.caption);
}

export function saveCreatorProfile(
  token: string,
  original: CreatorProfile,
  changes: Partial<CreatorProfileUpdate>,
  posts: CreatorSamplePostEdit[],
  photo: File | null,
  signal: AbortSignal,
) {
  const { sample_posts: initialPosts, ...initialDetails } = original;
  let profile = original;
  let detailsSaved = false;
  let imageSaved = false;
  const savedPosts = new Map<string, SamplePost>();

  function applyProfile(current: Omit<CreatorProfile, "sample_posts">) {
    if (current.creator_id !== original.creator_id) {
      throw new ProfileRequestError(403, "The creator account changed. Open your account again before saving.");
    }
    profile = { ...current, sample_posts: profile.sample_posts };
  }

  async function readProfile() {
    const current = readCreator(profileRecord(await profileRequest(profilePath, token, { signal })));
    applyProfile(current);
    return current;
  }

  function applyPost(key: string, post: SamplePost) {
    const exists = profile.sample_posts.some(({ post_id }) => post_id === post.post_id);
    const sample_posts = exists
      ? profile.sample_posts.map((current) => current.post_id === post.post_id ? post : current)
      : [...profile.sample_posts, post];
    profile = { ...profile, sample_posts };
    savedPosts.set(key, post);
  }

  return profileSaveResult(async () => {
    if (Object.keys(changes).length) {
      await confirmProfileWrite(async () => {
        const body = await profileRequest(profilePath, token, { method: "PATCH", body: JSON.stringify(changes), signal });
        applyProfile(readCreator(completeProfileRecord(body, initialDetails)));
        detailsSaved = true;
      }, async (acknowledged) => {
        const current = await readProfile();
        detailsSaved = acknowledged || Object.entries(changes).every(([key, value]) =>
          key === "social_links" ? sameCreatorLinks(changes.social_links ?? [], current.social_links)
            : current[key as keyof CreatorProfileUpdate] === value);
        return detailsSaved;
      }, "the creator profile");
    }

    const retained = new Set(posts.map(({ post_id }) => post_id));
    for (const { post_id } of initialPosts) {
      if (retained.has(post_id)) continue;
      const remove = () => {
        profile = { ...profile, sample_posts: profile.sample_posts.filter((post) => post.post_id !== post_id) };
      };
      await confirmProfileWrite(async () => {
        await profileRequest(`${postsPath}/${post_id}`, token, { method: "DELETE", signal });
        remove();
      }, async () => {
        if ((await getSamplePosts(token, signal)).some((post) => post.post_id === post_id)) return false;
        remove();
        return true;
      }, "the sample post removal", { checkNotFound: true });
    }

    for (const { key, post_id, ...fields } of posts) {
      if (!Object.keys(fields).length) continue;
      if (post_id == null) {
        const knownIds = new Set(profile.sample_posts.map((post) => post.post_id));
        let returnedId: number | null = null;
        await confirmProfileWrite(async () => {
          const body = profileRecord(await profileRequest(postsPath, token, { method: "POST", body: JSON.stringify(fields), signal }));
          const id = profileId(body.post_id);
          if (id && !knownIds.has(id)) returnedId = id;
          const created = readSamplePost(completeProfileRecord(body, { url: "", caption: null }));
          if (knownIds.has(created.post_id)) throw new ProfileRequestError(200, "The created post could not be identified.");
          applyPost(key, created);
        }, async () => {
          const matches = (await getSamplePosts(token, signal)).filter((post) =>
            returnedId === null ? !knownIds.has(post.post_id) && postMatches(post, fields) : post.post_id === returnedId);
          if (matches.length > 1) throw new ProfileRequestError(409, "Several new sample posts match.");
          if (matches.length === 0) return false;
          applyPost(key, matches[0]);
          return true;
        }, "the new sample post", { checkLater: true });
        continue;
      }

      await confirmProfileWrite(async () => {
        const body = await profileRequest(`${postsPath}/${post_id}`, token, {
          method: "PATCH", body: JSON.stringify(fields), signal,
        });
        const edited = readSamplePost(completeProfileRecord(body, { url: "", caption: null }));
        if (edited.post_id !== post_id) throw new ProfileRequestError(200, "The updated post could not be identified.");
        applyPost(key, edited);
      }, async (acknowledged) => {
        const current = (await getSamplePosts(token, signal)).find((post) => post.post_id === post_id);
        if (!current) return false;
        const confirmed = acknowledged || postMatches(current, fields);
        if (confirmed) applyPost(key, current);
        else profile = { ...profile, sample_posts: profile.sample_posts.map((post) => post.post_id === post_id ? current : post) };
        return confirmed;
      }, "the sample post edit");
    }

    if (photo) {
      const previous = profile.photo_url;
      const body = new FormData();
      body.append("file", photo);
      await confirmProfileWrite(async () => {
        const response = readCreator(completeProfileRecord(await profileRequest(`${profilePath}/photo`, token, {
          method: "POST", body, signal,
        }), initialDetails));
        if (!response.photo_url) throw new ProfileRequestError(200, "The photo response was incomplete.");
        applyProfile(response);
        imageSaved = true;
      }, async (acknowledged) => {
        const current = await readProfile();
        imageSaved = Boolean(current.photo_url && (acknowledged || current.photo_url !== previous));
        return imageSaved;
      }, "the profile photo");
    }
  }, () => ({ profile, detailsSaved, imageSaved, savedPosts: new Map(savedPosts) }));
}

export type CreatorSave = Awaited<ReturnType<typeof saveCreatorProfile>>;
