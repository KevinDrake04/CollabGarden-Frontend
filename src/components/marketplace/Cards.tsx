import { Card, Chip } from "@heroui/react";
import { ArrowUpRight, MapPin, Star, Users } from "lucide-react";
import { AppAvatar, AppButton } from "../ui/Primitives";

const cardClass = "rounded-2xl border border-[var(--cg-border)] bg-white p-5";
const mutedClass = "text-sm text-[var(--cg-muted)]";

export interface CreatorCardProps {
  name: string;
  county: string;
  category: string;
  platforms: string[];
  startingPrice?: string;
  rating?: number;
  imageUrl?: string;
  onView?: () => void;
}

export function CreatorCard({
  name,
  county,
  category,
  platforms,
  startingPrice,
  rating,
  imageUrl,
  onView,
}: CreatorCardProps) {
  return (
    <Card
      role="article"
      className={`${cardClass} flex flex-wrap items-start gap-4`}
    >
      <AppAvatar name={name} imageUrl={imageUrl} size="lg" />

      <div className="flex min-w-52 flex-1 flex-col gap-2">
        <strong className="text-lg text-[var(--cg-text)]">{name}</strong>
        <span className={mutedClass}>{category}</span>
        <span className={`inline-flex items-center gap-1.5 ${mutedClass}`}>
          <MapPin size={15} aria-hidden="true" />
          {county}, NJ
        </span>

        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <Chip key={platform} size="sm" variant="soft" color="accent">
              {platform}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cg-border)] pt-3">
          {rating !== undefined ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <Star size={15} fill="currentColor" aria-hidden="true" />
              {rating.toFixed(1)}
            </span>
          ) : (
            <span />
          )}
          {startingPrice && <strong>From {startingPrice}</strong>}
        </div>
      </div>

      {onView && (
        <AppButton
          variant="secondary"
          onPress={onView}
          aria-label={`View ${name}`}
        >
          <ArrowUpRight size={16} aria-hidden="true" />
          View
        </AppButton>
      )}
    </Card>
  );
}

interface CreatorPackageCardProps {
  title: string;
  description?: string;
  price: string;
  includes: string[];
  selected?: boolean;
  onSelect?: () => void;
}

export function CreatorPackageCard({
  title,
  description,
  price,
  includes,
  selected = false,
  onSelect,
}: CreatorPackageCardProps) {
  return (
    <Card
      role="article"
      className={`${cardClass} flex flex-col gap-3 ${selected ? "border-[var(--cg-primary)]" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-lg">{title}</strong>
        <strong className="text-xl text-[var(--cg-primary)]">{price}</strong>
      </div>

      {description && <p className={mutedClass}>{description}</p>}

      <ul className="list-disc space-y-1 pl-5 text-sm">
        {includes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {onSelect && (
        <AppButton
          variant={selected ? "secondary" : "primary"}
          onPress={onSelect}
        >
          {selected ? "Selected" : "Choose package"}
        </AppButton>
      )}
    </Card>
  );
}

// Available for a future dashboard, not displayed in the gallery yet.
interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <Card className={`${cardClass} flex flex-col gap-2`}>
      <span className={mutedClass}>{label}</span>
      <strong className="text-2xl">{value}</strong>
      {detail && (
        <span className={`inline-flex items-center gap-1 ${mutedClass}`}>
          <Users size={14} aria-hidden="true" />
          {detail}
        </span>
      )}
    </Card>
  );
}
