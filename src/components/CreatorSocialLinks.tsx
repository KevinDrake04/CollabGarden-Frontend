import { useState } from "react";
import { Modal } from "@heroui/react";
import { Check, X } from "lucide-react";
import { AppButton } from "./ui/Buttons";
import { AppInput } from "./ui/Fields";

// Controlled profile links. Parents own the list so signup, Google onboarding,
// and profile editing can share this component without storing anything here.
export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitch"
  | "x"
  | "facebook";

export type CreatorSocialLink = {
  platform: SocialPlatform;
  url: string;
};

export type CreatorSocialLinksProps = {
  links: CreatorSocialLink[];
  onChange: (links: CreatorSocialLink[]) => void;
};

const platforms: {
  id: SocialPlatform;
  label: string;
  example: string;
  hosts: string[];
}[] = [
  {
    id: "instagram",
    label: "Instagram",
    example: "https://instagram.com/yourname",
    hosts: ["instagram.com"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    example: "https://www.tiktok.com/@yourname",
    hosts: ["tiktok.com", "vm.tiktok.com"],
  },
  {
    id: "youtube",
    label: "YouTube",
    example: "https://www.youtube.com/@yourname",
    hosts: ["youtube.com", "m.youtube.com", "youtu.be"],
  },
  {
    id: "twitch",
    label: "Twitch",
    example: "https://www.twitch.tv/yourname",
    hosts: ["twitch.tv"],
  },
  {
    id: "x",
    label: "X / Twitter",
    example: "https://x.com/yourname",
    hosts: ["x.com", "twitter.com", "mobile.twitter.com"],
  },
  {
    id: "facebook",
    label: "Facebook",
    example: "https://www.facebook.com/yourname",
    hosts: ["facebook.com", "m.facebook.com"],
  },
];

function platformById(id: SocialPlatform) {
  return platforms.find((item) => item.id === id) ?? platforms[0];
}

function siteHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function profileLinkError(platformId: SocialPlatform, value: string) {
  const platform = platformById(platformId);
  const trimmed = value.trim();
  if (!trimmed) return "Enter a profile link.";

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return `Enter a full link, such as ${platform.example}.`;
  }

  if (url.username || url.password) {
    return "Enter the public profile link, not login details.";
  }
  if (url.protocol !== "https:") {
    return "Profile links must start with https://.";
  }
  if (!platform.hosts.includes(siteHost(url))) {
    return `Enter a link from ${platform.label}, such as ${platform.example}.`;
  }
  if (url.pathname === "/" || url.pathname === "") {
    return `Include the profile name, such as ${platform.example}.`;
  }

  return "";
}

// One link per platform. A later save for the same platform replaces the old URL.
function replaceLink(
  links: CreatorSocialLink[],
  platform: SocialPlatform,
  url: string | null,
) {
  const saved = new Map<SocialPlatform, string>();
  for (const link of links) {
    saved.set(link.platform, link.url);
  }
  if (url) saved.set(platform, url);
  else saved.delete(platform);

  return platforms
    .filter((item) => saved.has(item.id))
    .map((item) => ({ platform: item.id, url: saved.get(item.id) ?? "" }));
}

export function CreatorSocialLinks({ links, onChange }: CreatorSocialLinksProps) {
  const [editing, setEditing] = useState<SocialPlatform>("instagram");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const activePlatform = platformById(editing);
  const savedUrl = links.find((link) => link.platform === editing)?.url;

  function openPlatform(platform: SocialPlatform) {
    setEditing(platform);
    setDraft(links.find((link) => link.platform === platform)?.url ?? "");
    setError("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError("");
  }

  function save() {
    const nextError = profileLinkError(editing, draft);
    if (nextError) {
      setError(nextError);
      return;
    }
    onChange(replaceLink(links, editing, draft.trim()));
    close();
  }

  function remove(platform: SocialPlatform) {
    onChange(replaceLink(links, platform, null));
    if (editing === platform) close();
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-sm font-medium text-[var(--cg-text)]">
          Social media profiles
        </h2>
        <p className="mt-1 text-xs">
          Optional. A saved link is not a login and does not verify the account.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Social media profiles">
        {platforms.map((platform) => {
          const added = links.some((link) => link.platform === platform.id);
          return (
            <button
              key={platform.id}
              type="button"
              aria-pressed={added}
              onClick={() => openPlatform(platform.id)}
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${
                added
                  ? "border-[var(--cg-primary)] bg-[var(--cg-background)]"
                  : "border-[var(--cg-border)] bg-white hover:bg-[var(--cg-background)]"
              }`}
            >
              <img
                src={`/icons/social/${platform.id}.svg`}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
              />
              <span className="min-w-0 text-sm font-medium text-[var(--cg-primary-dark)]">
                {platform.label}
              </span>
              {added && (
                <Check
                  size={16}
                  className="ml-auto shrink-0 text-[var(--cg-primary)]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {links.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {platforms.map((platform) => {
            const link = links.find((item) => item.platform === platform.id);
            if (!link) return null;
            return (
              <li
                key={platform.id}
                className="flex items-center gap-2 rounded-xl bg-[var(--cg-background)] px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--cg-primary-dark)]">
                    {platform.label} added
                  </span>
                  <span className="block truncate text-xs text-[var(--cg-muted)]">
                    {link.url.replace(/^https:\/\//, "")}
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer text-sm font-semibold text-[var(--cg-primary-dark)]"
                  onClick={() => remove(platform.id)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal>
        <Modal.Backdrop
          isOpen={open}
          onOpenChange={(isOpen) => {
            if (!isOpen) close();
          }}
        >
          <Modal.Container size="md" placement="center">
            <Modal.Dialog aria-label={`${activePlatform.label} profile link`}>
              <Modal.Header>
                <Modal.Heading className="text-lg font-bold text-[var(--cg-primary-dark)]">
                  {activePlatform.label}
                </Modal.Heading>
                <Modal.CloseTrigger>
                  <X size={18} aria-hidden="true" />
                </Modal.CloseTrigger>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-[var(--cg-muted)]">
                  Paste the public profile link. This does not log in or verify
                  that you own the account.
                </p>
                <div className="mt-4">
                  <AppInput
                    label="Profile link"
                    type="url"
                    value={draft}
                    onChange={(value) => {
                      setDraft(value);
                      setError("");
                    }}
                    placeholder={activePlatform.example}
                    error={error}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--cg-muted)]">
                  Example: {activePlatform.example}
                </p>
                {savedUrl && (
                  <button
                    type="button"
                    className="mt-3 cursor-pointer text-sm font-semibold text-[var(--cg-error)]"
                    onClick={() => remove(activePlatform.id)}
                  >
                    Remove link
                  </button>
                )}
              </Modal.Body>
              <Modal.Footer>
                <AppButton variant="secondary" onPress={close}>
                  Cancel
                </AppButton>
                <AppButton onPress={save}>Save</AppButton>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
