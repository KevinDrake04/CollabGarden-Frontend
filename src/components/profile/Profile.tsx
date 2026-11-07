import { type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { AppAvatar, AppButton } from "../ui/Primitives";

export type ProfileActionItem = {
  label: string;
  disabled?: boolean;
  badge?: string;
  onPress?: () => void;
};

// Empty copy for a missing profile field.
export function ProfilePlaceholder({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm">{children}</p>;
}

// Profile image, or initials when the image is missing.
export function ProfilePhoto({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string;
}) {
  return (
    <div className="grid h-24 w-24 shrink-0 place-items-center" aria-hidden="true">
      <div className="scale-[2]">
        <AppAvatar name={name} imageUrl={imageUrl} size="lg" />
      </div>
    </div>
  );
}

export function ProfileHeader({
  eyebrow,
  name,
  imageUrl,
  summary,
  emptySummary,
  action,
  children,
}: {
  eyebrow: string;
  name: string;
  imageUrl?: string;
  summary?: string;
  emptySummary: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--cg-border)] bg-white p-5 shadow-sm md:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProfilePhoto name={name} imageUrl={imageUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-[0.16em] text-[var(--cg-primary)] uppercase">
            {eyebrow}
          </div>
          <h1 className="mt-1 font-bold tracking-tight break-words text-[var(--cg-primary-dark)]">
            {name}
          </h1>
          <p className="mt-2 mb-0 text-sm">{summary || emptySummary}</p>
          {children}
        </div>
        {action}
      </div>
    </section>
  );
}

export function ProfileActions({ actions }: { actions: ProfileActionItem[] }) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
      {actions.map((action, index) => (
        <AppButton
          key={`${action.label}-${index}`}
          variant="secondary"
          isDisabled={action.disabled}
          className="w-full sm:w-auto"
          style={action.disabled ? { opacity: 1 } : undefined}
          onPress={action.onPress}
        >
          {action.label}
          {action.badge ? (
            <span className="rounded-full bg-[var(--cg-background)] px-2 py-0.5 text-xs font-semibold text-[var(--cg-primary-dark)]">
              {action.badge}
            </span>
          ) : null}
        </AppButton>
      ))}
    </div>
  );
}

// Titled block of profile information, with optional empty copy.
export function ProfileDetails({
  title,
  text,
  emptyLabel,
  children,
}: {
  title: string;
  text?: string;
  emptyLabel?: string;
  children?: ReactNode;
}) {
  let body = children;
  if (text) {
    body = (
      <div className="text-base leading-relaxed break-words whitespace-pre-wrap text-[var(--cg-text)]">
        {text}
      </div>
    );
  } else if (!children && emptyLabel) {
    body = <ProfilePlaceholder>{emptyLabel}</ProfilePlaceholder>;
  }

  return (
    <section className="h-full rounded-2xl border border-[var(--cg-border)] bg-white p-5 shadow-sm md:p-6">
      <h2 className="m-0 text-lg font-semibold text-[var(--cg-primary-dark)]">{title}</h2>
      <div className="mt-3">{body}</div>
    </section>
  );
}

export function CountyList({
  names,
  missingLabel,
}: {
  names: string[];
  missingLabel: string;
}) {
  if (names.length === 0) return <ProfilePlaceholder>{missingLabel}</ProfilePlaceholder>;

  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {names.map((name) => (
        <li
          key={name}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cg-border)] bg-[var(--cg-background)] px-3 py-1 text-sm font-medium text-[var(--cg-primary-dark)]"
        >
          <MapPin size={14} className="shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
          {name} County, NJ
        </li>
      ))}
    </ul>
  );
}
