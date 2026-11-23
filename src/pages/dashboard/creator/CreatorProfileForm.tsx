import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AppButton,
  AppInput,
  AppSelect,
  AppTextarea,
  CreatorSocialLinks,
  profileLinkError,
  type CreatorSocialLink,
} from "../../../components";
import { type County } from "../../../api/directory";
import {
  creatorProfileLimits,
  creatorProfileSaveMessage,
  followerRanges,
  type CreatorProfile,
  type CreatorProfileUpdate,
  type CreatorSamplePost,
} from "../../../api/creatorProfile";
import { AccountField } from "../shared/workspaceSession";
import { ProfileImageField } from "./ProfileImageField";
import { SamplePostsField, type SamplePostDraft } from "./SamplePostsField";

type PostErrors = { url?: string; caption?: string; row?: string };

type FieldErrors = {
  displayName?: string;
  niche?: string;
  bio?: string;
  countyId?: string;
  followerRange?: string;
  social?: string;
  samplePosts?: string;
  posts: Record<string, PostErrors>;
};

type Draft = {
  displayName: string;
  niche: string;
  bio: string;
  countyId: string;
  followerRange: string;
  socialLinks: CreatorSocialLink[];
  posts: SamplePostDraft[];
};

const emptyErrors: FieldErrors = { posts: {} };

let nextPostKey = 1;

function postDraft(url = "", caption = ""): SamplePostDraft {
  const key = `post-${nextPostKey}`;
  nextPostKey += 1;
  return { key, url, caption };
}

function draftFromProfile(profile: CreatorProfile | null, fallbackName: string): Draft {
  return {
    displayName: profile?.display_name || fallbackName,
    niche: profile?.niche ?? "",
    bio: profile?.bio ?? "",
    countyId: profile?.county_id == null ? "none" : String(profile.county_id),
    followerRange: profile?.follower_range ?? "none",
    socialLinks: (profile?.social_links ?? []).map((link) => ({ platform: link.platform, url: link.url })),
    posts: (profile?.sample_posts ?? []).map((post) => postDraft(post.url ?? "", post.caption ?? "")),
  };
}

function postUrlError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > creatorProfileLimits.postUrl) return "Use a link that is 500 characters or fewer.";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Enter a full link starting with http:// or https://.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Enter a link starting with http:// or https://.";
  }
  if (url.username || url.password) return "Enter the public link, not login details.";
  return "";
}

function validate(
  draft: Draft,
  counties: County[],
  originalCountyId: number | null,
  originalFollowerRange: string | null,
  imageError: string,
) {
  const errors: FieldErrors = { posts: {} };
  const displayName = draft.displayName.trim();
  if (!displayName) errors.displayName = "Enter a display name.";
  else if (displayName.length > creatorProfileLimits.displayName) {
    errors.displayName = "Use 80 characters or fewer for the display name.";
  }

  const niche = draft.niche.trim();
  if (niche.length > creatorProfileLimits.niche) errors.niche = "Use 80 characters or fewer for the niche.";

  const bio = draft.bio.trim();
  if (bio.length > creatorProfileLimits.bio) errors.bio = "Use 500 characters or fewer for the bio.";

  if (draft.countyId !== "none") {
    const countyId = Number(draft.countyId);
    const known = counties.some((county) => county.county_id === countyId);
    const keptOriginal = counties.length === 0 && originalCountyId != null && String(originalCountyId) === draft.countyId;
    if (!Number.isInteger(countyId) || (!known && !keptOriginal)) {
      errors.countyId = "Choose a county from the list.";
    }
  }

  const knownRange = followerRanges.some((range) => range === draft.followerRange);
  const keptRange = originalFollowerRange != null && draft.followerRange === originalFollowerRange;
  if (draft.followerRange !== "none" && !knownRange && !keptRange) {
    errors.followerRange = "Choose a follower range from the list.";
  }

  const seen = new Set<string>();
  for (const link of draft.socialLinks) {
    if (seen.has(link.platform)) {
      errors.social = "Add each social profile once.";
      break;
    }
    seen.add(link.platform);
    const linkError = profileLinkError(link.platform, link.url);
    if (linkError) {
      errors.social = linkError;
      break;
    }
  }

  if (draft.posts.length > creatorProfileLimits.samplePosts) {
    errors.samplePosts = `You can add up to ${creatorProfileLimits.samplePosts} sample posts.`;
  }
  for (const post of draft.posts) {
    const url = post.url.trim();
    const caption = post.caption.trim();
    const row: PostErrors = {};
    const urlError = postUrlError(url);
    if (urlError) row.url = urlError;
    if (caption.length > creatorProfileLimits.caption) row.caption = "Use 280 characters or fewer for the caption.";
    if (!url && !caption) row.row = "Enter a link, a caption, or remove this post.";
    if (row.url || row.caption || row.row) errors.posts[post.key] = row;
  }

  return { errors, imageBlocks: Boolean(imageError) };
}

