import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppButton, AppInput, AppTextarea } from "../../../components";
import { type County } from "../../../api/directory";
import {
  businessOfferLabel,
  businessOfferTypes,
  businessProfileLimits,
  type BusinessProfile,
  type BusinessProfileUpdate,
  type BusinessSave,
} from "../../../api/businessProfile";
import { sameSelection } from "../../../api/profileRequest";
import { isPublicHttpUrl } from "../../../utils/profileUrl";
import { emptyProfileImage, ProfileImageField } from "../shared/ProfileImageField";
import { AccountField } from "../shared/workspaceSession";
import { BusinessCountyField } from "./BusinessCountyField";

type FieldErrors = Partial<Record<"name" | "category" | "description" | "contactEmail" | "contactPhone" |
  "website" | "countyIds", string>>;

function draftFromProfile(profile: BusinessProfile) {
  return {
    name: profile.name,
    category: profile.category ?? "",
    description: profile.description ?? "",
    contactEmail: profile.contact_email ?? "",
    contactPhone: profile.contact_phone ?? "",
    website: profile.website ?? "",
    countyIds: profile.county_ids,
    offers: profile.offer_types,
  };
}

type Draft = ReturnType<typeof draftFromProfile>;

function prepareSave(draft: Draft, profile: BusinessProfile, counties: County[], hasUnsupportedOffers: boolean) {
  const errors: FieldErrors = {};
  const fields: BusinessProfileUpdate = {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    category: draft.category.trim() || null,
    contact_email: draft.contactEmail.trim() || null,
    contact_phone: draft.contactPhone.trim() || null,
    website: draft.website.trim() || null,
    offer_types: draft.offers,
    county_ids: draft.countyIds,
  };
  const changes: Partial<BusinessProfileUpdate> = Object.fromEntries(Object.entries(fields).filter(([key, value]) => {
    if (key === "county_ids") return !sameSelection(fields.county_ids, profile.county_ids);
    if (key === "offer_types") return !hasUnsupportedOffers && !sameSelection(fields.offer_types, profile.offer_types);
    return value !== profile[key as keyof BusinessProfileUpdate];
  }));

  if (changes.name !== undefined) {
    if (!fields.name) errors.name = "Enter a business name.";
    else if (fields.name.length > businessProfileLimits.name) errors.name = "Use 120 characters or fewer for the business name.";
  }
  if (changes.category && changes.category.length > businessProfileLimits.category) {
    errors.category = "Use 60 characters or fewer for the category.";
  }
  if (changes.description && changes.description.length > businessProfileLimits.description) {
    errors.description = "Use 2000 characters or fewer for the description.";
  }
  if (changes.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.contact_email)) {
    errors.contactEmail = "Enter a valid email address.";
  }
  if (changes.contact_phone && changes.contact_phone.length > businessProfileLimits.phone) {
    errors.contactPhone = "Use 30 characters or fewer for the contact phone.";
  }
  if (changes.website && (changes.website.length > businessProfileLimits.website || !isPublicHttpUrl(changes.website))) {
    errors.website = "Enter an HTTP or HTTPS URL of 500 characters or fewer.";
  }
  if (changes.county_ids?.some((id) => !profile.county_ids.includes(id) && !counties.some(({ county_id }) => county_id === id))) {
    errors.countyIds = "Choose counties from the list.";
  }

  return { changes, errors };
}

