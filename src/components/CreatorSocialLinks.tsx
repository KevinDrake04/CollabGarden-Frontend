import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Modal } from "@heroui/react";
import { Globe, X } from "lucide-react";
import {
  acceptSocialLink,
  isSocialPlatform,
  socialLinkSummary,
  socialPlatform,
  socialPlatforms,
  type CreatorSocialLink,
  type SocialPlatformId,
} from "../utils/socialLinks";
import { AppButton } from "./ui/Buttons";
import { AppInput, AppSelect } from "./ui/Fields";
import "./CreatorSocialLinks.css";

export type { CreatorSocialLink } from "../utils/socialLinks";

type Platform = (typeof socialPlatforms)[number];
type Row = CreatorSocialLink & { error?: string };

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

export function CreatorSocialLinks({ links, onChange, disabled = false, note }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const fields = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<SocialPlatformId | null>(null);
  const saved = new Map(links.map(({ platform, url }) => [platform, url]));
  const extras = socialPlatforms.filter(({ group, id }) => group === "additional" && saved.has(id));
  const available = socialPlatforms.filter(({ id }) => !rows?.some((row) => row.platform === id));

  useEffect(() => {
    const id = focusTarget.current;
    if (!rows || !id) return;
    const frame = window.requestAnimationFrame(() => {
      const input = fields.current?.querySelector<HTMLInputElement>('input[name="' + id + '"]');
      if (input) {
        input.focus();
        focusTarget.current = null;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [rows]);

  function open(platform: SocialPlatformId) {
    focusTarget.current = platform;
    setRows(saved.has(platform) ? [...links] : [...links, { platform, url: "" }]);
  }

  function save() {
    if (!rows || disabled) return;
    const next = rows.map(({ platform, url }): Row => {
      const value = url.trim();
      // Leave saved API links intact when another platform is edited.
      if (!value || value === saved.get(platform)) return { platform, url: value };
      const result = acceptSocialLink(platform, value);
      return "error" in result ? { platform, url, error: result.error } : { platform, url: result.url };
    });
    const firstError = next.find(({ error }) => error);
    if (firstError) {
      focusTarget.current = firstError.platform;
      setRows(next);
      return;
    }
    onChange(next.filter(({ url }) => url).map(({ platform, url }) => ({ platform, url })));
    setRows(null);
  }

  function submitOnEnter(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
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
          <p className="mt-1 text-xs text-[var(--cg-muted)]">
            {note ?? (disabled ? "Social profiles are not available yet." : "Add links to your public profiles.")}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Social media profiles">
        {primary.map(choice)}
      </div>
      {extras.map(choice)}
      <Modal>
        <Modal.Backdrop isOpen={rows !== null} onOpenChange={(open) => { if (!open) setRows(null); }}>
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog aria-label="Social media profiles" className="creator-social-dialog">
              <Modal.Header className="shrink-0">
                <Modal.Heading className="text-lg font-bold text-[var(--cg-primary-dark)]">
                  Social media profiles
                </Modal.Heading>
                <Modal.CloseTrigger><X size={18} aria-hidden="true" /></Modal.CloseTrigger>
              </Modal.Header>
              <Modal.Body className="creator-social-body">
                <div ref={fields} className="flex flex-col gap-4" onKeyDown={submitOnEnter}>
                  {rows?.map((row) => {
                    const platform = socialPlatform(row.platform);
                    return (
                      <div key={row.platform} className="relative">
                        <AppInput label={platform.inputLabel} name={row.platform} value={row.url}
                          onChange={(url) => setRows((current) => current?.map((item) =>
                            item.platform === row.platform ? { platform: row.platform, url } : item) ?? null)}
                          placeholder={platform.placeholder} helper={"Example: " + platform.example}
                          error={row.error} disabled={disabled}
                        />
                        <button type="button" className="creator-social-remove" aria-label={"Remove " + platform.label}
                          disabled={disabled}
                          onClick={() => setRows((current) => current?.filter((item) => item.platform !== row.platform) ?? null)}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  {available.length > 0 && (
                    <AppSelect label="Add another platform" name="additionalProfile" value=""
                      onChange={(value) => {
                        if (!isSocialPlatform(value) || !available.some(({ id }) => id === value)) return;
                        focusTarget.current = value;
                        setRows((current) => current && [...current, { platform: value, url: "" }]);
                      }}
                      options={available.map(({ id, label }) => ({ value: id, label }))}
                      placeholder="Select a platform" disabled={disabled}
                    />
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer className="shrink-0">
                <AppButton type="button" variant="secondary" onPress={() => setRows(null)}>Cancel</AppButton>
                <AppButton type="button" onPress={save} isDisabled={disabled}>Save</AppButton>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