function hasErrors(errors: FieldErrors, imageBlocks: boolean) {
  return Boolean(
    imageBlocks
    || errors.displayName
    || errors.niche
    || errors.bio
    || errors.countyId
    || errors.followerRange
    || errors.social
    || errors.samplePosts
    || Object.keys(errors.posts).length > 0,
  );
}

function toUpdate(draft: Draft, counties: County[], originalCountyId: number | null): CreatorProfileUpdate {
  const posts: CreatorSamplePost[] = draft.posts.map((post) => ({
    url: post.url.trim() || null,
    caption: post.caption.trim() || null,
  }));
  let countyId: number | null = null;
  if (draft.countyId !== "none") {
    const parsed = Number(draft.countyId);
    const known = counties.some((county) => county.county_id === parsed);
    const keptOriginal = counties.length === 0 && originalCountyId != null && String(originalCountyId) === draft.countyId;
    if (Number.isInteger(parsed) && (known || keptOriginal)) countyId = parsed;
  }
  return {
    display_name: draft.displayName.trim(),
    bio: draft.bio.trim() || null,
    niche: draft.niche.trim() || null,
    county_id: countyId,
    follower_range: draft.followerRange === "none" ? null : draft.followerRange,
    social_links: draft.socialLinks.map((link) => ({ platform: link.platform, url: link.url.trim() })),
    sample_posts: posts,
  };
}

