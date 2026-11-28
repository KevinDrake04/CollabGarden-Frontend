import { type FormEvent, type ReactNode, useState } from "react";
import {
  AppInput,
  AppNotice,
  AppSelect,
  CreatorSocialLinks,
  LegalConsent,
  legalConsentRequiredMessage,
} from "../../components";
import type { County } from "../../api/directory";
import type { SignupRole } from "./RoleSelectModal";
import {
  requiredCreatorLinkError,
  type SignupSocialLink,
} from "../../utils/socialLinks";

export type ProfileDraft = {
  name: string;
  countyId: string;
  links: SignupSocialLink[];
  agreed: boolean;
};

export type CountyOptions = County[] | "loading" | "error";

export type CompletedProfile = {
  name: string;
  countyId: number | null;
  socialLinks: SignupSocialLink[];
};

type ProfileCompletionFormProps = {
  role: SignupRole;
  counties: CountyOptions;
  draft: ProfileDraft;
  onDraftChange: (draft: ProfileDraft) => void;
  submitting?: boolean;
  errorMessage?: string;
  onSubmit: (profile: CompletedProfile) => void;
  children?: ReactNode;
};

export function ProfileCompletionForm({
  role,
  counties,
  draft,
  onDraftChange,
  submitting = false,
  errorMessage = "",
  onSubmit,
  children,
}: ProfileCompletionFormProps) {
  const isBusiness = role === "business";
  const { name, countyId, links, agreed } = draft;
  const availableCounties = Array.isArray(counties) ? counties : [];
  const [nameError, setNameError] = useState("");
  const [socialError, setSocialError] = useState("");
  const [consentError, setConsentError] = useState("");

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const trimmedName = name.trim();
    const nextNameError = trimmedName
      ? ""
      : isBusiness
        ? "Enter your business name."
        : "Enter your display name.";
    const nextSocialError = isBusiness ? "" : requiredCreatorLinkError(links);
    const nextConsentError = agreed ? "" : legalConsentRequiredMessage;
    setNameError(nextNameError);
    setSocialError(nextSocialError);
    setConsentError(nextConsentError);
    if (nextNameError || nextSocialError || nextConsentError) return;

    const selectedCounty = availableCounties.find((county) => String(county.county_id) === countyId);
    onSubmit({
      name: trimmedName,
      countyId: selectedCounty?.county_id ?? null,
      socialLinks: isBusiness ? [] : links,
    });
  }

  return (
    <form noValidate onSubmit={finish} className="mt-6 flex flex-col gap-4">
      <AppInput
        label={isBusiness ? "Business Name" : "Display Name"}
        name={isBusiness ? "businessName" : "displayName"}
        placeholder={isBusiness ? "Garden Cafe" : "Alex Rivera"}
        value={name}
        onChange={(value) => {
          onDraftChange({ ...draft, name: value });
          setNameError("");
        }}
        error={nameError}
        disabled={submitting}
        required
      />
      <AppSelect
        label="County"
        name="county"
        value={countyId}
        onChange={(value) => onDraftChange({ ...draft, countyId: value })}
        options={availableCounties.map((county) => ({
          value: String(county.county_id),
          label: county.name,
        }))}
        placeholder="Select a county"
        disabled={submitting || typeof counties === "string"}
        helper={
          counties === "loading"
            ? "Loading counties..."
            : counties === "error"
              ? "Counties could not be loaded. You can continue without one."
              : "Optional."
        }
      />
      {!isBusiness && (
        <div>
          <CreatorSocialLinks
            links={links}
            onChange={(next) => {
              onDraftChange({ ...draft, links: next });
              setSocialError((current) => current ? requiredCreatorLinkError(next) : "");
            }}
            disabled={submitting}
          />
          {socialError && (
            <div role="alert" className="mt-2 text-xs text-[var(--cg-error)]">
              {socialError}
            </div>
          )}
        </div>
      )}
      <p className="m-0 text-sm text-[var(--cg-muted)]">
        Profiles need approval before they appear in the public directory.
      </p>
      <LegalConsent
        checked={agreed}
        disabled={submitting}
        error={consentError}
        onChange={(value) => {
          onDraftChange({ ...draft, agreed: value });
          if (value) setConsentError("");
        }}
      />
      {errorMessage && <AppNotice tone="error" message={errorMessage} />}
      {children}
    </form>
  );
}
