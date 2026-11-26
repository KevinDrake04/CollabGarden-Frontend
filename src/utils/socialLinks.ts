// Supported social profiles and shared handle and URL validation.

export type SocialPlatformId = keyof typeof platformDefinitions;

export type CreatorSocialLink = {
  platform: SocialPlatformId;
  url: string;
};

type PlatformDefinition = {
  label: string;
  group: "primary" | "additional";
  inputLabel: string;
  placeholder: string;
  example: string;
  errorExample: string;
  hosts: readonly string[] | null;
  handleBase: string | null;
  requiresProfilePath: boolean;
  displayAt: boolean;
  icon: string;
};

const platformDefinitions = {
  instagram: {
    label: "Instagram",
    group: "primary",
    inputLabel: "Instagram username or link",
    placeholder: "yourname",
    example: "https://instagram.com/yourname",
    errorExample: "yourname or https://instagram.com/yourname",
    hosts: ["instagram.com"],
    handleBase: "https://instagram.com/",
    requiresProfilePath: true,
    displayAt: false,
    icon: "/icons/social/instagram.svg",
  },
  tiktok: {
    label: "TikTok",
    group: "primary",
    inputLabel: "TikTok username or link",
    placeholder: "@yourname",
    example: "https://www.tiktok.com/@yourname",
    errorExample: "@yourname or https://www.tiktok.com/@yourname",
    hosts: ["tiktok.com", "vm.tiktok.com"],
    handleBase: "https://www.tiktok.com/@",
    requiresProfilePath: true,
    displayAt: true,
    icon: "/icons/social/tiktok.svg",
  },
  youtube: {
    label: "YouTube",
    group: "primary",
    inputLabel: "YouTube handle or link",
    placeholder: "@yourname",
    example: "https://www.youtube.com/@yourname",
    errorExample: "@yourname or https://www.youtube.com/@yourname",
    hosts: ["youtube.com", "m.youtube.com", "youtu.be"],
    handleBase: "https://www.youtube.com/@",
    requiresProfilePath: true,
    displayAt: true,
    icon: "/icons/social/youtube.svg",
  },
  facebook: {
    label: "Facebook",
    group: "primary",
    inputLabel: "Facebook username or link",
    placeholder: "yourname",
    example: "https://www.facebook.com/yourname",
    errorExample: "yourname or https://www.facebook.com/yourname",
    hosts: ["facebook.com", "m.facebook.com"],
    handleBase: "https://www.facebook.com/",
    requiresProfilePath: true,
    displayAt: false,
    icon: "/icons/social/facebook.svg",
  },

  x: {
    label: "X / Twitter",
    group: "additional",
    inputLabel: "X / Twitter username or link",
    placeholder: "@yourname",
    example: "https://x.com/yourname",
    errorExample: "@yourname or https://x.com/yourname",
    hosts: ["x.com", "twitter.com", "mobile.twitter.com"],
    handleBase: "https://x.com/",
    requiresProfilePath: true,
    displayAt: true,
    icon: "/icons/social/x.svg",
  },
  website: {
    label: "Website",
    group: "additional",
    inputLabel: "Website link",
    placeholder: "yourwebsite.com",
    example: "https://yourwebsite.com",
    errorExample: "https://yourwebsite.com",
    hosts: null,
    handleBase: null,
    requiresProfilePath: false,
    displayAt: false,
    icon: "",
  },
} satisfies Record<string, PlatformDefinition>;

export function socialPlatform(id: SocialPlatformId) {
  return { id, ...platformDefinitions[id] };
}

export const socialPlatforms = (Object.keys(platformDefinitions) as SocialPlatformId[]).map(socialPlatform);

const maxUrlLength = 500;
const shortLinkHosts = new Set(["vm.tiktok.com", "youtu.be"]);
const reservedPaths = new Set(["profile.php", "share", "watch"]);

const knownHosts = new Set(socialPlatforms.flatMap((platform) => platform.hosts ?? []));
export function isSocialPlatform(platform: string): platform is SocialPlatformId {
  return Object.hasOwn(platformDefinitions, platform);
}

function linkError(platform: ReturnType<typeof socialPlatform>) {
  if (platform.id === "website") return `Enter a link, such as ${platform.example}.`;
  return `Enter a handle or link, such as ${platform.errorExample}.`;
}

function siteHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function looksLikeUrl(value: string, platform: ReturnType<typeof socialPlatform>) {
  if (value.includes("://") || value.startsWith("//")) return true;
  const host = value.split(/[/?#]/)[0]?.toLowerCase().replace(/^www\./, "") ?? "";
  if (knownHosts.has(host)) return true;
  if (platform.id !== "website") return false;
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
  platform: ReturnType<typeof socialPlatform>,
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
  } else if (!url.hostname.includes(".")) {
    return { error: linkError(platform) };
  }
  if (platform.requiresProfilePath && (url.pathname === "/" || url.pathname === "")) {
    return { error: `Include the ${platform.label} profile name in the link.` };
  }
  if (url.href.length > maxUrlLength) return { error: "Use a link under 500 characters." };
  return { url: url.href };
}

export function acceptSocialLink(
  platformId: SocialPlatformId,
  raw: string,
): { url: string } | { error: string } {
  const platform = socialPlatform(platformId);
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return { error: linkError(platform) };

  if (looksLikeUrl(trimmed, platform)) return profileUrl(platform, trimmed);
  const handle = handleValue(trimmed);
  if (!platform.handleBase || !handle) return { error: linkError(platform) };
  const url = `${platform.handleBase}${encodeURIComponent(handle)}`;
  return url.length <= maxUrlLength ? { url } : { error: "Use a link under 500 characters." };
}

export function socialLinkSummary(platformId: SocialPlatformId, url: string) {
  const platform = socialPlatform(platformId);
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const host = siteHost(parsed);
  let parts: string[];
  try {
    parts = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  } catch {
    parts = parsed.pathname.split("/").filter(Boolean);
  }

  const name = parts[0] ?? "";
  const singleProfile = parts.length === 1 && !parsed.search && !reservedPaths.has(name.toLowerCase());
  if (platform.id !== "website" && singleProfile && !shortLinkHosts.has(host)) {
    if (name.startsWith("@")) return name;
    if (platform.displayAt) return `@${name}`;
    return name;
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  return `${host}${path}${parsed.search}`;
}
