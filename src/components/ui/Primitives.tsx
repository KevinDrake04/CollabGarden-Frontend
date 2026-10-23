import { type ComponentProps, type HTMLInputTypeAttribute } from "react";
import {
  Avatar,
  Button as HeroButton,
  Chip,
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
  ToggleButton,
} from "@heroui/react";
import { Check, ChevronDown, Search } from "lucide-react";

// Simple wrappers around HeroUI. Tailwind handles layout; colors come from the shared CSS variables.
export interface FieldProps {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

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

const labelClass = "text-sm font-medium text-[var(--cg-text)]";
const helperClass = "text-xs text-[var(--cg-muted)]";
const errorClass = "text-xs text-[var(--cg-error)]";

export function AppInput({
  label,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  helper,
  error,
  disabled,
  required,
  className = "",
  type = "text",
}: FieldProps & { type?: HTMLInputTypeAttribute }) {
  return (
    <TextField
      name={name}
      type={type}
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      isRequired={required}
      className={`flex w-full flex-col gap-1.5 ${className}`}
    >
      <Label className={labelClass}>{label}</Label>
      <Input
        className="w-full"
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {helper && !error && (
        <Description className={helperClass}>{helper}</Description>
      )}
      {error && <FieldError className={errorClass}>{error}</FieldError>}
    </TextField>
  );
}

export function AppTextarea({
  label,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  helper,
  error,
  disabled,
  required,
  className = "",
  rows = 4,
}: FieldProps & { rows?: number }) {
  return (
    <TextField
      name={name}
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      isRequired={required}
      className={`flex w-full flex-col gap-1.5 ${className}`}
    >
      <Label className={labelClass}>{label}</Label>
      <TextArea
        rows={rows}
        className="w-full"
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {helper && !error && (
        <Description className={helperClass}>{helper}</Description>
      )}
      {error && <FieldError className={errorClass}>{error}</FieldError>}
    </TextField>
  );
}

export function AppSearch({
  label = "Search",
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Search creators…",
  helper,
  error,
  disabled,
  required,
  className = "",
}: FieldProps) {
  return (
    <TextField
      name={name}
      type="search"
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      isRequired={required}
      className={`flex w-full flex-col gap-1.5 ${className}`}
    >
      <Label className={labelClass}>{label}</Label>
      <InputGroup fullWidth>
        <InputGroup.Prefix>
          <Search size={18} aria-hidden="true" />
        </InputGroup.Prefix>
        <InputGroup.Input
          type="search"
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          onChange={(event) => onChange?.(event.target.value)}
        />
      </InputGroup>
      {helper && !error && (
        <Description className={helperClass}>{helper}</Description>
      )}
      {error && <FieldError className={errorClass}>{error}</FieldError>}
    </TextField>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export type AppSelectProps = FieldProps & {
  options: SelectOption[];
};

export function AppSelect({
  label,
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder = "Select an option",
  helper,
  error,
  disabled,
  required,
  className = "",
}: AppSelectProps) {
  return (
    <Select
      className={`flex w-full flex-col gap-1.5 ${className}`}
      placeholder={placeholder}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={(key) =>
        onChange?.(key === null || Array.isArray(key) ? "" : String(key))
      }
      isDisabled={disabled}
      isRequired={required}
      isInvalid={Boolean(error)}
    >
      <Label className={labelClass}>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator>
          <ChevronDown size={16} aria-hidden="true" />
        </Select.Indicator>
      </Select.Trigger>
      {helper && !error && (
        <Description className={helperClass}>{helper}</Description>
      )}
      {error && <FieldError className={errorClass}>{error}</FieldError>}
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator>
                <Check size={14} aria-hidden="true" />
              </ListBox.ItemIndicator>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
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

interface AppAvatarProps {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
}

export function AppAvatar({ name, imageUrl, size = "md" }: AppAvatarProps) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <Avatar size={size} variant="soft" color="accent">
      {imageUrl && <Avatar.Image src={imageUrl} alt={name} />}
      <Avatar.Fallback>{initials}</Avatar.Fallback>
    </Avatar>
  );
}
