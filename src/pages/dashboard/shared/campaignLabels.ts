import type { DashboardCampaignStatus } from "../../../components";
import type { County } from "../../../api/directory";
import type {
  Campaign,
  DeliverableRequirement,
  DeliverableType,
  OfferType,
} from "../../../api/campaigns";

const offerLabels: Record<OfferType, string> = {
  gifted: "Gifted",
  dining: "Dining",
  paid: "Paid",
};

const requirementLabels: Record<DeliverableType, [string, string]> = {
  post: ["Post", "Posts"],
  story: ["Story", "Stories"],
  reel: ["Reel", "Reels"],
};

function formatDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function dateLabel(campaign: Campaign) {
  const start = formatDate(campaign.starts_on);
  const end = formatDate(campaign.ends_on);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return "No dates listed";
}

export function countyLabel(ids: number[], counties: County[]) {
  if (ids.length === 0) return "No county listed";
  const names = ids.flatMap((id) => {
    const match = counties.find((county) => county.county_id === id);
    return match ? [`${match.name} County, NJ`] : [];
  });
  if (names.length === 0) return ids.map((id) => `County ${id}`).join(", ");
  return names.join(", ");
}

function requirementsLabel(requirements: DeliverableRequirement[] | undefined) {
  if (!requirements || requirements.length === 0) return "";
  const parts: string[] = [];
  for (const requirement of requirements) {
    const labels = requirementLabels[requirement.deliverable_type];
    if (!labels) continue;
    const quantity = requirement.quantity;
    parts.push(`${quantity} ${quantity === 1 ? labels[0] : labels[1]}`);
  }
  return parts.join(", ");
}

export function statusLabel(status: Campaign["status"]): DashboardCampaignStatus {
  if (status === "draft") return "Draft";
  if (status === "closed") return "Closed";
  return "Open";
}

export function campaignNote(campaign: Campaign) {
  const offer = campaign.offer_type ? offerLabels[campaign.offer_type] : "";
  const requirements = requirementsLabel(campaign.deliverable_requirements);
  return [offer, requirements].filter(Boolean).join(" · ");
}
