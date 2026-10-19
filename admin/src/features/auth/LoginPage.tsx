import { type FormEvent, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { login, type AdminUser } from "../../api/adminAuth";
import { ApiError, errorMessage } from "../../api/client";
import { AuthLayout } from "./AuthLayout";
import { isValidEmail } from "./emailValidation";

export function LoginPage({
  onAuthenticated,
  onRegister,
}: {
  onAuthenticated: (user: AdminUser) => void;
  onRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setEmailError(undefined);
    setPasswordError(undefined);

    const trimmedEmail = email.trim();
    let hasValidationError = false;

    if (!trimmedEmail) {
      setEmailError("Email address is required.");
      hasValidationError = true;
    } else if (!isValidEmail(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      hasValidationError = true;
    }

    if (!password) {
      setPasswordError("Password is required.");
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    setError(undefined);
    setSubmitting(true);

    try {
      const response = await login(trimmedEmail, password);
      onAuthenticated(response.data.user);
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.status === 422 &&
        reason.details
      ) {
        const credentialError = reason.details.email?.some((message) =>
          message.toLowerCase().includes("credentials are incorrect"),
        );
        if (credentialError) {
          setError("Email or password is incorrect. Please try again.");
        } else {
          setEmailError(reason.details.email?.[0]);
          setPasswordError(reason.details.password?.[0]);
          if (!reason.details.email && !reason.details.password) {
            setError(errorMessage(reason));
          }
        }
      } else if (reason instanceof ApiError && reason.status === 429) {
        setError(
          "Too many sign-in attempts. Please wait a minute and try again.",
        );
      } else {
        setError(errorMessage(reason));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout subtitle="ADMIN CONSOLE">
      <div className="mt-6 mb-5">
        <h1
          id="auth-title"
          className="text-[22px] sm:text-[24px] font-bold leading-tight tracking-tight text-slate-900 m-0"
        >
          Operations Sign In
        </h1>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        {/* Email Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="login-email"
            className="text-[13px] font-medium text-slate-700 select-none"
          >
            Email address
          </label>
          <div className="relative flex items-center w-full">
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail size={17} aria-hidden="true" />
            </div>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@durafit.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(undefined);
                if (error) setError(undefined);
              }}
              disabled={submitting}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "login-email-error" : undefined}
              className={`w-full h-11 pl-10 pr-4 text-[14px] bg-white rounded-xl border transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
                emailError
                  ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-900"
                  : "border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs"
              }`}
            />
          </div>
          {emailError && (
            <p
              id="login-email-error"
              className="text-[12px] font-medium text-red-600 mt-0.5 flex items-center gap-1.5"
              role="alert"
            >
              <AlertCircle size={13} aria-hidden="true" />
              <span>{emailError}</span>
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="login-password"
            className="text-[13px] font-medium text-slate-700 select-none"
          >
            Password
          </label>
          <div className="relative flex items-center w-full">
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock size={17} aria-hidden="true" />
            </div>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(undefined);
                if (error) setError(undefined);
              }}
              disabled={submitting}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={
                passwordError ? "login-password-error" : undefined
              }
              className={`w-full h-11 pl-10 pr-11 text-[14px] bg-white rounded-xl border transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
                passwordError
                  ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-900"
                  : "border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={submitting}
              className="password-toggle-btn absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center !p-0 !min-h-0 !border-0 !bg-transparent hover:!bg-slate-100 active:!bg-slate-200 !text-slate-400 hover:!text-slate-700 active:!text-orange-600 rounded-lg transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 !shadow-none !transform-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          {passwordError && (
            <p
              id="login-password-error"
              className="text-[12px] font-medium text-red-600 mt-0.5 flex items-center gap-1.5"
              role="alert"
            >
              <AlertCircle size={13} aria-hidden="true" />
              <span>{passwordError}</span>
            </p>
          )}
        </div>

        {/* Semantic Form Error Banner */}
        {error && (
          <div
            className="p-3 bg-red-50/90 border border-red-200/90 rounded-xl flex items-start gap-2.5 text-red-800"
            role="alert"
          >
            <AlertCircle
              size={17}
              className="text-red-600 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span className="text-[13px] leading-tight font-medium">
              {error}
            </span>
          </div>
        )}

        {/* Sign-in Button */}
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="w-full h-11 px-5 mt-5 text-[14px] font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-xs hover:shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-500/30 disabled:opacity-60 disabled:cursor-not-allowed select-none cursor-pointer !min-h-0 !transform-none"
        >
          {submitting ? (
            <>
              <Loader2
                size={18}
                className="animate-spin text-white"
                aria-hidden="true"
              />
              <span>Signing in…</span>
            </>
          ) : (
            <span>Sign in</span>
          )}
        </button>
      </form>

      {/* Registration Footer */}
      <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          onClick={onRegister}
          disabled={submitting}
          className="text-link-btn font-medium !bg-transparent !p-0 !min-h-0 !border-0 !shadow-none !transform-none text-slate-700 hover:text-orange-600 flex items-center gap-1 transition-colors cursor-pointer outline-none focus-visible:underline rounded"
        >
          <span>Register initial manager</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </AuthLayout>
  );
}
