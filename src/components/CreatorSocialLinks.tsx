import { type KeyboardEvent, useEffect, useState } from "react";
import { Modal } from "@heroui/react";
import { Globe, X } from "lucide-react";
import {
  acceptSocialLink,
  isSocialPlatform,
  socialLinkSummary,
  socialPlatforms,
  type SocialPlatformId,
} from "../utils/socialLinks";
import { AppButton } from "./ui/Buttons";
import { AppInput, AppSelect } from "./ui/Fields";

// Controlled profile links. Parents own the list so signup, Google onboarding,
// and profile editing can share this component without storing anything here.
export type SocialPlatform = SocialPlatformId;

export type CreatorSocialLink = {
  platform: SocialPlatform;
  url: string;
};

export type CreatorSocialLinksProps = {
  links: CreatorSocialLink[];
  onChange: (links: CreatorSocialLink[]) => void;
  disabled?: boolean;
  // Pass an empty string to hide the helper line.
  note?: string;
};

type SocialPlatformDefinition = (typeof socialPlatforms)[number];
type SocialDrafts = Record<SocialPlatformId, string>;

const primaryPlatforms = socialPlatforms.filter((platform) => platform.group === "primary");
const additionalPlatforms = socialPlatforms.filter((platform) => platform.group === "additional");
const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)]";

function savedUrl(links: readonly CreatorSocialLink[], platform: SocialPlatformId) {
  return links.find((link) => link.platform === platform && link.url.trim())?.url ?? "";
}

function emptyDrafts(): SocialDrafts {
  return {
    instagram: "",
    tiktok: "",
    youtube: "",
    facebook: "",
    x: "",
    website: "",
  };
}

function draftsFromLinks(links: readonly CreatorSocialLink[]): SocialDrafts {
  const drafts = emptyDrafts();
  for (const link of links) {
    if (link.url.trim()) drafts[link.platform] = link.url;
  }
  return drafts;
}

function choiceClass(added: boolean, disabled: boolean) {
  if (disabled) return "cursor-not-allowed border-[var(--cg-border)] bg-white";
  if (added) return "cursor-pointer border-[var(--cg-primary)] bg-[var(--cg-background)]";
  return "cursor-pointer border-[var(--cg-border)] bg-white hover:bg-[var(--cg-background)]";
}

