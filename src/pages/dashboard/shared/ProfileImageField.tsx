import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { AppAvatar } from "../../../components";
import { profileImageProblem } from "../../../utils/profileImage";

export type ProfileImageSelection = { file: File | null; error: string; checking?: boolean };
export const emptyProfileImage: ProfileImageSelection = { file: null, error: "" };

export function ProfileImageField({ label, name, savedUrl, selection, disabled, onChange }: {
  label: string;
  name: string;
  savedUrl: string | null;
  selection: ProfileImageSelection;
  disabled: boolean;
  onChange: (selection: ProfileImageSelection) => void;
}) {
  const { file, error, checking } = selection;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!file) {
      if (input.current) input.current.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next || disabled) return;
    const ticket = ++request.current;
    onChange({ file, error: "", checking: true });
    const problem = await profileImageProblem(next).catch(() => "The image could not be read. Choose it again.");
    if (ticket !== request.current) return;
    if (problem && input.current) input.current.value = "";
    onChange(problem ? { file, error: problem } : { file: next, error: "" });
  }

  function clear() {
    request.current += 1;
    if (input.current) input.current.value = "";
    onChange(emptyProfileImage);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {preview && preview.file === file ? (
        <img src={preview.url} alt={`${label} preview`} className="h-16 w-16 shrink-0 rounded-full object-cover" />
      ) : (
        <AppAvatar name={name} imageUrl={savedUrl ?? undefined} size="lg" />
      )}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-medium text-[var(--cg-text)]">{label}</label>
        <p id={`${id}-help`} className="mt-1 text-xs text-[var(--cg-muted)]">
          JPG, PNG, or WebP. Maximum 5 MB. A preview stays in this browser until the upload succeeds.
        </p>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          aria-describedby={error ? `${id}-error` : `${id}-help`}
          aria-invalid={error ? true : undefined}
          aria-busy={checking || undefined}
          disabled={disabled}
          onChange={pick}
          className="cg-focus mt-2 block w-full cursor-pointer text-sm text-[var(--cg-text)] file:mr-3 file:cursor-pointer file:rounded-xl file:border file:border-[var(--cg-border)] file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--cg-primary-dark)] disabled:cursor-not-allowed"
        />
        {file && <p className="mt-1 truncate text-xs text-[var(--cg-muted)]">{file.name}</p>}
        {(file || error || checking) && (
          <button
            type="button"
            className="cg-focus mt-2 cursor-pointer rounded-lg text-sm font-semibold text-[var(--cg-error)] disabled:cursor-not-allowed disabled:text-[var(--cg-muted)]"
            onClick={clear}
            disabled={disabled}
          >
            Remove selected image
          </button>
        )}
        {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-[var(--cg-error)]">{error}</p>}
      </div>
    </div>
  );
}
