import { type ReactNode } from "react";
import { Card, Chip } from "@heroui/react";
import { Sprout } from "lucide-react";
import { AppButton } from "../ui/Primitives";

// Presentational dashboard pieces. Pages pass in their own data.
const cardClass = "rounded-2xl border border-[var(--cg-border)] bg-white p-5";

export interface DashboardLayoutProps {
  title: string;
  description?: string;
  navigation?: ReactNode;
  children?: ReactNode;
}

export function DashboardLayout({
  title,
  description,
  navigation,
  children,
}: DashboardLayoutProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-background)]">
      <div className="flex flex-col md:flex-row">
        {navigation && (
          <div className="border-b border-[var(--cg-border)] bg-white p-4 md:w-56 md:shrink-0 md:border-r md:border-b-0">
            {navigation}
          </div>
        )}
        <div className="min-w-0 flex-1 p-4 md:p-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--cg-primary-dark)]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 max-w-2xl text-sm">{description}</p>
            )}
          </div>
          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export interface DashboardStatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export function DashboardStatCard({
  label,
  value,
  icon,
}: DashboardStatCardProps) {
  return (
    <Card className={`${cardClass} flex flex-row items-center gap-3`}>
      {icon && (
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cg-background)] text-[var(--cg-primary)]">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-sm text-[var(--cg-muted)]">{label}</div>
        <div className="text-2xl font-bold text-[var(--cg-text)]">{value}</div>
      </div>
    </Card>
  );
}

export type DashboardCampaignStatus =
  | "Draft"
  | "Active"
  | "Pending"
  | "Completed";

const statusColor: Record<
  DashboardCampaignStatus,
  "default" | "accent" | "success" | "warning"
> = {
  Draft: "default",
  Active: "accent",
  Pending: "warning",
  Completed: "success",
};

export interface CampaignCardProps {
  title: string;
  description: string;
  status: DashboardCampaignStatus;
  location?: string;
  budget?: string;
  date?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export function CampaignCard({
  title,
  description,
  status,
  location,
  budget,
  date,
  actionLabel,
  onAction,
  actionDisabled = false,
}: CampaignCardProps) {
  const details = [location, budget, date].filter(Boolean);
  const showAction = Boolean(actionLabel && (onAction || actionDisabled));

  return (
    <Card role="article" className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <strong className="text-lg text-[var(--cg-text)]">{title}</strong>
        <Chip size="sm" variant="soft" color={statusColor[status]}>
          {status}
        </Chip>
      </div>
      <p className="text-sm">{description}</p>
      {details.length > 0 && (
        <p className="text-sm">{details.join(" · ")}</p>
      )}
      {showAction && (
        <AppButton
          variant="secondary"
          className="self-start"
          isDisabled={actionDisabled}
          onPress={onAction}
        >
          {actionLabel}
        </AppButton>
      )}
    </Card>
  );
}

export interface OpportunityCardProps {
  businessName: string;
  title: string;
  description: string;
  location?: string;
  category?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export function OpportunityCard({
  businessName,
  title,
  description,
  location,
  category,
  actionLabel,
  onAction,
  actionDisabled = false,
}: OpportunityCardProps) {
  const details = [location, category].filter(Boolean);
  const showAction = Boolean(actionLabel && (onAction || actionDisabled));

  return (
    <Card role="article" className={`${cardClass} flex flex-col gap-3`}>
      <div className="text-sm font-medium text-[var(--cg-primary)]">
        {businessName}
      </div>
      <strong className="text-lg text-[var(--cg-text)]">{title}</strong>
      <p className="text-sm">{description}</p>
      {details.length > 0 && <p className="text-sm">{details.join(" · ")}</p>}
      {showAction && (
        <AppButton
          variant="secondary"
          className="self-start"
          isDisabled={actionDisabled}
          onPress={onAction}
        >
          {actionLabel}
        </AppButton>
      )}
    </Card>
  );
}

export interface DashboardEmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function DashboardEmptyState({
  message,
  actionLabel,
  onAction,
}: DashboardEmptyStateProps) {
  return (
    <Card
      className={`${cardClass} flex flex-col items-center gap-3 py-8 text-center`}
    >
      <Sprout
        size={28}
        className="text-[var(--cg-primary)]"
        aria-hidden="true"
      />
      <p className="max-w-md text-sm">{message}</p>
      {actionLabel && onAction && (
        <AppButton onPress={onAction}>{actionLabel}</AppButton>
      )}
    </Card>
  );
}
