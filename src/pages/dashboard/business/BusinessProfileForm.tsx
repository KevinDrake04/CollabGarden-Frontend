import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppButton, AppInput, AppTextarea } from "../../../components";
import { type County } from "../../../api/directory";
import {
  businessOfferLabel,
  businessOfferTypes,
  businessProfileLimits,
  businessProfileSaveMessage,
  type BusinessProfile,
  type BusinessProfileUpdate,
} from "../../../api/businessProfile";
import { AccountField } from "../shared/workspaceSession";
import { BusinessCountyField } from "./BusinessCountyField";
import { BusinessLogoField } from "./BusinessLogoField";

type FieldErrors = {
  name?: string;
  category?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  countyIds?: string;
};

type Draft = {
  name: string;
  category: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  countyIds: number[];
  offers: string[];
};

const emptyErrors: FieldErrors = {};

function draftFromProfile(profile: BusinessProfile): Draft {
  return {
    name: profile.name,
    category: profile.category ?? "",
    description: profile.description ?? "",
    contactEmail: profile.contact_email ?? "",
    contactPhone: profile.contact_phone ?? "",
    website: profile.website ?? "",
    countyIds: [...profile.county_ids],
    offers: [...profile.offer_types],
  };
}

function countyAllowed(id: number, counties: County[], originalIds: number[]) {
  if (!Number.isInteger(id) || id < 1) return false;
  if (counties.some((county) => county.county_id === id)) return true;
  return originalIds.includes(id);
}

function validate(
  draft: Draft,
  counties: County[],
  originalIds: number[],
) {
  const errors: FieldErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Enter a business name.";
  else if (name.length > businessProfileLimits.name) {
    errors.name = "Use 120 characters or fewer for the business name.";
  }

  const category = draft.category.trim();
  if (category.length > businessProfileLimits.category) {
    errors.category = "Use 60 characters or fewer for the category.";
  }

  const description = draft.description.trim();
  if (description.length > businessProfileLimits.description) {
    errors.description = "Use 2000 characters or fewer for the description.";
  }

  const email = draft.contactEmail.trim();
  const website = draft.website.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.contactEmail = "Enter a valid email address.";
  if (draft.contactPhone.trim().length > businessProfileLimits.phone) {
    errors.contactPhone = "Use 30 characters or fewer for the contact phone.";
  }
  if (website && (!/^https?:\/\/\S+$/.test(website) || website.length > businessProfileLimits.website)) {
    errors.website = "Enter an HTTP or HTTPS URL of 500 characters or fewer.";
  }
  if (draft.countyIds.some((id) => !countyAllowed(id, counties, originalIds))) {
    errors.countyIds = "Choose counties from the list.";
  }

  return errors;
}

function toUpdate(draft: Draft): BusinessProfileUpdate {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    category: draft.category.trim() || null,
    contact_email: draft.contactEmail.trim() || null,
    contact_phone: draft.contactPhone.trim() || null,
    website: draft.website.trim() || null,
    offer_types: draft.offers,
    county_ids: draft.countyIds,
  };
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
  onSave: (update: BusinessProfileUpdate, logo: File | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const [errors, setErrors] = useState<FieldErrors>(emptyErrors);
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [alert, setAlert] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const originalCountyIds = profile.county_ids;

  useEffect(() => {
    if (!alert) return;
    alertRef.current?.scrollIntoView({ block: "nearest" });
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const errors = validate(draft, counties, originalCountyIds);
    setErrors(errors);
    if (imageError || Object.keys(errors).length) {
      setAlert(imageError || "Check the highlighted fields and try again.");
      return;
    }

    lock.current = true;
    setSubmitting(true);
    setAlert("");
    try {
      await onSave(toUpdate(draft), image);
    } catch (error) {
      setAlert(businessProfileSaveMessage(error));
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
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
      <BusinessLogoField
        name={draft.name || profile.name}
        savedUrl={profile.logo_url}
        file={image}
        error={imageError}
        disabled={submitting}
        onFile={(file) => {
          setImage(file);
          setImageError("");
          setAlert("");
        }}
        onInvalid={(message) => {
          setImage(null);
          setImageError(message);
          setAlert("");
        }}
        onClear={() => {
          setImage(null);
          setImageError("");
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
          disabled={submitting}
          required
        />
        <AppInput
          label="Category"
          name="category"
          value={draft.category}
          onChange={(category) => patchDraft({ category }, "category")}
          placeholder="Bakery, cafe, retail"
          error={errors.category}
          disabled={submitting}
        />
        <AppInput
          label="Contact email"
          name="contactEmail"
          type="email"
          value={draft.contactEmail}
          onChange={(contactEmail) => patchDraft({ contactEmail }, "contactEmail")}
          error={errors.contactEmail}
          disabled={submitting}
        />
        <AppInput
          label="Contact phone"
          name="contactPhone"
          type="tel"
          value={draft.contactPhone}
          onChange={(contactPhone) => patchDraft({ contactPhone }, "contactPhone")}
          error={errors.contactPhone}
          disabled={submitting}
        />
        <AppInput
          className="sm:col-span-2"
          label="Website"
          name="website"
          type="url"
          value={draft.website}
          onChange={(website) => patchDraft({ website }, "website")}
          error={errors.website}
          disabled={submitting}
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
          disabled={submitting}
        />
      </div>
      <BusinessCountyField
        counties={counties}
        selected={draft.countyIds}
        originalIds={originalCountyIds}
        error={errors.countyIds}
        disabled={submitting}
        onChange={(countyIds) => patchDraft({ countyIds }, "countyIds")}
      />
      <fieldset
        className="min-w-0 space-y-2"
        disabled={submitting}
      >
        <legend className="text-sm font-medium text-[var(--cg-text)]">Collaboration types</legend>
        <p className="text-sm">Gifted, dining, or paid. Choose any that apply.</p>
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
        <AppButton type="submit" isDisabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </AppButton>
        <AppButton type="button" variant="secondary" isDisabled={submitting} onPress={onCancel}>
          Cancel
        </AppButton>
      </div>
    </form>
  );
}
