import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AdminUser } from "../api/adminAuth";
import { AdminSidebar, type AdminView } from "./AdminSidebar";
import "../features/catalog/catalog-layout.css";

export function AdminShell({
  user,
  activeView,
  onNavigate,
  onLogout,
  children,
}: {
  user: AdminUser;
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function navigate(view: AdminView) {
    onNavigate(view);
    setSidebarOpen(false);
  }

  const isCatalogLayout = [
    "product-types",
    "categories",
    "hsn",
    "products",
    "combos",
    "stock",
    "featured-choose",
    "featured-bestsellers",
    "orders",
    "abandoned-orders",
    "banners",
  ].includes(activeView);

  return (
    <div
      className={`admin-workspace min-h-screen bg-slate-50 text-slate-800${
        isCatalogLayout ? " catalog-layout" : ""
      }`}
    >
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AdminSidebar
        activeView={activeView}
        onNavigate={navigate}
        open={sidebarOpen}
        user={user}
        onLogout={onLogout}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-[230px] flex flex-col min-h-screen min-w-0 w-full">
        {/* Mobile menu trigger */}
        <div className="lg:hidden p-4 pb-0 flex items-center">
          <button
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content Body: fluid full-page width coverage with balanced padding */}
        <section className="admin-content flex-1 p-6 sm:p-8 w-full min-w-0">
          {children}
        </section>
      </div>
    </div>
  );
}
