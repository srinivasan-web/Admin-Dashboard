/**
 * DURAFIT ADMIN — GLOBAL DESIGN SYSTEM TOKENS
 * Master tokens defining typography hierarchy, spacing scale, and layout dimensions.
 */

export const tokens = {
  typography: {
    // Exact hierarchy specified in master prompt
    appHeader: "text-[13px] font-semibold leading-[20px]",
    sidebarSection: "text-[11px] font-semibold leading-[16px] uppercase tracking-wider text-slate-400",
    sidebarMainItem: "text-[14px] font-medium leading-[20px]",
    sidebarSubItem: "text-[13px] font-medium leading-[18px]",
    breadcrumb: "text-[12px] font-normal leading-[18px] text-slate-500",
    pageTitle: "text-[28px] font-bold leading-[36px] tracking-tight text-slate-900",
    pageDescription: "text-[14px] font-normal leading-[20px] text-slate-500",
    sectionTitle: "text-[18px] font-semibold leading-[26px] text-slate-900",
    cardTitle: "text-[16px] font-semibold leading-[24px] text-slate-900",
    body: "text-[14px] font-normal leading-[20px] text-slate-700",
    bodyMuted: "text-[14px] font-normal leading-[20px] text-slate-500",
    label: "text-[13px] font-medium leading-[18px] text-slate-700 select-none",
    tableHeader: "text-[11px] font-semibold leading-[16px] uppercase tracking-wider text-slate-500",
    tableContent: "text-[13px] font-normal leading-[20px] text-slate-700",
    button: "text-[13px] font-semibold leading-[20px]",
    badge: "text-[11px] font-semibold leading-[16px]",
    helper: "text-[12px] font-normal leading-[16px] text-slate-500",
    helperText: "text-[12px] font-normal leading-[16px] text-slate-500",
    helperTextError: "text-[12px] font-medium leading-[16px] text-red-600",
    code: "font-mono text-[12px] leading-[16px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200",
  },
  layout: {
    sidebarWidth: "230px",
    topHeaderHeight: "56px",
    pageHorizontalPadding: "32px",
    contentGap: "24px",
    pageHeaderBottomGap: "24px",
    cardPadding: "20px",
    filterPadding: "12px",
    tableRowHeight: "52px",
  },
  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
  },
  colors: {
    brand: {
      primary: "#f36a21",
      primaryHover: "#dd5a12",
      light: "#fff2ea",
      subtle: "#ffeedf",
    },
    slate: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
    semantic: {
      success: "#16a34a",
      successBg: "#f0fdf4",
      warning: "#d97706",
      warningBg: "#fffbeb",
      danger: "#dc2626",
      dangerBg: "#fef2f2",
      info: "#2563eb",
      infoBg: "#eff6ff",
    },
  },
  radius: {
    sm: "rounded-md",
    md: "rounded-lg",
    lg: "rounded-xl",
    xl: "rounded-2xl",
    full: "rounded-full",
  },
  shadow: {
    card: "shadow-xs border border-slate-200/80 hover:shadow-sm transition-shadow duration-200",
    dropdown: "shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/10",
    modal: "shadow-2xl shadow-slate-900/20",
  },
} as const;

export type DesignTokens = typeof tokens;
