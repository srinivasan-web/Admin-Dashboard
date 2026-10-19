import { type FormEvent, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { registerInitialAdmin, type AdminUser } from "../../api/adminAuth";
import { ApiError, errorMessage } from "../../api/client";
import { AuthLayout } from "./AuthLayout";
import { isValidEmail } from "./emailValidation";

export function RegisterPage({
  onAuthenticated,
  onLogin,
}: {
  onAuthenticated: (user: AdminUser) => void;
  onLogin: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Please enter your full name.";
    if (!isValidEmail(email))
      nextErrors.email = "Please enter a valid email address.";
    if (
      password.length < 12 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      nextErrors.password =
        "Use at least 12 characters, including a letter and a number.";
    }
    if (password !== confirmation) {
      nextErrors.password_confirmation =
        "Password confirmation does not match.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setError(undefined);
    setSubmitting(true);
    try {
      const response = await registerInitialAdmin({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirmation,
      });
      onAuthenticated(response.data.user);
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.status === 422 &&
        reason.details
      ) {
        const { name, email, password, password_confirmation, ...other } =
          reason.details;
        setFieldErrors({
          ...(name?.[0] ? { name: name[0] } : {}),
          ...(email?.[0] ? { email: email[0] } : {}),
          ...(password?.[0] ? { password: password[0] } : {}),
          ...(password_confirmation?.[0]
            ? { password_confirmation: password_confirmation[0] }
            : {}),
        });
        if (Object.keys(other).length) setError(errorMessage(reason));
      } else if (reason instanceof ApiError && reason.status === 409) {
        setError(
          "Initial setup is already complete. Sign in with your existing account.",
        );
      } else if (reason instanceof ApiError && reason.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError(errorMessage(reason));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout subtitle="INITIAL SETUP">
      <div className="mt-6 mb-5">
        <h1
          id="auth-title"
          className="text-[22px] sm:text-[24px] font-bold leading-tight tracking-tight text-slate-900 m-0"
        >
          Register Initial Manager
        </h1>
      </div>

      <form onSubmit={submit} noValidate className="space-y-3.5">
        {/* Name Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="reg-name"
            className="text-[13px] font-medium text-slate-700 select-none"
          >
            Full name
          </label>
          <div className="relative flex items-center w-full">
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              <User size={17} aria-hidden="true" />
            </div>
            <input
              id="reg-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((current) => ({ ...current, name: "" }));
              }}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "reg-name-error" : undefined}
              className="w-full h-11 pl-10 pr-4 text-[14px] bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          {fieldErrors.name && (
            <p
              id="reg-name-error"
              role="alert"
              className="text-xs text-red-600"
            >
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="reg-email"
            className="text-[13px] font-medium text-slate-700 select-none"
          >
            Email address
          </label>
          <div className="relative flex items-center w-full">
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail size={17} aria-hidden="true" />
            </div>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="admin@durafit.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((current) => ({ ...current, email: "" }));
              }}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? "reg-email-error" : undefined
              }
              className="w-full h-11 pl-10 pr-4 text-[14px] bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          {fieldErrors.email && (
            <p
              id="reg-email-error"
              role="alert"
              className="text-xs text-red-600"
            >
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="reg-password"
            className="text-[13px] font-medium text-slate-700 select-none"
          >
            Password
          </label>
          <div className="relative flex items-center w-full">
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock size={17} aria-hidden="true" />
            </div>
            <input
              id="reg-password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={12}
              autoComplete="new-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((current) => ({ ...current, password: "" }));
              }}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password
                  ? "reg-password-error"
                  : "reg-password-hint"
              }
              className="w-full h-11 pl-10 pr-11 text-[14px] bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
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
         
          {fieldErrors.password && (
            <p
              id="reg-password-error"
              role="alert"
              className="text-xs text-red-600"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="reg-confirmation"
            className="text-[13px] font-medium text-slate-700 select-none"
          >
            Confirm password
          </label>
          <div className="relative flex items-center w-full">
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock size={17} aria-hidden="true" />
            </div>
            <input
              id="reg-confirmation"
              name="password_confirmation"
              type={showPassword ? "text" : "password"}
              minLength={12}
              autoComplete="new-password"
              required
              placeholder="••••••••••••"
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  password_confirmation: "",
                }));
              }}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password_confirmation)}
              aria-describedby={
                fieldErrors.password_confirmation
                  ? "reg-confirmation-error"
                  : undefined
              }
              className="w-full h-11 pl-10 pr-4 text-[14px] bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          {fieldErrors.password_confirmation && (
            <p
              id="reg-confirmation-error"
              role="alert"
              className="text-xs text-red-600"
            >
              {fieldErrors.password_confirmation}
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

        {/* Submit Button */}
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
              <span>Creating account…</span>
            </>
          ) : (
            <span>Create Manager Account</span>
          )}
        </button>
      </form>

      {/* Switch to Login Footer */}
      <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          onClick={onLogin}
          disabled={submitting}
          className="text-link-btn font-medium !bg-transparent !p-0 !min-h-0 !border-0 !shadow-none !transform-none text-slate-700 hover:text-orange-600 flex items-center gap-1 transition-colors cursor-pointer outline-none focus-visible:underline rounded"
        >
          <span>Sign in</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </AuthLayout>
  );
}
