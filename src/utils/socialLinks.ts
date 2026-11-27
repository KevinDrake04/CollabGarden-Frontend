export type SocialPlatformId = keyof typeof platforms;

export type CreatorSocialLink = {
  platform: SocialPlatformId;
  url: string;
};

export type SignupSocialLink = CreatorSocialLink;

type PlatformDefinition = {
  label: string;
  publicLabel?: string;
  group: "primary" | "additional";
  inputLabel: string;
  placeholder: string;
  example: string;
  hosts: readonly string[] | null;
  handleBase: string | null;
  displayAt: boolean;
  icon: string;
};

const platforms = {
  instagram: {
    label: "Instagram",
    group: "primary",
    inputLabel: "Instagram username or link",
    placeholder: "yourname",
    example: "https://instagram.com/yourname",
    hosts: ["instagram.com"],
    handleBase: "https://instagram.com/",
    displayAt: false,
    icon: "/icons/social/instagram.svg",
  },
  tiktok: {
    label: "TikTok",
    group: "primary",
    inputLabel: "TikTok username or link",
    placeholder: "@yourname",
    example: "https://www.tiktok.com/@yourname",
    hosts: ["tiktok.com", "vm.tiktok.com"],
    handleBase: "https://www.tiktok.com/@",
    displayAt: true,
    icon: "/icons/social/tiktok.svg",
  },
  youtube: {
    label: "YouTube",
    group: "primary",
    inputLabel: "YouTube handle or link",
    placeholder: "@yourname",
    example: "https://www.youtube.com/@yourname",
    hosts: ["youtube.com", "m.youtube.com", "youtu.be"],
    handleBase: "https://www.youtube.com/@",
    displayAt: true,
    icon: "/icons/social/youtube.svg",
  },
  facebook: {
    label: "Facebook",
    group: "primary",
    inputLabel: "Facebook username or link",
    placeholder: "yourname",
    example: "https://www.facebook.com/yourname",
    hosts: ["facebook.com", "m.facebook.com"],
    handleBase: "https://www.facebook.com/",
    displayAt: false,
    icon: "/icons/social/facebook.svg",
  },
  x: {
    label: "X / Twitter",
    publicLabel: "X",
    group: "additional",
    inputLabel: "X / Twitter username or link",
    placeholder: "@yourname",
    example: "https://x.com/yourname",
    hosts: ["x.com", "twitter.com", "mobile.twitter.com"],
    handleBase: "https://x.com/",
    displayAt: true,
    icon: "/icons/social/x.svg",
  },
  website: {
    label: "Website",
    group: "additional",
    inputLabel: "Website link",
    placeholder: "yourwebsite.com",
    example: "https://yourwebsite.com",
    hosts: null,
    handleBase: null,
    displayAt: false,
    icon: "",
  },
} satisfies Record<string, PlatformDefinition>;

export const socialPlatforms: readonly (PlatformDefinition & { id: SocialPlatformId })[] =
  (Object.keys(platforms) as SocialPlatformId[]).map((id) => ({ id, ...platforms[id] }));

const maxUrlLength = 500;
const shortLinkHosts = new Set(["vm.tiktok.com", "youtu.be"]);
const reservedPaths = new Set(["profile.php", "share", "watch"]);

const knownHosts = new Set(socialPlatforms.flatMap((platform) => platform.hosts ?? []));
export function isSocialPlatform(platform: string): platform is SocialPlatformId {
  return Object.hasOwn(platforms, platform);
}

function linkError(platform: PlatformDefinition) {
  if (!platform.handleBase) return `Enter a link, such as ${platform.example}.`;
  return `Enter a handle or link, such as ${platform.placeholder} or ${platform.example}.`;
}

function siteHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function looksLikeUrl(value: string, platform: PlatformDefinition) {
  if (value.includes("://") || value.startsWith("//")) return true;
  const host = value.split(/[/?#]/)[0]?.toLowerCase().replace(/^www\./, "") ?? "";
  if (knownHosts.has(host)) return true;
  if (platform.hosts) return false;
  return host.includes(".") && /^[a-z0-9.-]+$/i.test(host);
}

function handleValue(value: string) {
  const handle = value.startsWith("@") ? value.slice(1) : value;
  if (!handle || handle.length > 50) return null;
  if (!/^[\p{L}\p{N}._-]+$/u.test(handle)) return null;
  if (!/[\p{L}\p{N}]/u.test(handle)) return null;
  return handle;
}

function profileUrl(
  platform: PlatformDefinition,
  value: string,
): { url: string } | { error: string } {
  let candidate = value;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { error: linkError(platform) };
  }

  if (url.username || url.password) {
    return { error: "Enter the public profile link, not login details." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { error: linkError(platform) };
  if (platform.hosts) {
    if (!platform.hosts.includes(siteHost(url))) return { error: linkError(platform) };
    if (url.pathname === "/") {
      return { error: `Include the ${platform.label} profile name in the link.` };
    }
  } else if (!url.hostname.includes(".")) {
    return { error: linkError(platform) };
  }
  if (url.href.length > maxUrlLength) return { error: "Use a link under 500 characters." };
  return { url: url.href };
}

export function readSignupLink(
  platformId: SocialPlatformId,
  raw: string,
): { status: "empty" } | { status: "error"; error: string } | { status: "ok"; url: string } {
  const platform = platforms[platformId];
  const trimmed = raw.trim();
  if (!trimmed) return { status: "empty" };
  if (/\s/.test(trimmed)) return { status: "error", error: linkError(platform) };

  if (!looksLikeUrl(trimmed, platform)) {
    const handle = handleValue(trimmed);
    if (!platform.handleBase || !handle) return { status: "error", error: linkError(platform) };
    const url = `${platform.handleBase}${encodeURIComponent(handle)}`;
    if (url.length > maxUrlLength) {
      return { status: "error", error: "Use a link under 500 characters." };
    }
    return { status: "ok", url };
  }

  const normalized = profileUrl(platform, trimmed);
  if ("url" in normalized) return { status: "ok", url: normalized.url };
  return { status: "error", error: normalized.error };
}

export function requiredCreatorLinkError(links: readonly CreatorSocialLink[]) {
  if (links.length === 0) return "Add at least one link to continue";
  if (links.some(({ platform }) => platforms[platform].group === "primary")) return "";
  return "Add an Instagram, TikTok, YouTube, or Facebook link to continue";
}

export function socialLinkSummary(platformId: SocialPlatformId, url: string) {
  const platform = platforms[platformId];
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const host = siteHost(parsed);
  const parts = parsed.pathname.split("/").filter(Boolean);
  let name = parts[0] ?? "";
  try { name = decodeURIComponent(name); } catch { /* Keep malformed escapes as written. */ }

  const singleProfile = parts.length === 1 && !parsed.search && !reservedPaths.has(name.toLowerCase());
  if (platform.hosts && singleProfile && !shortLinkHosts.has(host)) {
    if (name.startsWith("@")) return name;
    if (platform.displayAt) return `@${name}`;
    return name;
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  return `${host}${path}${parsed.search}`;
}
