import { type ComponentProps } from "react";
import { Button as HeroButton, Chip, ToggleButton } from "@heroui/react";
import { Check } from "lucide-react";

// Simple wrappers around HeroUI. Tailwind handles layout; colors come from the shared CSS variables.
export type AppButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive";
export type AppButtonProps = Omit<
  ComponentProps<typeof HeroButton>,
  "variant"
> & {
  variant?: AppButtonVariant;
};

export function AppButton({
  variant = "primary",
  className = "",
  ...props
}: AppButtonProps) {
  return (
    <HeroButton
      {...props}
      variant={variant === "destructive" ? "danger" : variant}
      className={[
        variant === "primary" ? "bg-[var(--cg-primary)] text-white" : "",
        variant === "secondary" ? "border-[var(--cg-border)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

interface FilterChipProps {
  label: string;
  selected: boolean;
  onChange?: (selected: boolean) => void;
  disabled?: boolean;
}

export function FilterChip({
  label,
  selected,
  onChange,
  disabled = false,
}: FilterChipProps) {
  return (
    <ToggleButton
      variant="ghost"
      size="sm"
      isSelected={selected}
      onChange={onChange}
      isDisabled={disabled}
      className={
        selected
          ? "border-[var(--cg-primary)] text-[var(--cg-primary-dark)]"
          : ""
      }
    >
      {selected && <Check size={14} aria-hidden="true" />}
      {label}
    </ToggleButton>
  );
}

// Kept for upcoming campaign screens, not part of the current gallery.
const statusLabels = {
  draft: "Draft",
  awaitingCreator: "Awaiting Creator",
  accepted: "Accepted",
  paymentFunded: "Payment Funded",
  inProgress: "Content In Progress",
  submitted: "Content Submitted",
  changesRequested: "Changes Requested",
  approved: "Approved",
  completed: "Completed",
} as const;

export type CampaignStatusValue = keyof typeof statusLabels;

const statusColors: Record<
  CampaignStatusValue,
  "default" | "accent" | "success" | "warning"
> = {
  draft: "default",
  awaitingCreator: "accent",
  accepted: "success",
  paymentFunded: "success",
  inProgress: "accent",
  submitted: "accent",
  changesRequested: "warning",
  approved: "success",
  completed: "success",
};

export function CampaignStatus({ status }: { status: CampaignStatusValue }) {
  return (
    <Chip size="sm" variant="soft" color={statusColors[status]}>
      {statusLabels[status]}
    </Chip>
  );
}
