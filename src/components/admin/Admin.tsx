import { type ReactNode } from "react";
import { Card, Chip } from "@heroui/react";
import { ClipboardList } from "lucide-react";

// Presentational administrator pieces. Pages pass in real or sample data.
// DashboardStatCard is not on this branch, so counts use AdminStatCard.
const cardClass = "rounded-2xl border border-[var(--cg-border)] bg-white p-5 text-[var(--cg-text)]";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  suspended: "Suspended",
  waiting: "Waiting",
  invited: "Invited",
  active: "Active",
  rejected: "Rejected",
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

type BadgeColor = "default" | "accent" | "success" | "warning" | "danger";

const statusColors: Record<string, BadgeColor> = {
  pending: "warning",
  waiting: "warning",
  approved: "success",
  active: "success",
  open: "success",
  invited: "accent",
  draft: "default",
  suspended: "danger",
  rejected: "danger",
  closed: "default",
};

export function adminStatusLabel(status: string) {
  const key = status.trim().toLowerCase();
  return statusLabels[key] ?? (status.trim() || "Unknown");
}

export function AdminStatusBadge({ status }: { status: string }) {
  const key = status.trim().toLowerCase();

  return (
    <Chip size="sm" variant="soft" color={statusColors[key] ?? "default"} className="shrink-0">
      {adminStatusLabel(status)}
    </Chip>
  );
}

export function AdminStatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className={`${cardClass} flex flex-row items-center gap-3`}>
      {icon && (
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cg-background)] text-[var(--cg-primary)]">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-sm text-[var(--cg-muted)]">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        {detail && <div className="text-xs text-[var(--cg-muted)]">{detail}</div>}
      </div>
    </Card>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className={`${cardClass} flex flex-col items-center gap-3 py-8 text-center`}>
      <ClipboardList size={28} className="text-[var(--cg-primary)]" aria-hidden="true" />
      <strong>{title}</strong>
      <span className="max-w-md text-sm text-[var(--cg-muted)]">{description}</span>
    </Card>
  );
}

export function PendingAccountCard({
  name,
  detail,
  status,
  actions,
}: {
  name: string;
  detail: string;
  status: string;
  actions?: ReactNode;
}) {
  return (
    <Card className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-lg">{name}</strong>
          <div className="mt-1 text-sm text-[var(--cg-muted)]">{detail}</div>
        </div>
        <AdminStatusBadge status={status} />
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}

export function FoundingMemberCard({
  name,
  details,
  status,
  note,
  children,
  actions,
}: {
  name: string;
  details: string[];
  status: string;
  note?: string | null;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-lg">{name}</strong>
          <div className="mt-1 flex flex-col gap-1">
            {details.map((line, index) => (
              <span key={`${index}-${line}`} className="text-sm text-[var(--cg-muted)]">
                {line}
              </span>
            ))}
          </div>
        </div>
        <AdminStatusBadge status={status || "unknown"} />
      </div>
      {note && <div className="text-sm">Note: {note}</div>}
      {children}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}

export function AdminCampaignRow({
  name,
  detail,
  description,
  status,
  action,
}: {
  name: string;
  detail: string;
  description?: string | null;
  status: string;
  action?: ReactNode;
}) {
  return (
    <Card className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <strong className="text-lg">{name}</strong>
        <AdminStatusBadge status={status} />
      </div>
      <div className="text-sm text-[var(--cg-muted)]">{detail}</div>
      {description && <div className="text-sm">{description}</div>}
      {action}
    </Card>
  );
}