export function CreatorProfileForm({
  email,
  profile,
  fallbackName,
  counties,
  onCancel,
  onSave,
}: {
  email: string;
  profile: CreatorProfile | null;
  fallbackName: string;
  counties: County[];
  onCancel: () => void;
  onSave: (update: CreatorProfileUpdate, photo: File | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => draftFromProfile(profile, fallbackName));
  const [errors, setErrors] = useState<FieldErrors>(emptyErrors);
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [alert, setAlert] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const originalCountyId = profile?.county_id ?? null;

  useEffect(() => {
    if (!alert) return;
    alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [alert]);

  const countyOptions = [{ value: "none", label: "Not listed" }];
  for (const county of counties) {
    countyOptions.push({ value: String(county.county_id), label: county.name });
  }
  if (draft.countyId !== "none" && !countyOptions.some((option) => option.value === draft.countyId)) {
    countyOptions.push({ value: draft.countyId, label: `County ${draft.countyId}` });
  }

  const followerOptions = [
    { value: "none", label: "Not listed" },
    ...followerRanges.map((range) => ({ value: range, label: range })),
  ];
  if (draft.followerRange !== "none" && !followerOptions.some((option) => option.value === draft.followerRange)) {
    followerOptions.push({ value: draft.followerRange, label: draft.followerRange });
  }

  function patchDraft(patch: Partial<Draft>, errorKey?: keyof Omit<FieldErrors, "posts">) {
    setDraft((current) => ({ ...current, ...patch }));
    if (errorKey) {
      setErrors((current) => ({ ...current, [errorKey]: undefined }));
    }
    setAlert("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const result = validate(draft, counties, originalCountyId, profile?.follower_range ?? null, imageError);
    setErrors(result.errors);
    if (hasErrors(result.errors, result.imageBlocks)) {
      setAlert(imageError || "Check the highlighted fields and try again.");
      return;
    }

    lock.current = true;
    setSubmitting(true);
    setAlert("");
    try {
      await onSave(toUpdate(draft, counties, originalCountyId), image);
    } catch (error) {
      setAlert(creatorProfileSaveMessage(error));
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form noValidate aria-label="Edit profile" className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
      <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">Edit profile</h3>
      <dl>
        <AccountField label="Email">{email}</AccountField>
      </dl>
      <ProfileImageField
        name={draft.displayName || fallbackName || email}
        savedUrl={profile?.photo_url ?? null}
        file={image}
        error={imageError}
        disabled={submitting}
        onFile={(file) => {
          setImage(file);
          setImageError("");
          setAlert("");
        }}
        onInvalid={(message) => {
          setImageError(message);
          setAlert("");
        }}
        onClear={() => {
          setImage(null);
          setImageError("");
          setAlert("");
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          label="Display name"
          name="displayName"
          value={draft.displayName}
          onChange={(displayName) => patchDraft({ displayName }, "displayName")}
          placeholder="Alex Rivera"
          error={errors.displayName}
          disabled={submitting}
          required
        />
        <AppInput
          label="Niche"
          name="niche"
          value={draft.niche}
          onChange={(niche) => patchDraft({ niche }, "niche")}
          placeholder="Food, plants, local events"
          error={errors.niche}
          disabled={submitting}
        />
        <AppSelect
          label="County"
          name="county"
          value={draft.countyId}
          onChange={(countyId) => patchDraft({ countyId: countyId || "none" }, "countyId")}
          options={countyOptions}
          placeholder="Select a county"
          helper={counties.length === 0 ? "Counties could not be loaded." : undefined}
          error={errors.countyId}
          disabled={submitting}
        />
        <AppSelect
          label="Followers"
          name="followerRange"
          value={draft.followerRange}
          onChange={(followerRange) => patchDraft({ followerRange: followerRange || "none" }, "followerRange")}
          options={followerOptions}
          placeholder="Select a range"
          error={errors.followerRange}
          disabled={submitting}
        />
        <AppTextarea
          className="sm:col-span-2"
          label="Bio"
          name="bio"
          value={draft.bio}
          onChange={(bio) => patchDraft({ bio }, "bio")}
          placeholder="Tell businesses what you create."
          rows={4}
          error={errors.bio}
          disabled={submitting}
        />
      </div>
      <CreatorSocialLinks
        links={draft.socialLinks}
        onChange={(socialLinks) => patchDraft({ socialLinks }, "social")}
        disabled={submitting}
        note="Optional. A saved link is not a login and does not verify the account."
      />
      {errors.social && (
        <p role="alert" className="text-xs text-[var(--cg-error)]">{errors.social}</p>
      )}
      {errors.samplePosts && (
        <p role="alert" className="text-xs text-[var(--cg-error)]">{errors.samplePosts}</p>
      )}
      <SamplePostsField
        posts={draft.posts}
        errors={errors.posts}
        disabled={submitting}
        onChange={(key, patch) => {
          setDraft((current) => ({
            ...current,
            posts: current.posts.map((post) => (post.key === key ? { ...post, ...patch } : post)),
          }));
          setErrors((current) => {
            const posts = { ...current.posts };
            delete posts[key];
            return { ...current, posts };
          });
          setAlert("");
        }}
        onRemove={(key) => {
          setDraft((current) => ({ ...current, posts: current.posts.filter((post) => post.key !== key) }));
          setErrors((current) => {
            const posts = { ...current.posts };
            delete posts[key];
            return { ...current, posts };
          });
          setAlert("");
        }}
        onAdd={() => {
          if (draft.posts.length >= creatorProfileLimits.samplePosts) return;
          setDraft((current) => ({ ...current, posts: [...current.posts, postDraft()] }));
          setAlert("");
        }}
      />
      {alert && (
        <p ref={alertRef} role="alert" className="text-sm text-[var(--cg-error)]">{alert}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <AppButton type="submit" isDisabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </AppButton>
        <AppButton type="button" variant="secondary" isDisabled={submitting} onPress={onCancel}>
          Cancel
        </AppButton>
      </div>
    </form>
  );
}
