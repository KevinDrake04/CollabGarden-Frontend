import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AppButton,
  AppInput,
  AppSelect,
  AppTextarea,
  CreatorSocialLinks,
} from "../../../components";
import { type County } from "../../../api/directory";
import {
  creatorProfileLimits,
  followerRanges,
  sameCreatorLinks,
  type CreatorProfile,
  type CreatorProfileUpdate,
  type CreatorSamplePostEdit,
  type CreatorSave,
} from "../../../api/creatorProfile";
import { isPublicHttpUrl } from "../../../utils/profileUrl";
import { isSocialPlatform, type CreatorSocialLink } from "../../../utils/socialLinks";
import { emptyProfileImage, ProfileImageField } from "../shared/ProfileImageField";
import { AccountField } from "../shared/workspaceSession";
import { SamplePostsField, type SamplePostDraft } from "./SamplePostsField";

type PostErrors = { url?: string; caption?: string };

type FieldErrors = {
  displayName?: string;
  niche?: string;
  bio?: string;
  countyId?: string;
  followerRange?: string;
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

function profileFields(profile: CreatorProfile) {
  return {
    displayName: profile.display_name,
    niche: profile.niche ?? "",
    bio: profile.bio ?? "",
    countyId: profile.county_id == null ? "none" : String(profile.county_id),
    followerRange: profile.follower_range ?? "none",
    socialLinks: profile.social_links.filter((link): link is CreatorSocialLink => isSocialPlatform(link.platform)),
  };
}

function draftFromProfile(profile: CreatorProfile): Draft {
  return {
    ...profileFields(profile),
    posts: profile.sample_posts.map(({ post_id, url, caption }) => ({
      key: `saved-${post_id}`, postId: post_id, url, caption: caption ?? "",
    })),
  };
}

function prepareSave(draft: Draft, profile: CreatorProfile, counties: County[]) {
  const errors: FieldErrors = { posts: {} };
  const fields: Omit<CreatorProfileUpdate, "social_links"> = {
    display_name: draft.displayName.trim(),
    niche: draft.niche.trim() || null,
    bio: draft.bio.trim() || null,
    county_id: draft.countyId === "none" ? null : Number(draft.countyId),
    follower_range: draft.followerRange === "none" ? null : draft.followerRange,
  };
  const changes: Partial<CreatorProfileUpdate> = Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => profile[key as keyof typeof fields] !== value),
  );
  if (!profile.social_links.some(({ platform }) => !isSocialPlatform(platform))
    && !sameCreatorLinks(draft.socialLinks, profile.social_links)) {
    changes.social_links = draft.socialLinks;
  }

  if (changes.display_name !== undefined) {
    if (!fields.display_name) errors.displayName = "Enter a display name.";
    else if (fields.display_name.length > creatorProfileLimits.displayName) {
      errors.displayName = "Use 100 characters or fewer for the display name.";
    }
  }
  if (changes.niche && changes.niche.length > creatorProfileLimits.niche) errors.niche = "Use 60 characters or fewer for the niche.";
  if (changes.bio && changes.bio.length > creatorProfileLimits.bio) errors.bio = "Use 2000 characters or fewer for the bio.";
  if (changes.county_id != null && !counties.some(({ county_id }) => county_id === changes.county_id)) {
    errors.countyId = "Choose a county from the list.";
  }
  if (changes.follower_range != null && !followerRanges.some((range) => range === changes.follower_range)) {
    errors.followerRange = "Choose a follower range from the list.";
  }

  const previousPosts = new Map(profile.sample_posts.map((post) => [post.post_id, post]));
  const posts = draft.posts.map(({ key, postId, url, caption }): CreatorSamplePostEdit => {
    const previous = postId == null ? undefined : previousPosts.get(postId);
    const normalizedUrl = url.trim();
    const normalizedCaption = caption.trim() || null;
    const row: PostErrors = {};
    const update: CreatorSamplePostEdit = { key, post_id: postId };
    if (normalizedUrl !== previous?.url) {
      update.url = normalizedUrl;
      if (!normalizedUrl) row.url = "Enter a link for this sample post.";
      else if (normalizedUrl.length > creatorProfileLimits.postUrl) row.url = "Use a link that is 500 characters or fewer.";
      else if (!isPublicHttpUrl(normalizedUrl)) row.url = "Enter a public link starting with http:// or https://.";
    }
    if (normalizedCaption !== previous?.caption) {
      update.caption = normalizedCaption;
      if (normalizedCaption && normalizedCaption.length > creatorProfileLimits.caption) {
        row.caption = "Use 500 characters or fewer for the caption.";
      }
    }
    if (row.url || row.caption) errors.posts[key] = row;
    return update;
  });

  return { changes, posts, errors };
}

