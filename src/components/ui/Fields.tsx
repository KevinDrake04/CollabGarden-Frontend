import { type HTMLInputTypeAttribute } from "react";
import {
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { ChevronDown, Search } from "lucide-react";

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
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
