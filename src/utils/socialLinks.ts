// One http(s) profile URL per platform. Handles are saved as https URLs.
// The API accepts instagram, tiktok, youtube, facebook, x, and website, and
// rejects a URL over 500 characters or without http(s).
// At least one of Instagram, TikTok, YouTube, or Facebook is required.
// X and Website are optional and do not satisfy that requirement.

const primaryPlatformIds = ["instagram", "tiktok", "youtube", "facebook"] as const;
const additionalPlatformIds = ["x", "website"] as const;
const socialPlatformIds = [...primaryPlatformIds, ...additionalPlatformIds] as const;

type PrimaryPlatformId = (typeof primaryPlatformIds)[number];
type AdditionalPlatformId = (typeof additionalPlatformIds)[number];
export type SocialPlatformId = (typeof socialPlatformIds)[number];

export type SignupSocialLink = {
  platform: SocialPlatformId;
  url: string;
};

type PlatformDefinition<Id extends SocialPlatformId = SocialPlatformId> = {
  id: Id;
  label: string;
  publicLabel: string;
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

const primaryPlatforms: PlatformDefinition<PrimaryPlatformId>[] = [
  {
    id: "instagram",
    label: "Instagram",
    publicLabel: "Instagram",
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
  {
    id: "tiktok",
    label: "TikTok",
    publicLabel: "TikTok",
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
  {
    id: "youtube",
    label: "YouTube",
    publicLabel: "YouTube",
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
  {
    id: "facebook",
    label: "Facebook",
    publicLabel: "Facebook",
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
];

const additionalPlatforms: PlatformDefinition<AdditionalPlatformId>[] = [
  {
    id: "x",
    label: "X / Twitter",
    publicLabel: "X",
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
  {
    id: "website",
    label: "Website",
    publicLabel: "Website",
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
];

export const socialPlatforms: PlatformDefinition[] = [
  ...primaryPlatforms,
  ...additionalPlatforms,
];

const atLeastOneSocialMessage = "Add at least one link to continue";

const primarySocialMessage =
  "Add an Instagram, TikTok, YouTube, or Facebook link to continue";

const maxUrlLength = 500;
const shortLinkHosts = new Set(["vm.tiktok.com", "youtu.be"]);
const reservedPaths = new Set(["profile.php", "share", "watch"]);

const knownHosts = new Set(socialPlatforms.flatMap((platform) => platform.hosts ?? []));
const socialPlatformIdSet = new Set<string>(socialPlatformIds);

export function isSocialPlatform(platform: string): platform is SocialPlatformId {
  return socialPlatformIdSet.has(platform);
}

function platformById(id: SocialPlatformId) {
  const match = socialPlatforms.find((item) => item.id === id);
  if (!match) throw new Error(`Unsupported platform: ${id}`);
  return match;
}

function linkError(platform: PlatformDefinition) {
  if (platform.id === "website") return `Enter a link, such as ${platform.example}.`;
  return `Enter a handle or link, such as ${platform.errorExample}.`;
}

function siteHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function looksLikeUrl(value: string, platform: PlatformDefinition) {
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
  } else if (!url.hostname.includes(".")) {
    return { error: linkError(platform) };
  }
  if (platform.requiresProfilePath && (url.pathname === "/" || url.pathname === "")) {
    return { error: `Include the ${platform.label} profile name in the link.` };
  }
  if (url.href.length > maxUrlLength) return { error: "Use a link under 500 characters." };
  return { url: url.href };
}

export function readSignupLink(
  platformId: SocialPlatformId,
  raw: string,
): { status: "empty" } | { status: "error"; error: string } | { status: "ok"; url: string } {
  const platform = platformById(platformId);
  const trimmed = raw.trim();
  if (!trimmed) return { status: "empty" } as const;
  if (/\s/.test(trimmed)) return { status: "error", error: linkError(platform) } as const;

  if (!looksLikeUrl(trimmed, platform)) {
    if (!platform.handleBase) return { status: "error", error: linkError(platform) } as const;
    const handle = handleValue(trimmed);
    if (!handle) return { status: "error", error: linkError(platform) } as const;
    const url = `${platform.handleBase}${encodeURIComponent(handle)}`;
    if (url.length > maxUrlLength) {
      return { status: "error", error: "Use a link under 500 characters." } as const;
    }
    return { status: "ok", url } as const;
  }

  const normalized = profileUrl(platform, trimmed);
  if ("url" in normalized) return { status: "ok", url: normalized.url } as const;
  return { status: "error", error: normalized.error } as const;
}

export function acceptSocialLink(
  platformId: SocialPlatformId,
  raw: string,
): { url: string } | { error: string } {
  const result = readSignupLink(platformId, raw);
  if (result.status === "ok") return { url: result.url };
  if (result.status === "error") return { error: result.error };
  return { error: linkError(platformById(platformId)) };
}

// Links already saved from the profile editor. X and Website are kept,
// but they do not replace the required Instagram, TikTok, YouTube, or Facebook link.
export function collectCreatorLinks(links: { platform: string; url: string }[]) {
  const normalized: SignupSocialLink[] = [];
  let primaryCount = 0;

  for (const platform of socialPlatforms) {
    const match = links.find((link) => link.platform === platform.id && link.url.trim());
    if (!match) continue;
    const result = readSignupLink(platform.id, match.url);
    if (result.status === "error") return { error: result.error, links: [] as SignupSocialLink[] };
    if (result.status !== "ok") continue;
    normalized.push({ platform: platform.id, url: result.url });
    if (platform.group === "primary") primaryCount += 1;
  }

  if (primaryCount === 0) {
    return {
      error: normalized.length > 0 ? primarySocialMessage : atLeastOneSocialMessage,
      links: [] as SignupSocialLink[],
    };
  }
  return { error: "", links: normalized };
}

export function socialLinkSummary(platformId: SocialPlatformId, url: string) {
  const platform = platformById(platformId);
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
