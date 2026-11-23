import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AppAvatar } from "../../../components";
import { profileImageProblem } from "../../../api/creatorProfile";

export function ProfileImageField({
  name,
  savedUrl,
  file,
  error,
  disabled,
  onFile,
  onInvalid,
  onClear,
}: {
  name: string;
  savedUrl: string | null;
  file: File | null;
  error: string;
  disabled: boolean;
  onFile: (file: File) => void;
  onInvalid: (message: string) => void;
  onClear: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const request = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreviewUrl("");
    };
  }, [file]);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next || disabled) return;
    const ticket = request.current + 1;
    request.current = ticket;
    const problem = await profileImageProblem(next);
    if (ticket !== request.current) return;
    if (problem) {
      onInvalid(problem);
      return;
    }
    onFile(next);
  }

  function clear() {
    request.current += 1;
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Profile image preview"
          className="h-16 w-16 shrink-0 rounded-full object-cover"
        />
      ) : (
        <AppAvatar name={name || "Creator"} imageUrl={savedUrl ?? undefined} size="lg" />
      )}
      <div className="min-w-0 flex-1">
        <label htmlFor="creator-profile-image" className="text-sm font-medium text-[var(--cg-text)]">
          Profile image
        </label>
        <p id="creator-profile-image-help" className="mt-1 text-xs text-[var(--cg-muted)]">
          JPG, PNG, or WebP. Maximum 5 MB. A preview stays in this browser until the upload succeeds.
        </p>
        <input
          ref={inputRef}
          id="creator-profile-image"
          name="profileImage"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          aria-describedby={error ? "creator-profile-image-error" : "creator-profile-image-help"}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onChange={onPick}
          className="cg-focus mt-2 block w-full cursor-pointer text-sm text-[var(--cg-text)] file:mr-3 file:cursor-pointer file:rounded-xl file:border file:border-[var(--cg-border)] file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--cg-primary-dark)] disabled:cursor-not-allowed"
        />
        {file && (
          <p className="mt-1 truncate text-xs text-[var(--cg-muted)]">{file.name}</p>
        )}
        {file && (
          <button
            type="button"
            className="cg-focus mt-2 cursor-pointer rounded-lg text-sm font-semibold text-[var(--cg-error)] disabled:cursor-not-allowed disabled:text-[var(--cg-muted)]"
            onClick={clear}
            disabled={disabled}
          >
            Remove selected image
          </button>
        )}
        {error && (
          <p id="creator-profile-image-error" role="alert" className="mt-1 text-xs text-[var(--cg-error)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
