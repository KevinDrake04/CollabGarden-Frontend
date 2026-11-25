// Public profile links. Unknown, empty, and non-http(s) values are left out
// so older creators with no social_links still render the same profile.

import { socialPlatforms, type SocialPlatformId } from "../../utils/socialLinks";

export type CreatorLinkInput = {
  platform?: string | null;
  url?: string | null;
};

export const creatorLinkPlatforms = socialPlatforms.map((platform) => ({
  id: platform.id,
  label: platform.publicLabel,
  icon: platform.icon,
}));

export type CreatorLinkPlatformId = SocialPlatformId;

export type VisibleCreatorLink = {
  id: CreatorLinkPlatformId;
  label: string;
  icon: string;
  href: string;
};

function safeHttpUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function visibleCreatorLinks(links: CreatorLinkInput[] | null | undefined) {
  if (!Array.isArray(links)) return [];

  const visible: VisibleCreatorLink[] = [];
  for (const platform of creatorLinkPlatforms) {
    let href: string | null = null;
    for (const link of links) {
      if (link?.platform?.trim().toLowerCase() !== platform.id) continue;
      href = safeHttpUrl(link.url);
      if (href) break;
    }
    if (!href) continue;
    visible.push({
      id: platform.id,
      label: platform.label,
      icon: platform.icon,
      href,
    });
  }
  return visible;
}
