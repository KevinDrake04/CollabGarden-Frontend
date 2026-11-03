import { type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AppButton, AppNotice, EmptyState, LoadingSkeleton } from "../../components";

export type ProfileLoadStatus = "loading" | "ready" | "error" | "missing";

export function parseProfileId(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function ProfilePage({ children }: { children: ReactNode }) {
  return (
    <div className="-m-12 min-h-[calc(100dvh-4.5rem)] bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-my-8">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 px-4 py-10 text-[var(--cg-text)] md:px-8 md:py-14">
        {children}
      </div>
    </div>
  );
}

export function BackToDiscover({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back to Discover
    </Link>
  );
}

export function ProfileStatus({
  status,
  loadingLabel,
  errorMessage,
  missingTitle,
  missingDescription,
  discoverTo,
  onRetry,
}: {
  status: Exclude<ProfileLoadStatus, "ready">;
  loadingLabel: string;
  errorMessage: string;
  missingTitle: string;
  missingDescription: string;
  discoverTo: string;
  onRetry: () => void;
}) {
  if (status === "loading") {
    return (
      <div className="space-y-4" aria-label={loadingLabel}>
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={3} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="space-y-3">
        <AppNotice tone="error" message={errorMessage} />
        <AppButton variant="secondary" onPress={onRetry}>
          Try again
        </AppButton>
      </div>
    );
  }

  return (
    <EmptyState
      title={missingTitle}
      description={missingDescription}
      action={<BackToDiscover to={discoverTo} />}
    />
  );
}
