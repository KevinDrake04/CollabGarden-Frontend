import { type ComponentProps } from "react";
import { Button as HeroButton, ToggleButton } from "@heroui/react";
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
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-solid! focus-visible:outline-[var(--cg-primary)]!",
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
