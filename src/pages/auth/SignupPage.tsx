import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { FieldError, InputGroup, Label, TextField } from "@heroui/react";
import {
  AppButton,
  AppInput,
  AppNotice,
} from "../../components";
import { AuthError, signup } from "../../api/auth";
import { getCounties, type County } from "../../api/directory";
import {
  parseSignupRole,
  RoleOptions,
  type SignupRole,
} from "./RoleSelectModal";
import {
  ProfileCompletionForm,
  type CompletedProfile,
} from "./ProfileCompletionForm";
import type { CreatorSocialLink } from "../../components";
import { dashboardPath, writeSession } from "./session";

const manualLoginMessage =
  "Your account was created, but we couldn't sign you in automatically. Log in to continue.";

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

function StepMarks({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-4 flex items-center gap-2" aria-label={`Step ${step} of 2`}>
      {[1, 2].map((item) => (
        <span
          key={item}
          aria-hidden="true"
          className={`h-1 w-8 rounded-full ${
            item <= step ? "bg-[var(--cg-primary)]" : "bg-[var(--cg-border)]"
          }`}
        />
      ))}
    </div>
  );
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function SignupForm({ role }: { role: SignupRole }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [counties, setCounties] = useState<County[]>([]);
  const [countyState, setCountyState] = useState<"loading" | "ready" | "error">("loading");
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [countyId, setCountyId] = useState("");
  const [links, setLinks] = useState<CreatorSocialLink[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const lock = useRef(false);
  const isBusiness = role === "business";
  const locked = submitting || completed;

  useEffect(() => {
    const controller = new AbortController();
    getCounties(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setCounties(list);
        setCountyState("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCountyState("error");
      });
    return () => controller.abort();
  }, []);

  function onContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || locked) return;

    const nextEmailError = validEmail(email.trim()) ? "" : "Enter a valid email address.";
    const nextPasswordError = password.length >= 6
      ? ""
      : "Use at least 6 characters for your password.";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      setNotice(null);
      return;
    }
    setSubmitError("");
    setNotice(null);
    setStep(2);
  }

  async function onProfileComplete(profile: CompletedProfile) {
    if (lock.current) return;
    lock.current = true;
    setSubmitting(true);
    setSubmitError("");
    setNotice(null);
    try {
      const result = await signup(
        isBusiness
          ? {
              email: email.trim(),
              password,
              role: "business",
              name: profile.name,
              countyId: profile.countyId,
            }
          : {
              email: email.trim(),
              password,
              role: "creator",
              name: profile.name,
              countyId: profile.countyId,
              socialLinks: profile.socialLinks,
            },
      );
      setPassword("");
      if (result.status === "signed-in") {
        try {
          writeSession(result.session);
        } catch {
          setCompleted(true);
          setStep(1);
          setNotice({ tone: "info", message: manualLoginMessage });
          return;
        }
        setCompleted(true);
        navigate(dashboardPath(result.session.role), { replace: true });
        return;
      }
      setCompleted(true);
      setStep(1);
      setNotice({ tone: "info", message: manualLoginMessage });
    } catch (error) {
      lock.current = false;
      const fallback = "Sign up failed. Please try again.";
      const message = error instanceof AuthError || error instanceof Error
        ? error.message || fallback
        : fallback;
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const heading = isBusiness ? "Join as a business" : "Join as a creator";
  const summary = isBusiness
    ? "Find and collaborate with local creators."
    : "Connect with businesses and discover opportunities.";

  if (step === 2) {
    return (
      <div className={cardClass}>
        <StepMarks step={2} />
        <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">
          {heading}
        </h1>
        <p className="mt-2 text-sm">{summary}</p>
        <ProfileCompletionForm
          role={role}
          counties={counties}
          countyState={countyState}
          name={name}
          countyId={countyId}
          links={links}
          agreed={agreed}
          onNameChange={setName}
          onCountyChange={setCountyId}
          onLinksChange={setLinks}
          onAgreedChange={setAgreed}
          submitting={submitting}
          errorMessage={submitError}
          onSubmit={onProfileComplete}
        >
          <div className="flex gap-3">
            <AppButton
              type="button"
              variant="secondary"
              className="border border-[var(--cg-border)] bg-white"
              onPress={() => {
                if (submitting) return;
                setSubmitError("");
                setStep(1);
              }}
              isDisabled={submitting}
            >
              Back
            </AppButton>
            <AppButton type="submit" className="flex-1" isDisabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </AppButton>
          </div>
        </ProfileCompletionForm>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onContinue} className={cardClass}>
      <StepMarks step={1} />
      <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">
        {heading}
      </h1>
      <p className="mt-2 text-sm">
        {summary}{" "}
        <Link
          to="/signup"
          aria-disabled={locked}
          tabIndex={locked ? -1 : undefined}
          className={`font-semibold whitespace-nowrap no-underline ${
            locked
              ? "pointer-events-none text-[var(--cg-muted)]"
              : "text-[var(--cg-primary-dark)]"
          }`}
          onClick={(event) => {
            if (locked) event.preventDefault();
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

      </div>

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
        Continue
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
