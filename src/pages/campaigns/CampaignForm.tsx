import { type ReactNode, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AppButton, AppInput, AppSelect, AppTextarea } from "../../components";

export type CampaignFormValues = {
  name: string;
  description: string;
  deliverables: string;
  startsOn: string;
  endsOn: string;
  countyIds: number[];
  offerType: string;
};

export type CampaignFormErrors = Partial<Record<keyof CampaignFormValues, string>>;

export type CampaignCounty = {
  county_id: number;
  name: string;
};

const offerOptions = [
  { value: "gifted", label: "Gifted" },
  { value: "dining", label: "Dining" },
  { value: "paid", label: "Paid" },
];

const offerValues = new Set(offerOptions.map((option) => option.value));

export function emptyCampaignForm(): CampaignFormValues {
  return {
    name: "",
    description: "",
    deliverables: "",
    startsOn: "",
    endsOn: "",
    countyIds: [],
    offerType: "",
  };
}

export function validateCampaignForm(values: CampaignFormValues): CampaignFormErrors {
  const errors: CampaignFormErrors = {};

  if (!values.name.trim()) errors.name = "Enter a campaign title.";
  if (!values.description.trim()) errors.description = "Enter a description.";
  if (!values.deliverables.trim()) errors.deliverables = "Enter the deliverables.";
  if (!values.offerType) errors.offerType = "Select an offer type.";
  else if (!offerValues.has(values.offerType)) errors.offerType = "Select gifted, dining, or paid.";
  if (!values.startsOn) errors.startsOn = "Enter a start date.";
  if (!values.endsOn) errors.endsOn = "Enter an end date.";
  else if (values.startsOn && values.endsOn < values.startsOn) {
    errors.endsOn = "End date must be on or after the start date.";
  }
  if (values.countyIds.length === 0) errors.countyIds = "Select at least one county.";

  return errors;
}

type CampaignFormProps = {
  values: CampaignFormValues;
  errors: CampaignFormErrors;
  counties: CampaignCounty[];
  submitting: "draft" | "open" | null;
  onChange: (values: CampaignFormValues) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  actionsDisabled?: boolean;
  variant?: "plain" | "page";
  banner?: ReactNode;
};

const cardClass = "rounded-2xl border border-[var(--cg-border)] bg-white p-5 shadow-sm md:p-6";
const headingClass = "text-lg font-semibold text-[var(--cg-primary-dark)]";
const errorClass = "text-xs text-[var(--cg-error)]";

