import { Link } from "react-router";
import { Chip } from "@heroui/react";
import {
  AppButton,
  AppNotice,
  campaignStatusChip,
  DashboardEmptyState,
  DeliverableStatusBadge,
  LoadingSkeleton,
} from "../../../components";
import type { CampaignAccess } from "../../../api/collaborations";

export function DeliverableOverview({
  status,
  access,
  message = "",
  onRetry,
  emptyMessage,
  actionHref,
  actionLabel,
  limit,
}: {
  status: "loading" | "error" | "ready";
  access: CampaignAccess[];
  message?: string;
  onRetry: () => void;
  emptyMessage: string;
  actionHref: string;
  actionLabel: string;
  limit?: number;
}) {
  const readable = access.filter((entry) => !entry.error);
  const failed = access.filter((entry) => entry.error);
  const shown = limit == null ? readable : readable.slice(0, limit);

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={actionHref}
        className="inline-flex text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
      >
        {actionLabel}
      </Link>

      {status === "loading" && (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading deliverables">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3">
          <AppNotice tone="error" message={message || "Could not load deliverables."} />
          <AppButton variant="secondary" onPress={onRetry}>
            Try again
          </AppButton>
        </div>
      )}

      {status === "ready" &&
        failed.map((entry) => (
          <AppNotice
            key={entry.campaign.campaign_id}
            tone="error"
            message={`${entry.campaign.name}: ${entry.error}`}
          />
        ))}

      {status === "ready" && readable.length === 0 && failed.length === 0 && (
        <DashboardEmptyState message={emptyMessage} />
      )}

      {status === "ready" && shown.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {shown.map((entry) => {
            const campaignStatus = campaignStatusChip(entry.campaign.status);
            const rows = limit == null ? entry.deliverables : entry.deliverables.slice(0, 3);
            const hidden = entry.deliverables.length - rows.length;
            return (
            <article
              key={entry.campaign.campaign_id}
              className="rounded-2xl border border-[var(--cg-border)] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 break-words font-semibold text-[var(--cg-text)]">{entry.campaign.name}</h3>
                <Chip size="sm" variant="soft" color={campaignStatus.color}>
                  {campaignStatus.label}
                </Chip>
              </div>
              {entry.deliverables.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--cg-muted)]">No deliverables yet.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {rows.map((deliverable) => (
                    <li
                      key={deliverable.deliverable_id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="min-w-0 break-words text-sm text-[var(--cg-text)]">
                        {deliverable.title}
                      </span>
                      <DeliverableStatusBadge status={deliverable.status} />
                    </li>
                  ))}
                </ul>
              )}
              {hidden > 0 && (
                <p className="mt-2 text-sm text-[var(--cg-muted)]">
                  {hidden} more
                </p>
              )}
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