export function CreatorProfileForm({
  email,
  profile,
  counties,
  onCancel,
  onSave,
}: {
  email: string;
  profile: CreatorProfile;
  counties: County[];
  onCancel: () => void;
  onSave: (update: Partial<CreatorProfileUpdate>, posts: CreatorSamplePostEdit[], photo: File | null) => Promise<CreatorSave | undefined>;
}) {
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const [errors, setErrors] = useState<FieldErrors>(emptyErrors);
  const [image, setImage] = useState(emptyProfileImage);
  const [alert, setAlert] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [check, setCheck] = useState<CreatorSave["check"]>();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const nextPostKey = useRef(0);
  const disabled = submitting || Boolean(check);
  const originalCountyId = profile.county_id;
  const hasUnsupportedLinks = profile.social_links.some(({ platform }) => !isSocialPlatform(platform));

  useEffect(() => {
    if (alert) alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [alert]);

  const countyOptions = [
    { value: "none", label: "Not listed" },
    ...counties.map(({ county_id, name }) => ({ value: String(county_id), label: name })),
  ];
  if (originalCountyId != null && !counties.some((county) => county.county_id === originalCountyId)) {
    countyOptions.push({ value: String(originalCountyId), label: `County ${originalCountyId}` });
  }

  const followerOptions = [
    { value: "none", label: "Not listed" },
    ...followerRanges.map((range) => ({ value: range, label: range })),
  ];
  if (profile.follower_range && !followerOptions.some(({ value }) => value === profile.follower_range)) {
    followerOptions.push({ value: profile.follower_range, label: profile.follower_range });
  }

  function patchDraft(patch: Partial<Draft>, errorKey?: keyof Omit<FieldErrors, "posts">) {
    setDraft((current) => ({ ...current, ...patch }));
    if (errorKey) setErrors((current) => ({ ...current, [errorKey]: undefined }));
    setAlert("");
  }

  function clearPostError(key: string) {
    setErrors((current) => {
      if (!current.posts[key]) return current;
      const { [key]: previous, ...posts } = current.posts;
      return { ...current, posts };
    });
    setAlert("");
  }

  async function finish(save: () => Promise<CreatorSave | undefined>, rechecking = false) {
    setSubmitting(true);
    setAlert("");
    try {
      const result = await save();
      if (!result) return;
      const { saved } = result;
      setDraft((current) => {
        const fields = profileFields(saved.profile);
        if (!saved.detailsSaved) {
          const previous = profileFields(profile);
          for (const key of ["displayName", "niche", "bio", "countyId", "followerRange"] as const) {
            if (current[key] !== previous[key]) fields[key] = current[key];
          }
          if (!sameCreatorLinks(current.socialLinks, previous.socialLinks)) fields.socialLinks = current.socialLinks;
        }
        const posts = current.posts.map((row) => {
          const post = saved.savedPosts.get(row.key);
          return post ? { ...row, postId: post.post_id, url: post.url, caption: post.caption ?? "" } : row;
        });
        return { ...fields, posts };
      });
      if (saved.imageSaved) setImage(emptyProfileImage);
      setCheck(() => result.check);
      if (result.error) {
        const partial = saved.detailsSaved || saved.profile.sample_posts !== profile.sample_posts || saved.imageSaved;
        setAlert(`${partial ? "Some changes were saved. " : ""}${result.error.message}`);
      } else if (rechecking) {
        setAlert("Saved changes checked. Review any remaining edits.");
      }
    } catch {
      setAlert("Profile changes could not be saved. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || image.checking) return;
    const { changes, posts, errors } = prepareSave(draft, profile, counties);
    setErrors(errors);
    const { posts: postErrors, ...fieldErrors } = errors;
    if (image.error || Object.keys(fieldErrors).length || Object.keys(postErrors).length) {
      setAlert(image.error || "Check the highlighted fields and try again.");
      return;
    }
    void finish(() => onSave(changes, posts, image.file));
  }


  return (
    <form noValidate aria-label="Edit profile" className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
      <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">Edit profile</h3>
      <dl>
        <AccountField label="Email">{email}</AccountField>
      </dl>
      <ProfileImageField
        label="Profile image"
        name={draft.displayName || profile.display_name}
        savedUrl={profile.photo_url}
        selection={image}
        disabled={disabled}
        onChange={(selection) => {
          setImage(selection);
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
          disabled={disabled}
          required
        />
        <AppInput
          label="Niche"
          name="niche"
          value={draft.niche}
          onChange={(niche) => patchDraft({ niche }, "niche")}
          placeholder="Food, plants, local events"
          error={errors.niche}
          disabled={disabled}
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
          disabled={disabled}
        />
        <AppSelect
          label="Followers"
          name="followerRange"
          value={draft.followerRange}
          onChange={(followerRange) => patchDraft({ followerRange: followerRange || "none" }, "followerRange")}
          options={followerOptions}
          placeholder="Select a range"
          error={errors.followerRange}
          disabled={disabled}
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
          disabled={disabled}
        />
      </div>
      <CreatorSocialLinks
        links={draft.socialLinks}
        onChange={(socialLinks) => patchDraft({ socialLinks })}
        disabled={disabled || hasUnsupportedLinks}
        note={hasUnsupportedLinks
          ? "Your saved social links include a platform this editor cannot change. They will be kept."
          : "Optional. A saved link is not a login and does not verify the account."}
      />
      <SamplePostsField
        posts={draft.posts}
        errors={errors.posts}
        disabled={disabled}
        onChange={(key, patch) => {
          setDraft((current) => ({
            ...current,
            posts: current.posts.map((post) => (post.key === key ? { ...post, ...patch } : post)),
          }));
          clearPostError(key);
        }}
        onRemove={(key) => {
          setDraft((current) => ({ ...current, posts: current.posts.filter((post) => post.key !== key) }));
          clearPostError(key);
        }}
        onAdd={() => {
          const row = { key: `new-${++nextPostKey.current}`, postId: null, url: "", caption: "" };
          setDraft((current) => ({ ...current, posts: [...current.posts, row] }));
          setAlert("");
        }}
      />
      {alert && (
        <p ref={alertRef} role="alert" className="text-sm text-[var(--cg-error)]">{alert}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <AppButton type="submit" isDisabled={disabled || image.checking}>
          {submitting ? "Saving..." : "Save changes"}
        </AppButton>
        <AppButton type="button" variant="secondary" isDisabled={submitting} onPress={check ? () => void finish(check, true) : onCancel}>
          {check ? "Check saved changes" : "Cancel"}
        </AppButton>
      </div>
    </form>
  );
}
