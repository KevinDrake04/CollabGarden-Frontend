import { socialPlatforms, type SocialPlatformId } from "../../utils/socialLinks";

export type CreatorLinkInput = {
  platform?: string | null;
  url?: string | null;
};

type VisibleCreatorLink = {
  id: SocialPlatformId;
  label: string;
  icon: string;
  href: string;
};

function safeHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
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
  for (const platform of socialPlatforms) {
    for (const link of links) {
      if (typeof link?.platform !== "string" || link.platform.trim().toLowerCase() !== platform.id) continue;
      const href = safeHttpUrl(link.url);
      if (!href) continue;
      visible.push({
        id: platform.id,
        label: platform.publicLabel ?? platform.label,
        icon: platform.icon,
        href,
      });
      break;
    }
  }
  return visible;
}
