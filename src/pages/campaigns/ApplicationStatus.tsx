import { Chip } from "@heroui/react";
import type { ApplicationStatus } from "../../api/campaigns";

const labels = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} satisfies Record<ApplicationStatus, string>;

export function ApplicationStatusChip({ status, showContext = false }: {
  status: ApplicationStatus;
  showContext?: boolean;
}) {
  return (
    <Chip size="sm" variant="soft" color={status === "accepted" ? "success" : status === "pending" ? "warning" : "default"}>
      {showContext ? `Application ${labels[status].toLowerCase()}` : labels[status]}
    </Chip>
  );
}
