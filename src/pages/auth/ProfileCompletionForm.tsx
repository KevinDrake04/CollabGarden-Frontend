import { type FormEvent, type ReactNode, useState } from "react";
import {
  AppInput,
  AppNotice,
  AppSelect,
  CreatorSocialLinks,
  type CreatorSocialLink,
} from "../../components";
import type { County } from "../../api/directory";
import type { SignupRole } from "./RoleSelectModal";
import {
  collectCreatorLinks,
  type SignupSocialLink,
} from "./signupSocial";

export type ProfileCompletionInput = {
  name?: string;
  countyId?: number | null;
  socialLinks?: SignupSocialLink[];
};

export type CompletedProfile = {
  name: string;
  countyId: number | null;
  socialLinks: SignupSocialLink[];
};

type ProfileCompletionFormProps = {
  role: SignupRole;
  counties: County[];
  countyState: "loading" | "ready" | "error";
  name: string;
  countyId: string;
  links: CreatorSocialLink[];
  onNameChange: (name: string) => void;
  onCountyChange: (countyId: string) => void;
  onLinksChange: (links: CreatorSocialLink[]) => void;
  submitting?: boolean;
  errorMessage?: string;
  onSubmit: (profile: CompletedProfile) => void;
  children?: ReactNode;
};

export function ProfileCompletionForm({
  role,
  counties,
  countyState,
  name,
  countyId,
  links,
  onNameChange,
  onCountyChange,
  onLinksChange,
  submitting = false,
  errorMessage = "",
  onSubmit,
  children,
}: ProfileCompletionFormProps) {
  const isBusiness = role === "business";
  const [nameError, setNameError] = useState("");
  const [socialError, setSocialError] = useState("");

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const trimmedName = name.trim();
    const nextNameError = trimmedName
      ? ""
      : isBusiness
        ? "Enter your business name."
        : "Enter your display name.";
    const social = isBusiness
      ? { error: "", links: [] as SignupSocialLink[] }
      : collectCreatorLinks(links);
    setNameError(nextNameError);
    setSocialError(social.error);
    if (nextNameError || social.error) return;

    const selectedCounty = counties.find((county) => String(county.county_id) === countyId);
    onSubmit({
      name: trimmedName,
      countyId: selectedCounty?.county_id ?? null,
      socialLinks: social.links,
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
          onNameChange(value);
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
        onChange={onCountyChange}
        options={counties.map((county) => ({
          value: String(county.county_id),
          label: county.name,
        }))}
        placeholder="Select a county"
        disabled={submitting || countyState !== "ready"}
        helper={
          countyState === "loading"
            ? "Loading counties..."
            : countyState === "error"
              ? "Counties could not be loaded. You can continue without one."
              : "Optional."
        }
      />
      {!isBusiness && (
        <div>
          <CreatorSocialLinks
            links={links}
            onChange={(next) => {
              onLinksChange(next);
              setSocialError((current) => (current ? collectCreatorLinks(next).error : ""));
            }}
            note=""
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
      {errorMessage && <AppNotice tone="error" message={errorMessage} />}
      {children}
    </form>
  );
}
