import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Chip } from "@heroui/react";
import { Calendar, MapPin } from "lucide-react";
import { AppAvatar, AppButton, AppNotice, EmptyState, LoadingSkeleton } from "../../components";
import { getCounties, type County } from "../../api/directory";
import {
  getBusinesses,
  listOpenCampaigns,
  type BusinessSummary,
  type Campaign,
  type DeliverableRequirement,
  type DeliverableType,
  type OfferType,
} from "../../api/campaigns";

const offerLabels: Record<OfferType, string> = {
  gifted: "Gifted",
  dining: "Dining",
  paid: "Paid",
};

function formatDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateLabel(campaign: Campaign) {
  const start = formatDate(campaign.starts_on);
  const end = formatDate(campaign.ends_on);
  if (start && end) return `${start} - ${end}`;
  return start || end || "Dates not listed";
}

const requirementLabels: Record<DeliverableType, [string, string]> = {
  post: ["Post", "Posts"],
  story: ["Story", "Stories"],
  reel: ["Reel", "Reels"],
};

function requirementsLabel(requirements: DeliverableRequirement[] | undefined) {
  if (!requirements || requirements.length === 0) return "";
  const parts: string[] = [];
  for (const requirement of requirements) {
    const labels = requirementLabels[requirement.deliverable_type];
    const quantity = requirement.quantity;
    if (!labels || !Number.isInteger(quantity) || quantity < 1) continue;
    parts.push(`${quantity} ${quantity === 1 ? labels[0] : labels[1]}`);
  }
  return parts.join(" · ");
}

function countyLabel(ids: number[], counties: County[]) {
  const names = ids.flatMap((id) => {
    const match = counties.find((county) => county.county_id === id);
    return match ? [match.name] : [];
  });
  if (names.length === 0) return "New Jersey";
  if (names.length === 1) return `${names[0]} County, NJ`;
  return `${names.map((name) => `${name} County`).join(", ")}, NJ`;
}

function CampaignCard({
  campaign,
  business,
  counties,
}: {
  campaign: Campaign;
  business?: BusinessSummary;
  counties: County[];
}) {
  const businessName = business?.name || `Business ${campaign.business_id}`;
  const requirements = requirementsLabel(campaign.deliverable_requirements);

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--cg-border)] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <AppAvatar name={businessName} imageUrl={business?.logo_url ?? undefined} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="break-words text-lg font-semibold text-[var(--cg-text)]">{campaign.name}</h2>
            <div className="flex flex-wrap gap-2">
              {campaign.offer_type && (
                <Chip size="sm" variant="soft" color="accent">
                  {offerLabels[campaign.offer_type]}
                </Chip>
              )}
              <Chip size="sm" variant="soft">Open</Chip>
            </div>
          </div>
          <p className="mt-1 text-sm">{businessName}</p>
        </div>
      </div>

      {campaign.description && (
        <div className="whitespace-pre-wrap text-sm leading-6 text-[var(--cg-text)]">
          {campaign.description}
        </div>
      )}

      {requirements && <p className="text-sm">{requirements}</p>}

      <div className="mt-auto flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
        <span className="inline-flex min-w-0 items-start gap-1.5">
          <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
          <span className="break-words">{countyLabel(campaign.county_ids, counties)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={15} className="shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
          {dateLabel(campaign)}
        </span>
      </div>
    </article>
  );
}

export default function CampaignListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    Promise.all([
      listOpenCampaigns(controller.signal),
      getBusinesses(controller.signal),
      getCounties(controller.signal),
    ])
      .then(([campaignList, businessList, countyList]) => {
        setCampaigns(campaignList);
        setBusinesses(businessList);
        setCounties(countyList);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [retry]);

  const businessById = new Map(businesses.map((business) => [business.business_id, business]));
  const countLabel = campaigns.length === 1 ? "open campaign" : "open campaigns";

  return (
    <div className="-m-12 min-h-[calc(100dvh-4.5rem)] bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-my-8">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 px-4 py-10 text-[var(--cg-text)] md:px-8 md:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">Campaigns</h1>
            <p className="mt-3 text-base">
              Open collaboration offers from New Jersey businesses. Drafts are not shown.
            </p>
          </div>
          <Link
            to="/campaigns/new"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 py-2 text-sm font-semibold text-white no-underline sm:w-auto"
          >
            Post a campaign
          </Link>
        </div>

        {status === "loading" ? (
          <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading campaigns">
            <LoadingSkeleton />
            <LoadingSkeleton />
          </div>
        ) : status === "error" ? (
          <div role="alert" className="space-y-3">
            <AppNotice tone="error" message="Couldn't load campaigns. Please try again." />
            <AppButton variant="secondary" onPress={() => setRetry((value) => value + 1)}>
              Try again
            </AppButton>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            title="No open campaigns"
            description="Published campaigns will appear here. Drafts stay hidden."
            action={
              <Link
                to="/campaigns/new"
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 py-2 text-sm font-semibold text-white no-underline"
              >
                Post a campaign
              </Link>
            }
          />
        ) : (
          <>
            <p className="text-sm font-medium" aria-live="polite">
              {campaigns.length} {countLabel}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.campaign_id}
                  campaign={campaign}
                  business={businessById.get(campaign.business_id)}
                  counties={counties}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
