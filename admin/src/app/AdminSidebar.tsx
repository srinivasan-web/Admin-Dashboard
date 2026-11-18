import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  FileText,
  Grid2X2,
  HeartHandshake,
  LayoutDashboard,
  Layers3,
  LogOut,
  Package,
  ShoppingCart,
  Star,
  Tags,
  UsersRound,
  X,
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AdminUser } from "../api/adminAuth";

export type AdminView =
  | "dashboard"
  | "product-types"
  | "categories"
  | "hsn"
  | "products"
  | "combos"
  | "stock"
  | "featured-choose"
  | "featured-bestsellers"
  | "orders"
  | "abandoned-orders"
  | "warranty"
  | "contacts"
  | "crm-dashboard"
  | "crm-leads"
  | "crm-offline-camp"
  | "coupons"
  | "testimonials-dashboard"
  | "testimonials-all"
  | "faqs"
  | "shop-benefits"
  | "legal-pages"
  | "banners";

export const unavailableModules: Partial<
  Record<AdminView, { title: string; description: string; requirement: string }>
> = {
  warranty: {
    title: "Warranty Registrations",
    description: "Review customer warranty registrations.",
    requirement:
      "Warranty database schema, lifecycle rules, authorization, and API are required.",
  },
  contacts: {
    title: "Contact Details",
    description: "Manage customer support contact records.",
    requirement:
      "Contact/support schema, retention rules, authorization, and API are required.",
  },
  "crm-dashboard": {
    title: "CRM Dashboard",
    description: "Monitor customer leads and operational follow-up.",
    requirement: "CRM lead schema, stages, permissions, and API are required.",
  },
  "crm-leads": {
    title: "All Leads",
    description: "Manage and qualify customer leads.",
    requirement:
      "CRM lead schema, deduplication rules, permissions, and API are required.",
  },
  "crm-offline-camp": {
    title: "Offline Camp",
    description: "Manage offline-campaign lead capture.",
    requirement:
      "Offline-camp data model, consent rules, and API are required.",
  },
  coupons: {
    title: "Coupons",
    description: "Manage promotional coupon rules.",
    requirement:
      "Coupon schema, eligibility and usage rules, authorization, and API are required.",
  },
  "testimonials-dashboard": {
    title: "Testimonials",
    description: "Review and publish customer testimonials.",
    requirement:
      "Testimonial schema, publishing workflow, moderation rules, and API are required.",
  },
  "testimonials-all": {
    title: "All Testimonials",
    description: "Browse and moderate customer testimonials.",
    requirement:
      "Testimonial schema, publishing workflow, moderation rules, and API are required.",
  },
  "legal-pages": {
    title: "Legal Pages",
    description: "Manage published legal content.",
    requirement:
      "Legal-page schema, publication/versioning policy, and API are required.",
  },
};

