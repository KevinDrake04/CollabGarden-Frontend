import { Link } from "react-router";

// Controlled terms and privacy consent. Parents own the checked value so
// signup can keep it between steps, and a future Google onboarding screen
// can reuse this without the component storing or submitting anything.
//
// legalAgreementVersion matches the Terms of Use and Privacy Policy dated
// 2026-11-23. The development SignupRequest has no agreement field, so this
// version must not be sent until that contract exists.

export const legalAgreementVersion = "2026-11-23";

export const legalConsentRequiredMessage = "Please agree to continue";

const linkClass = "cg-focus font-semibold text-[var(--cg-primary-dark)] underline";

export type LegalConsentProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
  id?: string;
};

export function LegalConsent({
  checked,
  onChange,
  error = "",
  disabled = false,
  id = "legal-consent",
}: LegalConsentProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <input
          id={id}
          name="legalConsent"
          type="checkbox"
          checked={checked}
          disabled={disabled}
          required
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="cg-focus mt-0.5 size-4 shrink-0 accent-[var(--cg-primary)]"
        />
        <label htmlFor={id} className="text-sm text-[var(--cg-text)]">
          I agree to the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Terms of Use
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>{" "}
          and{" "}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Privacy Policy
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="m-0 text-xs text-[var(--cg-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
