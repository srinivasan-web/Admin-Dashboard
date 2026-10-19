import type { ReactNode } from "react";

export function AuthLayout({
  children,
  subtitle = "ADMIN CONSOLE",
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden bg-slate-50 selection:bg-orange-500 selection:text-white px-4 py-8 sm:px-6">
      {/* Subtle modern ambient background glow & grid */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-400/10 via-orange-400/3 to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e140_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e140_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none opacity-50"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        <section
          className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/[0.04] p-6 sm:p-8 transition-all"
          aria-labelledby="auth-title"
        >
          {/* Brand Header */}
          <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
            <div className="w-10 h-10 min-w-10 min-h-10 rounded-xl bg-orange-50 border border-orange-200/70 flex items-center justify-center p-2 shadow-2xs">
              <img
                src="/durafit-icon.png"
                alt="Durafit"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.parentElement?.querySelector(".fallback-du");
                  if (fallback) (fallback as HTMLElement).style.display = "flex";
                }}
              />
           
            </div>
            <div className="flex flex-col">
              <span className="text-[17px] font-bold leading-tight tracking-tight text-slate-900">
                Durafit 91
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 leading-tight mt-0.5">
                {subtitle}
              </span>
            </div>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
