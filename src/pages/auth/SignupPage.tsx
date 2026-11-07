import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { InputGroup, Label, TextField } from "@heroui/react";
import {
  AppButton,
  AppInput,
  AppNotice,
  AppSelect,
  CreatorSocialLinks,
  type CreatorSocialLink,
} from "../../components";
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
    <div className="-m-12 min-h-[calc(100dvh-4.5rem)] bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-my-8">
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

function SignupForm({ role }: { role: SignupRole }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [county, setCounty] = useState("");
  const [socialLinks, setSocialLinks] = useState<CreatorSocialLink[]>([]);
  const [message, setMessage] = useState("");
  const isBusiness = role === "business";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Sign up isn't connected yet.");
  }

  return (
    <form onSubmit={onSubmit} className={cardClass}>
      <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">
        {isBusiness ? "Join as a business" : "Join as a creator"}
      </h1>
      <p className="mt-2 text-sm">
        {isBusiness
          ? "Find and collaborate with local creators."
          : "Connect with businesses and discover opportunities."}{" "}
        <Link
          to="/signup"
          className="font-semibold whitespace-nowrap text-[var(--cg-primary-dark)] no-underline"
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
          required
        />

        <TextField
          name="password"
          type={showPassword ? "text" : "password"}
          isRequired
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
              onChange={(event) => setPassword(event.target.value)}
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
        </TextField>

        <AppSelect
          label="County"
          name="county"
          value={county}
          onChange={setCounty}
          options={countyOptions}
          placeholder="Select a county"
          required
        />

        <AppInput
          label={isBusiness ? "Business Name" : "Display Name"}
          name={isBusiness ? "businessName" : "displayName"}
          placeholder={isBusiness ? "Garden Cafe" : "Alex Rivera"}
          required
        />

        {!isBusiness && (
          <CreatorSocialLinks links={socialLinks} onChange={setSocialLinks} />
        )}
      </div>

      {message && (
        <div className="mt-4">
          <AppNotice
            tone="info"
            message={message}
            onClose={() => setMessage("")}
          />
        </div>
      )}

      <AppButton type="submit" className="mt-6 w-full">
        Sign up
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
        onPress={() => setMessage("Continue with Google is coming soon.")}
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
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          Log in
        </Link>
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