function CountyField({
  counties,
  selected,
  error,
  showLegend,
  labelId,
  onChange,
}: {
  counties: CampaignCounty[];
  selected: number[];
  error?: string;
  showLegend: boolean;
  labelId?: string;
  onChange: (countyIds: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = counties.filter((county) => county.name.toLowerCase().includes(query));
  const selectedNames = counties
    .filter((county) => selected.includes(county.county_id))
    .map((county) => county.name);

  function toggle(countyId: number) {
    onChange(
      selected.includes(countyId)
        ? selected.filter((id) => id !== countyId)
        : [...selected, countyId],
    );
  }

  return (
    <fieldset
      className="min-w-0 space-y-2"
      aria-invalid={Boolean(error) || undefined}
      aria-labelledby={labelId}
    >
      {showLegend && (
        <legend className="text-sm font-medium text-[var(--cg-text)]">Counties</legend>
      )}
      <p className="text-sm">
        {selectedNames.length === 0 ? "None selected." : selectedNames.join(", ")}
      </p>

      <div className="rounded-xl border border-[var(--cg-border)] bg-white">
        <div className="flex items-center gap-2 border-b border-[var(--cg-border)] px-3">
          <Search size={16} className="shrink-0 text-[var(--cg-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search counties"
            aria-label="Search counties"
            className="min-h-10 w-full min-w-0 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-2" aria-label="Select counties">
          {visible.map((county) => {
            const checked = selected.includes(county.county_id);
            return (
              <label
                key={county.county_id}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  checked
                    ? "bg-[var(--cg-background)] font-semibold text-[var(--cg-primary-dark)]"
                    : "text-[var(--cg-text)] hover:bg-[var(--cg-background)]"
                }`}
              >
                {county.name}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(county.county_id)}
                  className="size-4 accent-[var(--cg-primary)]"
                />
              </label>
            );
          })}
          {visible.length === 0 && (
            <p className="px-3 py-4 text-center text-sm">No counties found.</p>
          )}
        </div>
      </div>

      {error && <div className={errorClass}>{error}</div>}
    </fieldset>
  );
}

function DetailFields({
  values,
  errors,
  onChange,
}: {
  values: CampaignFormValues;
  errors: CampaignFormErrors;
  onChange: (patch: Partial<CampaignFormValues>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AppInput
          label="Campaign title"
          name="campaign-title"
          value={values.name}
          onChange={(name) => onChange({ name })}
          placeholder="Spring tasting menu"
          error={errors.name}
          required
        />
        <AppSelect
          label="Offer type"
          name="offer-type"
          value={values.offerType}
          onChange={(offerType) => onChange({ offerType })}
          options={offerOptions}
          placeholder="Select an offer type"
          helper="Gifted, dining, or paid."
          error={errors.offerType}
          required
        />
      </div>

      <AppTextarea
        label="Description"
        name="description"
        value={values.description}
        onChange={(description) => onChange({ description })}
        placeholder="What creators should know about this collaboration."
        error={errors.description}
        required
        rows={4}
      />

      <AppTextarea
        label="Deliverables"
        name="deliverables"
        value={values.deliverables}
        onChange={(deliverables) => onChange({ deliverables })}
        placeholder="One Instagram post and two stories."
        helper="Required on this form. The campaign API cannot store deliverables separately, so this text is not saved."
        error={errors.deliverables}
        required
        rows={3}
      />
    </div>
  );
}

function ScheduleFields({
  values,
  errors,
  onChange,
}: {
  values: CampaignFormValues;
  errors: CampaignFormErrors;
  onChange: (patch: Partial<CampaignFormValues>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <AppInput
        label="Start date"
        name="starts-on"
        type="date"
        value={values.startsOn}
        onChange={(startsOn) => onChange({ startsOn })}
        error={errors.startsOn}
        required
      />
      <AppInput
        label="End date"
        name="ends-on"
        type="date"
        value={values.endsOn}
        onChange={(endsOn) => onChange({ endsOn })}
        error={errors.endsOn}
        required
      />
    </div>
  );
}

function Actions({
  submitting,
  onSaveDraft,
  onPublish,
  showHint,
  actionsDisabled,
}: {
  submitting: "draft" | "open" | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  showHint: boolean;
  actionsDisabled: boolean;
}) {
  const busy = submitting !== null;

  return (
    <div className="space-y-3" aria-busy={busy}>
      {showHint && (
        <p className="text-sm">
          Save Draft keeps the offer unpublished. Publish sets the campaign status to open.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <AppButton
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          isDisabled={busy || actionsDisabled}
          onPress={onSaveDraft}
        >
          {submitting === "draft" ? "Saving draft..." : "Save Draft"}
        </AppButton>
        <AppButton
          type="button"
          className="w-full sm:w-auto"
          isDisabled={busy || actionsDisabled}
          onPress={onPublish}
        >
          {submitting === "open" ? "Publishing..." : "Publish"}
        </AppButton>
      </div>
    </div>
  );
}

export default function CampaignForm({
  values,
  errors,
  counties,
  submitting,
  onChange,
  onSaveDraft,
  onPublish,
  actionsDisabled = false,
  variant = "plain",
  banner,
}: CampaignFormProps) {
  const latest = useRef(values);
  latest.current = values;

  function update(patch: Partial<CampaignFormValues>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    onChange(next);
  }

  const details = <DetailFields values={values} errors={errors} onChange={update} />;
  const schedule = <ScheduleFields values={values} errors={errors} onChange={update} />;
  const countiesField = (
    <CountyField
      counties={counties}
      selected={values.countyIds}
      error={errors.countyIds}
      showLegend={variant !== "page"}
      labelId={variant === "page" ? "campaign-counties" : undefined}
      onChange={(countyIds) => update({ countyIds })}
    />
  );
  const actions = (
    <Actions
      submitting={submitting}
      onSaveDraft={onSaveDraft}
      onPublish={onPublish}
      showHint={variant === "page"}
      actionsDisabled={actionsDisabled}
    />
  );

  if (variant === "page") {
    return (
      <div className="space-y-5">
        <section className={`${cardClass} space-y-4`}>
          <h2 className={headingClass}>Campaign details</h2>
          {details}
        </section>
        <section className={`${cardClass} space-y-4`}>
          <h2 className={headingClass}>Schedule</h2>
          {schedule}
        </section>
        <section className={`${cardClass} space-y-4`}>
          <h2 id="campaign-counties" className={headingClass}>Counties</h2>
          {countiesField}
        </section>
        <section className={cardClass}>
          {banner && <div className="mb-4">{banner}</div>}
          {actions}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {details}
      {schedule}
      {countiesField}
      {banner}
      {actions}
    </div>
  );
}
