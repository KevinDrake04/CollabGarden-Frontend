import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { FieldError, InputGroup, Label, TextField } from "@heroui/react";
import {
  AppButton,
  AppInput,
  AppNotice,
  AppSelect,
  CreatorSocialLinks,
} from "../../components";
import { AuthError, signup } from "../../api/auth";
import {
  parseSignupRole,
  RoleOptions,
  type SignupRole,
} from "./RoleSelectModal";

const countyOptions = [
  "Atlantic",
  "Bergen",
  "Burlington",
  "Camden",
  "Cape May",
  "Cumberland",
  "Essex",
  "Gloucester",
  "Hudson",
  "Hunterdon",
  "Mercer",
  "Middlesex",
  "Monmouth",
  "Morris",
  "Ocean",
  "Passaic",
  "Salem",
  "Somerset",
  "Sussex",
  "Union",
  "Warren",
].map((county) => ({ value: county, label: county }));

const cardClass =
  "rounded-2xl border border-[var(--cg-border)] bg-white p-6 shadow-sm md:p-8";

function AuthFrame({ children }: { children: ReactNode }) {
  // Cancel the default page padding so this screen can use the landing page background.
  return (
    <div className="-mx-12 -mt-12 flex-1 bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-mt-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12 md:px-8 md:py-14">
        <div className="hidden overflow-hidden rounded-2xl md:block">
          <img
            src="/images/cafe-collab.jpg"
            alt="People meeting over coffee and a laptop in a cafe"
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
        {children}
      </div>
    </div>
  );
}

function RolePrompt({
  onContinue,
}: {
  onContinue: (role: SignupRole) => void;
}) {
  const [role, setRole] = useState<SignupRole | null>(null);

  return (
    <div className={cardClass}>
      <h1 className="font-bold tracking-tight text-balance text-[var(--cg-primary-dark)]">
        How would you like to join CollabGarden?
      </h1>
      <div className="mt-6">
        <RoleOptions selected={role} onSelect={setRole} />
      </div>
      <AppButton
        className="mt-6 w-full"
        isDisabled={!role}
        onPress={() => {
          if (role) onContinue(role);
        }}
      >
        Continue
      </AppButton>
      <p className="mt-4 text-center text-sm">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function SignupForm({ role }: { role: SignupRole }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const lock = useRef(false);
  const isBusiness = role === "business";
  const locked = submitting || completed;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const nextEmailError = validEmail(trimmedEmail) ? "" : "Enter a valid email address.";
    const nextNameError = trimmedName
      ? ""
      : isBusiness
        ? "Enter your business name."
        : "Enter your display name.";
    const nextPasswordError = password.length >= 6
      ? ""
      : "Use at least 6 characters for your password.";

    setEmailError(nextEmailError);
    setNameError(nextNameError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextNameError || nextPasswordError) {
      setNotice(null);
      return;
    }

    lock.current = true;
    setSubmitting(true);
    setNotice(null);
    try {
      await signup({
        email: trimmedEmail,
        password,
        role,
        name: trimmedName,
      });
      setCompleted(true);
      setPassword("");
      setNotice({
        tone: "success",
        message: "Your account was created. Check your email if verification is required.",
      });
    } catch (error) {
      lock.current = false;
      const fallback = "Sign up failed. Please try again.";
      const message = error instanceof AuthError || error instanceof Error
        ? error.message || fallback
        : fallback;
      setNotice({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className={cardClass}>
      <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">
        {isBusiness ? "Join as a business" : "Join as a creator"}
      </h1>
      <p className="mt-2 text-sm">
        {isBusiness
          ? "Find and collaborate with local creators."
          : "Connect with businesses and discover opportunities."}{" "}
        <Link
          to="/signup"
          aria-disabled={submitting}
          tabIndex={submitting ? -1 : undefined}
          className={`font-semibold whitespace-nowrap no-underline ${
            submitting
              ? "pointer-events-none text-[var(--cg-muted)]"
              : "text-[var(--cg-primary-dark)]"
          }`}
          onClick={(event) => {
            if (submitting) event.preventDefault();
          }}
        >
          Change role
        </Link>
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <AppInput
          label="Email"
          name="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setEmailError("");
          }}
          error={emailError}
          disabled={locked}
          required
        />

        <TextField
          name="password"
          type={showPassword ? "text" : "password"}
          isRequired
          isDisabled={locked}
          isInvalid={Boolean(passwordError)}
          className="flex w-full flex-col gap-1.5"
        >
          <Label className="text-sm font-medium text-[var(--cg-text)]">
            Password
          </Label>
          <InputGroup fullWidth>
            <InputGroup.Input
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError("");
              }}
            />
            <InputGroup.Suffix>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center text-[var(--cg-muted)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </InputGroup.Suffix>
          </InputGroup>
          {passwordError && (
            <FieldError className="text-xs text-[var(--cg-error)]">{passwordError}</FieldError>
          )}
        </TextField>

        <AppSelect
          label="County"
          name="county"
          options={countyOptions}
          placeholder="Select a county"
          disabled
          helper="County selection is not available yet."
        />

        <AppInput
          label={isBusiness ? "Business Name" : "Display Name"}
          name={isBusiness ? "businessName" : "displayName"}
          placeholder={isBusiness ? "Garden Cafe" : "Alex Rivera"}
          value={name}
          onChange={(value) => {
            setName(value);
            setNameError("");
          }}
          error={nameError}
          disabled={locked}
          required
        />

        {!isBusiness && (
          <CreatorSocialLinks links={[]} onChange={() => {}} disabled />
        )}
      </div>

      <p className="mt-4 text-sm text-[var(--cg-muted)]">
        Profiles need approval before they appear in the public directory.
      </p>

      {notice && (
        <div className="mt-4">
          <AppNotice
            tone={notice.tone}
            message={notice.message}
            onClose={notice.tone === "success" ? undefined : () => setNotice(null)}
          />
        </div>
      )}

      <AppButton type="submit" className="mt-6 w-full" isDisabled={locked}>
        {submitting ? "Signing up..." : "Sign up"}
      </AppButton>

      <div className="mt-4 flex items-center gap-3 text-xs text-[var(--cg-muted)]">
        <span className="h-px flex-1 bg-[var(--cg-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--cg-border)]" />
      </div>

      <AppButton
        type="button"
        variant="secondary"
        className="mt-4 w-full gap-2 border border-[var(--cg-border)] bg-white text-[var(--cg-primary-dark)]"
        isDisabled={locked}
        onPress={() => {
          if (locked) return;
          setNotice({ tone: "info", message: "Continue with Google is coming soon." });
        }}
      >
        <img
          src="/icons/social/google.svg"
          alt=""
          width={18}
          height={18}
          className="h-4 w-4 shrink-0"
        />
        Continue with Google
        <span className="rounded-full bg-[var(--cg-background)] px-2 py-0.5 text-xs font-semibold text-[var(--cg-primary-dark)]">
          Coming soon
        </span>
      </AppButton>

      <p className="mt-4 text-center text-sm">
        {completed ? (
          <Link
            to="/login"
            className="font-semibold text-[var(--cg-primary-dark)] no-underline"
          >
            Log in to your account
          </Link>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-[var(--cg-primary-dark)] no-underline"
            >
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

export default function SignupPage() {
  const [params, setParams] = useSearchParams();
  const role = parseSignupRole(params.get("role"));

  return (
    <AuthFrame>
      {role ? (
        <SignupForm key={role} role={role} />
      ) : (
        <RolePrompt
          onContinue={(next) => {
            setParams({ role: next });
          }}
        />
      )}
    </AuthFrame>
  );
}