function PlatformMark({
  platform,
  disabled,
}: {
  platform: SocialPlatformDefinition;
  disabled: boolean;
}) {
  if (!platform.icon) {
    return (
      <Globe
        size={20}
        className={`h-5 w-5 shrink-0 ${disabled ? "text-[var(--cg-muted)]" : "text-[var(--cg-primary)]"}`}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      src={platform.icon}
      alt=""
      width={20}
      height={20}
      className={`h-5 w-5 shrink-0 ${disabled ? "opacity-40" : ""}`}
    />
  );
}

function ProfileChoice({
  platform,
  url,
  disabled,
  onPress,
}: {
  platform: SocialPlatformDefinition;
  url: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const summary = url ? socialLinkSummary(platform.id, url) : "";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={Boolean(url)}
      title={url || undefined}
      onClick={onPress}
      className={`flex h-full min-h-12 w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${focusClass} ${choiceClass(Boolean(url), disabled)}`}
    >
      <PlatformMark platform={platform} disabled={disabled} />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-medium leading-5 ${
            disabled ? "text-[var(--cg-muted)]" : "text-[var(--cg-primary-dark)]"
          }`}
        >
          {platform.label}
        </span>
        {summary && (
          <span className="block truncate text-xs leading-4 font-normal text-[var(--cg-muted)]">
            {summary}
          </span>
        )}
      </span>
    </button>
  );
}

export function CreatorSocialLinks({
  links,
  onChange,
  disabled = false,
  note,
}: CreatorSocialLinksProps) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<SocialDrafts>(emptyDrafts);
  const [errors, setErrors] = useState<Partial<Record<SocialPlatformId, string>>>({});
  const [visibleIds, setVisibleIds] = useState<SocialPlatformId[]>([]);
  const [focusId, setFocusId] = useState<SocialPlatformId>("instagram");

  const savedExtras = additionalPlatforms.filter((platform) => savedUrl(links, platform.id));
  const visiblePlatforms = socialPlatforms.filter((platform) => visibleIds.includes(platform.id));
  const availablePlatforms = socialPlatforms.filter((platform) => !visibleIds.includes(platform.id));

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const node = document.getElementById(`social-field-${focusId}`);
      node?.scrollIntoView({ block: "start" });
      node?.querySelector("input")?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, focusId, visibleIds]);

  function openModal(platform: SocialPlatformId) {
    if (disabled) return;
    const saved = socialPlatforms
      .filter((item) => savedUrl(links, item.id))
      .map((item) => item.id);
    setDrafts(draftsFromLinks(links));
    setErrors({});
    setVisibleIds(saved.includes(platform) ? saved : [...saved, platform]);
    setFocusId(platform);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function updateDraft(platform: SocialPlatformId, value: string) {
    setDrafts((current) => ({ ...current, [platform]: value }));
    setErrors((current) => ({ ...current, [platform]: "" }));
  }

  function save() {
    if (disabled) return;
    const nextErrors: Partial<Record<SocialPlatformId, string>> = {};
    const nextLinks: CreatorSocialLink[] = [];

    for (const platform of socialPlatforms) {
      const raw = drafts[platform.id].trim();
      if (!visibleIds.includes(platform.id) || !raw) continue;
      const accepted = acceptSocialLink(platform.id, raw);
      if ("error" in accepted) nextErrors[platform.id] = accepted.error;
      else nextLinks.push({ platform: platform.id, url: accepted.url });
    }

    const firstError = socialPlatforms.find((platform) => nextErrors[platform.id]);
    if (firstError) {
      setErrors(nextErrors);
      setFocusId(firstError.id);
      return;
    }

    onChange(nextLinks);
    close();
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    save();
  }

  function removeField(platform: SocialPlatformId) {
    if (disabled) return;
    setVisibleIds((current) => current.filter((id) => id !== platform));
    setDrafts((current) => ({ ...current, [platform]: "" }));
    setErrors((current) => ({ ...current, [platform]: "" }));
  }

  function renderField(platform: SocialPlatformDefinition) {
    return (
      <div id={`social-field-${platform.id}`} key={platform.id} className="relative scroll-mt-2">
        <button
          type="button"
          className="absolute top-0 right-0 z-10 flex h-5 items-center cursor-pointer text-xs font-medium text-[var(--cg-error)] disabled:cursor-not-allowed"
          onClick={() => removeField(platform.id)}
          disabled={disabled}
        >
          Remove
        </button>
        <AppInput
          label={
            <span className="flex items-center gap-2 pr-16">
              <PlatformMark platform={platform} disabled={disabled} />
              <span className="min-w-0">{platform.inputLabel}</span>
            </span>
          }
          name={platform.id}
          value={drafts[platform.id]}
          onChange={(value) => updateDraft(platform.id, value)}
          placeholder={platform.placeholder}
          helper={`Example: ${platform.example}`}
          error={errors[platform.id] ?? ""}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-sm font-medium text-[var(--cg-text)]">
          Social media profiles
        </h2>
        {note !== "" && (
          <p className="mt-1 text-xs text-[var(--cg-muted)]">
            {note
              ?? (disabled
                ? "Social profiles are not available yet."
                : "Optional. A saved link is not a login and does not verify the account.")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Social media profiles"
          aria-describedby="social-primary-requirement"
          aria-disabled={disabled}
        >
          {primaryPlatforms.map((platform) => (
            <ProfileChoice
              key={platform.id}
              platform={platform}
              url={savedUrl(links, platform.id)}
              disabled={disabled}
              onPress={() => openModal(platform.id)}
            />
          ))}
        </div>
        <p id="social-primary-requirement" className="m-0 text-xs text-[var(--cg-muted)]">
          At least one of Instagram, TikTok, YouTube, or Facebook is required.
        </p>
      </div>

      {savedExtras.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Additional profiles">
          {savedExtras.map((platform) => (
            <li key={platform.id}>
              <ProfileChoice
                platform={platform}
                url={savedUrl(links, platform.id)}
                disabled={disabled}
                onPress={() => openModal(platform.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Modal>
        <Modal.Backdrop
          isOpen={open}
          onOpenChange={(isOpen) => {
            if (!isOpen) close();
          }}
        >
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog
              aria-label="Social media profiles"
              className="flex max-h-[min(34rem,calc(100dvh-2rem))] flex-col overflow-hidden"
            >
              <Modal.Header className="shrink-0">
                <Modal.Heading className="text-lg font-bold text-[var(--cg-primary-dark)]">
                  Social media profiles
                </Modal.Heading>
                <Modal.CloseTrigger>
                  <X size={18} aria-hidden="true" />
                </Modal.CloseTrigger>
              </Modal.Header>
              <Modal.Body className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="flex flex-col gap-4" onKeyDown={onEditorKeyDown}>
                  {visiblePlatforms.map(renderField)}
                  {availablePlatforms.length > 0 && (
                    <AppSelect
                      key={availablePlatforms.map((platform) => platform.id).join(",")}
                      label="Add another platform"
                      name="additionalProfile"
                      value=""
                      onChange={(value) => {
                        if (!isSocialPlatform(value) || visibleIds.includes(value)) return;
                        setVisibleIds((current) =>
                          current.includes(value) ? current : [...current, value],
                        );
                        setFocusId(value);
                      }}
                      options={availablePlatforms.map((platform) => ({
                        value: platform.id,
                        label: platform.label,
                      }))}
                      placeholder="Select a platform"
                      disabled={disabled}
                    />
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer className="shrink-0">
                <AppButton type="button" variant="secondary" onPress={close} isDisabled={disabled}>
                  Cancel
                </AppButton>
                <AppButton type="button" onPress={save} isDisabled={disabled}>
                  Save
                </AppButton>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
