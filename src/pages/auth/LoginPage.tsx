import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { InputGroup, Label, TextField } from "@heroui/react";
import { AppButton, AppInput, AppNotice } from "../../components";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Login isn't connected yet.");
  }

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

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[var(--cg-border)] bg-white p-6 shadow-sm md:p-8"
        >
          <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm">Log in to continue with CollabGarden.</p>

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
                  placeholder="Enter your password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <InputGroup.Suffix>
                  <button
                    type="button"
                    className="inline-flex items-center text-[var(--cg-muted)]"
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
            Log In
          </AppButton>

          <p className="mt-4 text-center text-sm">
            Need an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-[var(--cg-primary-dark)] no-underline"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
