import type { County } from "../directory/api";
import type { BusinessName } from "./api";

export function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "No dates";
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  if (start) return `Starts ${formatDate(start)}`;
  return `Ends ${formatDate(end)}`;
}

export function dateParam(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export function countyName(id: number | null | undefined, counties: County[]) {
  if (id == null) return "No county";
  return counties.find((county) => county.county_id === id)?.name ?? `County ${id}`;
}

export function countyList(ids: number[] | undefined, counties: County[]) {
  if (!ids || ids.length === 0) return "No county limit";
  return ids.map((id) => countyName(id, counties)).join(", ");
}

const offerLabels: Record<string, string> = {
  gifted: "Gifted",
  dining: "Dining",
  paid: "Paid",
};

export function offerLabel(value: string | null) {
  if (!value) return "No offer type";
  return offerLabels[value] ?? value;
}

export function roleLabel(value: string | null | undefined) {
  if (!value) return "Unknown role";
  if (value === "business") return "Business";
  if (value === "creator") return "Creator";
  if (value === "admin") return "Administrator";
  return value;
}

export function accountTypeLabel(value: string) {
  if (value === "business") return "Business";
  if (value === "creator") return "Creator";
  return value;
}

export function businessName(id: number, businesses: BusinessName[]) {
  return businesses.find((business) => business.business_id === id)?.name ?? `Business ${id}`;
}

export function matchesQuery(query: string, values: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value?.toLowerCase().includes(needle));
}