function NavItem({
  icon: Icon,
  label,
  active,
  isSubmenu = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  isSubmenu?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-link relative flex items-center w-full rounded-lg transition-all duration-150 text-left select-none outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 ${
        isSubmenu
          ? "min-h-[34px] py-1.5 px-2.5 text-[13px] font-medium leading-[18px] text-slate-600 gap-2.5"
          : "min-h-[38px] py-2 px-3 text-[14px] font-medium leading-[20px] text-slate-700 gap-3"
      } ${
        active
          ? "bg-orange-50 text-orange-700 font-semibold shadow-xs"
          : "bg-transparent hover:bg-slate-100/80 hover:text-slate-900"
      }`}
      onClick={onClick}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-orange-600 rounded-r-full"
          aria-hidden="true"
        />
      )}
      <Icon
        size={isSubmenu ? 15 : 18}
        className={`flex-shrink-0 transition-colors ${
          active ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
        }`}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

function NavGroup({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
  hasActiveChild = false,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  hasActiveChild?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild]);

  return (
    <div className="sidebar-group mb-1">
      <button
        type="button"
        className={`sidebar-link sidebar-group-toggle flex items-center justify-between w-full min-h-[38px] py-2 px-3 rounded-lg text-[14px] font-medium leading-[20px] transition-colors bg-transparent text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 ${
          hasActiveChild ? "text-orange-900 font-semibold" : ""
        }`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="flex items-center gap-3 truncate">
          <Icon
            size={18}
            className={`flex-shrink-0 ${hasActiveChild ? "text-orange-600" : "text-slate-400"}`}
            aria-hidden="true"
          />
          <span className="truncate">{label}</span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400 flex items-center"
        >
          <ChevronDown size={16} aria-hidden="true" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="sidebar-subnav ml-3.5 pl-3 border-l border-slate-200/80 py-1 flex flex-col gap-0.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AdminSidebar({
  activeView,
  onNavigate,
  open,
  user,
  onLogout,
  onClose,
}: {
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  open: boolean;
  user: AdminUser;
  onLogout: () => void;
  onClose?: () => void;
}) {
  const initials =
    (user.name || "A")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "A";
  const canViewOrders = (user.permissions ?? []).includes("orders.view");

  const item = (
    icon: LucideIcon,
    label: string,
    view: AdminView,
    isSubmenu = false,
  ) => (
    <NavItem
      icon={icon}
      label={label}
      active={activeView === view}
      isSubmenu={isSubmenu}
      onClick={() => onNavigate(view)}
    />
  );

  return (
    <aside
      className={`admin-sidebar fixed top-0 left-0 bottom-0 z-30 h-screen w-[260px] min-w-[260px] max-w-[260px] flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col overflow-y-auto overflow-x-hidden transition-transform duration-200 ease-in-out ${
        open ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-400 flex items-center justify-center text-white font-black text-xs shadow-xs tracking-wider">
            <img src="/durafit-icon.png" alt="Logo" className="w-6 h-6 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[14px] leading-[18px] tracking-tight text-slate-900">
              Durafit 91
            </span>
           
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 bg-transparent"
            aria-label="Close sidebar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav
        aria-label="Admin navigation"
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-0.5 custom-scrollbar"
      >
        {item(Grid2X2, "Dashboard", "dashboard")}

        <div className="pt-2 pb-1 px-3">
          <span className="text-[11px] font-semibold leading-[16px] uppercase tracking-wider text-slate-400">
            Catalog & Sales
          </span>
        </div>

        <NavGroup
          icon={Package}
          label="Product Management"
          defaultOpen
          hasActiveChild={[
            "product-types",
            "categories",
            "hsn",
            "products",
            "combos",
          ].includes(activeView)}
        >
          {item(Tags, "Product Type", "product-types", true)}
          {item(Layers3, "Category", "categories", true)}
          {item(ClipboardList, "HSN", "hsn", true)}
          {item(Package, "Products", "products", true)}
          {item(ShoppingCart, "Combos", "combos", true)}
        </NavGroup>

        <NavGroup
          icon={Boxes}
          label="Stock"
          defaultOpen
          hasActiveChild={activeView === "stock"}
        >
          {item(Boxes, "Warehouse Stock", "stock", true)}
            
        </NavGroup>

        <NavGroup
          icon={Star}
          label="Featured Products"
          hasActiveChild={[
            "featured-choose",
            "featured-bestsellers",
          ].includes(activeView)}
        >
          {item(Star, "Choose Your Product", "featured-choose", true)}
          {item(Star, "Explore Bestsellers", "featured-bestsellers", true)}
        </NavGroup>

        {canViewOrders && (
          <NavGroup
            icon={BarChart3}
            label="Sales"
            hasActiveChild={["orders", "abandoned-orders"].includes(activeView)}
          >
            {item(ClipboardList, "Orders", "orders", true)}
            {item(ClipboardList, "Abandoned Orders", "abandoned-orders", true)}
          </NavGroup>
        )}

        <div className="pt-3 pb-1 px-3">
          <span className="text-[11px] font-semibold leading-[16px] uppercase tracking-wider text-slate-400">
            Operations & CMS
          </span>
        </div>

        {item(HeartHandshake, "Warranty", "warranty")}
        {item(UsersRound, "Contact Details", "contacts")}

        <NavGroup
          icon={LayoutDashboard}
          label="CRM"
          hasActiveChild={[
            "crm-dashboard",
            "crm-leads",
            "crm-offline-camp",
          ].includes(activeView)}
        >
          {item(LayoutDashboard, "Dashboard", "crm-dashboard", true)}
          {item(UsersRound, "All Leads", "crm-leads", true)}
          {item(UsersRound, "Offline Camp", "crm-offline-camp", true)}
        </NavGroup>

        {item(BadgePercent, "Coupons", "coupons")}

        <NavGroup
          icon={Star}
          label="Testimonials"
          hasActiveChild={[
            "testimonials-dashboard",
            "testimonials-all",
          ].includes(activeView)}
        >
          {item(LayoutDashboard, "Dashboard", "testimonials-dashboard", true)}
          {item(Star, "All Testimonials", "testimonials-all", true)}
        </NavGroup>

        <NavGroup
          icon={FileText}
          label="CMS"
          hasActiveChild={["faqs", "shop-benefits", "legal-pages", "banners"].includes(activeView)}
        >
          {item(ClipboardList, "FAQs", "faqs", true)}
          {item(HeartHandshake, "Why Shop", "shop-benefits", true)}
          {item(FileText, "Legal Pages", "legal-pages", true)}
          {item(Layers3, "Banners", "banners", true)}
        </NavGroup>
      </nav>

      <div className="p-3.5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70 flex-shrink-0 w-full overflow-hidden">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-800 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
            {initials}
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-900 truncate leading-tight">
              {user.name}
            </span>
            <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
              {user.email}
            </span>
          </div>
        </div>
        <button
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 flex-shrink-0 bg-transparent cursor-pointer"
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={onLogout}
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
