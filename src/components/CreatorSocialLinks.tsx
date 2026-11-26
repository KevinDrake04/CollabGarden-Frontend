import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Modal } from "@heroui/react";
import { Globe, X } from "lucide-react";
import {
  isSocialPlatform,
  readSocialLink,
  socialLinkSummary,
  socialPlatforms,
  type CreatorSocialLink,
  type SocialPlatformId,
} from "../utils/socialLinks";
import { AppButton } from "./ui/Buttons";
import { AppInput, AppSelect } from "./ui/Fields";
import "./CreatorSocialLinks.css";

type Platform = (typeof socialPlatforms)[number];
type SocialDrafts = Partial<Record<SocialPlatformId, { value: string; error?: string }>>;

type Props = {
  links: CreatorSocialLink[];
  onChange: (links: CreatorSocialLink[]) => void;
  disabled?: boolean;
  note?: string;
};

function ProfileChoice({ platform, url, disabled, onPress }: {
  platform: Platform;
  url?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className="creator-social-choice"
      aria-pressed={Boolean(url)}
      title={url}
      disabled={disabled}
      onClick={onPress}
    >
      {platform.icon
        ? <img src={platform.icon} alt="" width={20} height={20} className="shrink-0" />
        : <Globe size={20} aria-hidden="true" className="shrink-0 text-[var(--cg-primary)]" />}
      <span className="min-w-0">
        <span className="block truncate">{platform.label}</span>
        {url && (
          <span className="block truncate text-xs font-normal text-[var(--cg-muted)]">
            {socialLinkSummary(platform.id, url)}
          </span>
        )}
      </span>
    </button>
  );
}

const primary = socialPlatforms.filter(({ group }) => group === "primary");
const additional = socialPlatforms.filter(({ group }) => group === "additional");

export function CreatorSocialLinks({
  links, onChange, disabled = false,
  note = "At least one of Instagram, TikTok, YouTube, or Facebook is required.",
}: Props) {
  const [drafts, setDrafts] = useState<SocialDrafts | null>(null);
  const inputs = useRef<Partial<Record<SocialPlatformId, HTMLInputElement | null>>>({});
  const focusOnOpen = useRef<SocialPlatformId | null>(null);
  const focusAfterPicker = useRef<SocialPlatformId | null>(null);
  const noteId = useId();
  const saved = new Map(links.map(({ platform, url }) => [platform, url]));
  const extras = additional.filter(({ id }) => saved.has(id));
  const available = socialPlatforms.filter(({ id }) => !drafts?.[id]);

  const pickerPopoverRef = useCallback((popover: HTMLDivElement | null) => {
    if (popover || !focusAfterPicker.current) return;
    // The picker returns focus to its trigger when its popover closes.
    requestAnimationFrame(() => {
      const platform = focusAfterPicker.current;
      focusAfterPicker.current = null;
      if (platform) inputs.current[platform]?.focus();
    });
  }, []);

  function open(platform: SocialPlatformId) {
    const next: SocialDrafts = {};
    for (const [id, value] of saved) next[id] = { value };
    next[platform] ??= { value: "" };
    focusOnOpen.current = platform;
    setDrafts(next);
  }

  function close() {
    focusAfterPicker.current = null;
    setDrafts(null);
  }

  function save() {
    if (!drafts || disabled) return;
    const nextDrafts = { ...drafts };
    const nextLinks: CreatorSocialLink[] = [];
    let firstInvalid: SocialPlatformId | undefined;

    for (const { id } of socialPlatforms) {
      const draft = drafts[id];
      if (!draft) continue;
      if (draft.value === saved.get(id)) {
        nextLinks.push({ platform: id, url: draft.value });
        continue;
      }
      const result = readSocialLink(id, draft.value);
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

  function submitOnEnter(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    save();
  }

  function choice(platform: Platform) {
    return (
      <ProfileChoice
        key={platform.id}
        platform={platform}
        url={saved.get(platform.id)}
        disabled={disabled}
        onPress={() => open(platform.id)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-sm font-medium text-[var(--cg-text)]">Social media profiles</h2>
        {note !== "" && (
          <p id={noteId} className="mt-1 text-xs text-[var(--cg-muted)]">{note}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Social media profiles"
        aria-describedby={note ? noteId : undefined} aria-disabled={disabled}>
        {primary.map(choice)}
      </div>
      {extras.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Additional profiles">
          {extras.map((platform) => <li key={platform.id}>{choice(platform)}</li>)}
        </ul>
      )}
      <Modal>
        <Modal.Backdrop isOpen={drafts !== null} onOpenChange={(open) => { if (!open) close(); }}>
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog aria-label="Social media profiles" className="creator-social-dialog">
              <Modal.Header className="shrink-0">
                <Modal.Heading className="text-lg font-bold text-[var(--cg-primary-dark)]">
                  Social media profiles
                </Modal.Heading>
                <Modal.CloseTrigger><X size={18} aria-hidden="true" /></Modal.CloseTrigger>
              </Modal.Header>
              <Modal.Body className="creator-social-body">
                <div className="flex flex-col gap-4" onKeyDown={submitOnEnter}>
                  {socialPlatforms.map((platform) => {
                    const draft = drafts?.[platform.id];
                    if (!draft) return null;
                    return (
                      <div key={platform.id} className="relative">
                        <AppInput
                          label={<span className="block pr-16">{platform.inputLabel}</span>}
                          name={platform.id}
                          value={draft.value}
                          onChange={(value) => setDrafts((current) => current && ({ ...current, [platform.id]: { value } }))}
                          placeholder={platform.placeholder}
                          helper={`Example: ${platform.example}`}
                          error={draft.error}
                          disabled={disabled}
                          autoFocus={focusOnOpen.current === platform.id}
                          ref={(input) => { inputs.current[platform.id] = input; }}
                        />
                        <button type="button" className="creator-social-remove" aria-label={"Remove " + platform.label}
                          disabled={disabled}
                          onClick={() => setDrafts((current) => {
                            if (!current) return current;
                            const next = { ...current };
                            delete next[platform.id];
                            return next;
                          })}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  {available.length > 0 && (
                    <AppSelect label="Add another platform" name="additionalProfile" value=""
                      onChange={(value) => {
                        if (!isSocialPlatform(value) || drafts?.[value]) return;
                        focusAfterPicker.current = value;
                        setDrafts((current) => current && ({ ...current, [value]: { value: "" } }));
                      }}
                      options={available.map(({ id, label }) => ({ value: id, label }))}
                      placeholder="Select a platform" disabled={disabled} popoverRef={pickerPopoverRef}
                    />
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer className="shrink-0">
                <AppButton type="button" variant="secondary" onPress={close}>Cancel</AppButton>
                <AppButton type="button" onPress={save} isDisabled={disabled}>Save</AppButton>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
