import { type KeyboardEvent, useCallback, useId, useRef, useState } from "react";
import { Modal } from "@heroui/react";
import { Globe, X } from "lucide-react";
import {
  isSocialPlatform,
  readSignupLink,
  socialLinkSummary,
  socialPlatforms,
  type SignupSocialLink,
  type SocialPlatformId,
} from "../utils/socialLinks";
import { AppButton } from "./ui/Buttons";
import { AppInput, AppSelect } from "./ui/Fields";

type CreatorSocialLinksProps = {
  links: SignupSocialLink[];
  onChange: (links: SignupSocialLink[]) => void;
  disabled?: boolean;
};

type SocialPlatformDefinition = (typeof socialPlatforms)[number];
type SocialDrafts = Partial<Record<SocialPlatformId, { value: string; error?: string }>>;

const primaryPlatforms = socialPlatforms.filter((platform) => platform.group === "primary");
const additionalPlatforms = socialPlatforms.filter((platform) => platform.group === "additional");
const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)]";

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
}: CreatorSocialLinksProps) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<SocialDrafts>({});
  const [focusOnMount, setFocusOnMount] = useState<SocialPlatformId>();
  const inputs = useRef<Partial<Record<SocialPlatformId, HTMLInputElement | null>>>({});
  const focusAfterPicker = useRef<SocialPlatformId | undefined>(undefined);
  const requirementId = useId();

  const saved = new Map(links.map(({ platform, url }) => [platform, url]));
  const savedExtras = additionalPlatforms.filter((platform) => saved.has(platform.id));
  const availablePlatforms = socialPlatforms.filter((platform) => !drafts[platform.id]);

  const pickerPopoverRef = useCallback((popover: HTMLDivElement | null) => {
    if (popover || !focusAfterPicker.current) return;
    // The picker owns focus until its popover has unmounted.
    requestAnimationFrame(() => {
      const platform = focusAfterPicker.current;
      focusAfterPicker.current = undefined;
      if (platform) inputs.current[platform]?.focus();
    });
  }, []);

  function openModal(platform: SocialPlatformId) {
    const nextDrafts: SocialDrafts = {};
    for (const [id, value] of saved) nextDrafts[id] = { value };
    nextDrafts[platform] ??= { value: "" };
    setDrafts(nextDrafts);
    setFocusOnMount(platform);
    setOpen(true);
  }

  function close() {
    focusAfterPicker.current = undefined;
    setOpen(false);
  }

  function save() {
    if (disabled) return;
    const nextDrafts = { ...drafts };
    const nextLinks: SignupSocialLink[] = [];
    let firstInvalid: SocialPlatformId | undefined;

    for (const { id } of socialPlatforms) {
      const draft = drafts[id];
      if (!draft) continue;
      const result = readSignupLink(id, draft.value);
      if (result.status === "error") {
        nextDrafts[id] = { ...draft, error: result.error };
        firstInvalid ??= id;
      } else if (result.status === "ok") {
        nextLinks.push({ platform: id, url: result.url });
      }
    }

    if (firstInvalid) {
      setDrafts(nextDrafts);
      inputs.current[firstInvalid]?.focus();
      return;
    }

    onChange(nextLinks);
    close();
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    save();
  }

  function removeField(platform: SocialPlatformId) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[platform];
      return next;
    });
  }

  function renderField(platform: SocialPlatformDefinition) {
    const draft = drafts[platform.id];
    if (!draft) return null;

    return (
      <div key={platform.id} className="relative">
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
          value={draft.value}
          onChange={(value) => setDrafts((current) => ({ ...current, [platform.id]: { value } }))}
          placeholder={platform.placeholder}
          helper={`Example: ${platform.example}`}
          error={draft.error}
          disabled={disabled}
          autoFocus={focusOnMount === platform.id}
          ref={(input) => { inputs.current[platform.id] = input; }}
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
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Social media profiles"
          aria-describedby={requirementId}
          aria-disabled={disabled}
        >
          {primaryPlatforms.map((platform) => (
            <ProfileChoice
              key={platform.id}
              platform={platform}
              url={saved.get(platform.id) ?? ""}
              disabled={disabled}
              onPress={() => openModal(platform.id)}
            />
          ))}
        </div>
        <p id={requirementId} className="m-0 text-xs text-[var(--cg-muted)]">
          At least one of Instagram, TikTok, YouTube, or Facebook is required.
        </p>
      </div>

      {savedExtras.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Additional profiles">
          {savedExtras.map((platform) => (
            <li key={platform.id}>
              <ProfileChoice
                platform={platform}
                url={saved.get(platform.id) ?? ""}
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
                  {socialPlatforms.map(renderField)}
                  {availablePlatforms.length > 0 && (
                    <AppSelect
                      label="Add another platform"
                      name="additionalProfile"
                      value=""
                      onChange={(value) => {
                        if (!isSocialPlatform(value) || drafts[value]) return;
                        focusAfterPicker.current = value;
                        setDrafts((current) => ({ ...current, [value]: { value: "" } }));
                      }}
                      options={availablePlatforms.map((platform) => ({
                        value: platform.id,
                        label: platform.label,
                      }))}
                      placeholder="Select a platform"
                      disabled={disabled}
                      popoverRef={pickerPopoverRef}
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