export function BusinessProfileForm({
  email,
  profile,
  counties,
  onCancel,
  onSave,
}: {
  email: string;
  profile: BusinessProfile;
  counties: County[];
  onCancel: () => void;
  onSave: (update: Partial<BusinessProfileUpdate>, logo: File | null) => Promise<BusinessSave | undefined>;
}) {
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [image, setImage] = useState(emptyProfileImage);
  const [alert, setAlert] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [check, setCheck] = useState<BusinessSave["check"]>();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const disabled = submitting || Boolean(check);
  const hasUnsupportedOffers = profile.offer_types.some((offer) => !businessOfferTypes.some((type) => offer === type));

  useEffect(() => {
    if (alert) alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [alert]);

  function patchDraft(patch: Partial<Draft>, errorKey?: keyof FieldErrors) {
    setDraft((current) => ({ ...current, ...patch }));
    if (errorKey) setErrors((current) => ({ ...current, [errorKey]: undefined }));
    setAlert("");
  }

  function toggleOffer(offer: string) {
    setDraft((current) => ({
      ...current,
      offers: current.offers.includes(offer)
        ? current.offers.filter((item) => item !== offer)
        : [...current.offers, offer],
    }));
    setAlert("");
  }

  async function finish(save: () => Promise<BusinessSave | undefined>, rechecking = false) {
    setSubmitting(true);
    setAlert("");
    try {
      const result = await save();
      if (!result) return;
      const { saved } = result;
      setDraft((current) => {
        const next = draftFromProfile(saved.profile);
        if (saved.detailsSaved) return next;
        const previous = draftFromProfile(profile);
        for (const key of ["name", "category", "description", "contactEmail", "contactPhone", "website"] as const) {
          if (current[key] !== previous[key]) next[key] = current[key];
        }
        if (!sameSelection(current.countyIds, previous.countyIds)) next.countyIds = current.countyIds;
        if (!sameSelection(current.offers, previous.offers)) next.offers = current.offers;
        return next;
      });
      if (saved.imageSaved) setImage(emptyProfileImage);
      setCheck(() => result.check);
      if (result.error) {
        setAlert(`${saved.detailsSaved ? "Profile details were saved. " : ""}${result.error.message}`);
      } else if (rechecking) {
        setAlert("Saved changes checked. Review any remaining edits.");
      }
    } catch {
      setAlert("Profile changes could not be saved. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || image.checking) return;
    const { changes, errors } = prepareSave(draft, profile, counties, hasUnsupportedOffers);
    setErrors(errors);
    if (image.error || Object.keys(errors).length) {
      setAlert(image.error || "Check the highlighted fields and try again.");
      return;
    }
    void finish(() => onSave(changes, image.file));
  }


  return (
    <form
      noValidate
      autoComplete="off"
      aria-label="Edit profile"
      className="mt-6 flex flex-col gap-4"
      onSubmit={onSubmit}
    >
      <h3 className="text-lg font-semibold text-[var(--cg-primary-dark)]">Edit profile</h3>
      <p className="text-sm text-[var(--cg-muted)]">
        Saving updates this business profile. It does not change approval status.
      </p>
      <dl>
        <AccountField label="Email">{email}</AccountField>
      </dl>
      <ProfileImageField
        label="Business logo"
        name={draft.name || profile.name}
        savedUrl={profile.logo_url}
        selection={image}
        disabled={disabled}
        onChange={(selection) => {
          setImage(selection);
          setAlert("");
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          label="Business name"
          name="businessName"
          value={draft.name}
          onChange={(name) => patchDraft({ name }, "name")}
          placeholder="Garden State Bakery"
          error={errors.name}
          disabled={disabled}
          required
        />
        <AppInput
          label="Category"
          name="category"
          value={draft.category}
          onChange={(category) => patchDraft({ category }, "category")}
          placeholder="Bakery, cafe, retail"
          error={errors.category}
          disabled={disabled}
        />
        <AppInput
          label="Contact email"
          name="contactEmail"
          type="email"
          value={draft.contactEmail}
          onChange={(contactEmail) => patchDraft({ contactEmail }, "contactEmail")}
          error={errors.contactEmail}
          disabled={disabled}
        />
        <AppInput
          label="Contact phone"
          name="contactPhone"
          type="tel"
          value={draft.contactPhone}
          onChange={(contactPhone) => patchDraft({ contactPhone }, "contactPhone")}
          error={errors.contactPhone}
          disabled={disabled}
        />
        <AppInput
          className="sm:col-span-2"
          label="Website"
          name="website"
          type="url"
          value={draft.website}
          onChange={(website) => patchDraft({ website }, "website")}
          error={errors.website}
          disabled={disabled}
        />
        <AppTextarea
          className="sm:col-span-2"
          label="Description"
          name="description"
          value={draft.description}
          onChange={(description) => patchDraft({ description }, "description")}
          placeholder="Tell creators what your business does."
          rows={4}
          error={errors.description}
          disabled={disabled}
        />
      </div>
      <BusinessCountyField
        counties={counties}
        selected={draft.countyIds}
        originalIds={profile.county_ids}
        error={errors.countyIds}
        disabled={disabled}
        onChange={(countyIds) => patchDraft({ countyIds }, "countyIds")}
      />
      <fieldset
        className="min-w-0 space-y-2"
        disabled={disabled || hasUnsupportedOffers}
      >
        <legend className="text-sm font-medium text-[var(--cg-text)]">Collaboration types</legend>
        <p className="text-sm">{hasUnsupportedOffers
          ? "Your stored collaboration types include an unsupported option. They will be kept."
          : "Gifted, dining, or paid. Choose any that apply."}</p>
        <div className="rounded-xl border border-[var(--cg-border)] bg-white p-2">
          {businessOfferTypes.map((offer) => {
            const checked = draft.offers.includes(offer);
            return (
              <label
                key={offer}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  checked
                    ? "bg-[var(--cg-background)] font-semibold text-[var(--cg-primary-dark)]"
                    : "text-[var(--cg-text)] hover:bg-[var(--cg-background)]"
                }`}
              >
                {businessOfferLabel(offer)}
                <input
                  type="checkbox"
                  name="offerTypes"
                  value={offer}
                  checked={checked}
                  onChange={() => toggleOffer(offer)}
                  className="size-4 accent-[var(--cg-primary)]"
                />
              </label>
            );
          })}
        </div>
      </fieldset>
      {alert && (
        <p ref={alertRef} role="alert" className="text-sm text-[var(--cg-error)]">{alert}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <AppButton type="submit" isDisabled={disabled || image.checking}>
          {submitting ? "Saving..." : "Save changes"}
        </AppButton>
        <AppButton type="button" variant="secondary" isDisabled={submitting} onPress={check ? () => void finish(check, true) : onCancel}>
          {check ? "Check saved changes" : "Cancel"}
        </AppButton>
      </div>
    </form>
  );
}
