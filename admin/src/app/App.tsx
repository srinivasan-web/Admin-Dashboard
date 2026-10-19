import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { currentAdmin, logout, type AdminUser } from "../api/adminAuth";
import { ApiError, errorMessage } from "../api/client";
import { CatalogPage } from "../features/catalog/CatalogPage";
import { InventoryPage } from "../features/catalog/InventoryPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { BannersPage } from "../features/banners/BannersPage";
import { OrdersPage } from "../features/orders";
import { AdminDashboard } from "./AdminDashboard";
import { AdminShell } from "./AdminShell";
import type { AdminView } from "./AdminSidebar";
import {
  pathForAdminView,
  pathForCatalogRoute,
  pathForProductRoute,
  resolveAdminRoute,
  type CatalogRouteMode,
  type CatalogRouteState,
  type CatalogRouteView,
  type ProductRouteMode,
} from "./routes";
import { UnavailableModulePage } from "./UnavailableModulePage";
import { canLeaveWorkspace } from "./navigationGuard";

type Screen = "login" | "register" | "admin";

function loginPathFor(pathname: string, search = ""): string {
  return pathname === "/" || pathname === "/login" || pathname === "/register"
    ? "/login"
    : `/login?next=${encodeURIComponent(pathname + search)}`;
}

function destinationAfterAuthentication(): string {
  const pathname = window.location.pathname;
  if (pathname !== "/login" && pathname !== "/register") {
    return pathname === "/" ? "/dashboard" : pathname + window.location.search;
  }

  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  // Unknown or authentication paths must never become post-login destinations.
  const destination = new URL(next, window.location.origin);
  if (
    destination.origin !== window.location.origin ||
    (resolveAdminRoute(destination.pathname).view === "dashboard" &&
      destination.pathname !== "/dashboard")
  ) {
    return "/dashboard";
  }
  return destination.pathname + destination.search;
}

export function App() {
  const [screen, setScreen] = useState<Screen>(
    window.location.pathname === "/register" ? "register" : "login",
  );
  const [user, setUser] = useState<AdminUser>();
  const [logoutError, setLogoutError] = useState<string>();
  const [checkingSession, setCheckingSession] = useState(true);
  const initialRoute = resolveAdminRoute(window.location.pathname);
  const [activeView, setActiveView] = useState<AdminView>(initialRoute.view);
  const [orderId, setOrderId] = useState<string | undefined>(
    initialRoute.orderId,
  );
  const [bannerMode, setBannerMode] = useState<"list" | "create" | "edit">(
    initialRoute.bannerMode ?? "list",
  );
  const [bannerId, setBannerId] = useState<string | undefined>(
    initialRoute.bannerId,
  );
  const [productMode, setProductMode] = useState<ProductRouteMode>(
    initialRoute.productMode ?? "list",
  );
  const [productId, setProductId] = useState<string | undefined>(
    initialRoute.productId,
  );
  const [catalogRoute, setCatalogRoute] = useState<CatalogRouteState>(
    initialRoute.catalogRoute ?? { mode: "list" },
  );

  function showRoute(pathname: string) {
    const route = resolveAdminRoute(pathname);
    setActiveView(route.view);
    setOrderId(route.orderId);
    setBannerMode(route.bannerMode ?? "list");
    setBannerId(route.bannerId);
    setProductMode(route.productMode ?? "list");
    setProductId(route.productId);
    setCatalogRoute(route.catalogRoute ?? { mode: "list" });
  }

  function authenticated(authenticatedUser: AdminUser) {
    const destination = destinationAfterAuthentication();
    window.history.replaceState({}, "", destination);
    showRoute(new URL(destination, window.location.origin).pathname);
    setUser(authenticatedUser);
    setLogoutError(undefined);
    setScreen("admin");
  }

  function showLogin() {
    const pathname = window.location.pathname;
    if (pathname !== "/login") {
      window.history.replaceState(
        {},
        "",
        loginPathFor(pathname, window.location.search),
      );
    }
    setUser(undefined);
    setScreen("login");
  }

  useEffect(() => {
    void currentAdmin()
      .then((response) => {
        authenticated(response.data.user);
      })
      .catch(() => {
        if (window.location.pathname === "/register") {
          setScreen("register");
        } else {
          showLogin();
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);
  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      if (!canLeaveWorkspace(true)) {
        event.stopImmediatePropagation();
        return;
      }
      const pathname = window.location.pathname;
      if (user) {
        if (pathname === "/login" || pathname === "/register") {
          authenticated(user);
        } else {
          showRoute(pathname);
        }
      } else if (pathname === "/register") {
        setScreen("register");
      } else if (pathname === "/login") {
        setScreen("login");
      } else {
        showLogin();
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [user]);
  useEffect(() => {
    function handleSessionExpiry() {
      if (window.location.pathname === "/register") {
        setUser(undefined);
        setScreen("register");
      } else {
        showLogin();
      }
    }
    window.addEventListener(
      "durafit:admin-session-expired",
      handleSessionExpiry,
    );
    return () =>
      window.removeEventListener(
        "durafit:admin-session-expired",
        handleSessionExpiry,
      );
  }, []);
  if (checkingSession)
    return <main className="login">Checking secure session…</main>;
  if (screen === "register")
    return (
      <RegisterPage
        onLogin={() => {
          window.history.pushState({}, "", `/login${window.location.search}`);
          setScreen("login");
        }}
        onAuthenticated={authenticated}
      />
    );
  if (screen !== "admin" || !user)
    return (
      <LoginPage
        onRegister={() => {
          window.history.pushState(
            {},
            "",
            `/register${window.location.search}`,
          );
          setScreen("register");
        }}
        onAuthenticated={authenticated}
      />
    );
  const catalogViews = [
    "product-types",
    "categories",
    "hsn",
    "products",
    "combos",
    "featured-choose",
    "featured-bestsellers",
  ] as const;
  function navigate(view: AdminView) {
    if (!canLeaveWorkspace()) return;
    setActiveView(view);
    setOrderId(undefined);
    setBannerMode("list");
    setBannerId(undefined);
    setProductMode("list");
    setProductId(undefined);
    setCatalogRoute({ mode: "list" });
    const path = pathForAdminView(view);
    if (window.location.pathname !== path)
      window.history.pushState({}, "", path);
  }
  function openOrder(id: string) {
    if (!canLeaveWorkspace()) return;
    setActiveView("orders");
    setOrderId(id);
    const path = `/sales/orders/${encodeURIComponent(id)}`;
    if (window.location.pathname !== path)
      window.history.pushState({}, "", path);
  }
  function openBanner(mode: "list" | "create" | "edit", id?: string) {
    if (!canLeaveWorkspace()) return;
    setActiveView("banners");
    setBannerMode(mode);
    setBannerId(id);
    const path =
      mode === "create"
        ? "/banners/create"
        : mode === "edit" && id
          ? `/banners/${encodeURIComponent(id)}/edit`
          : "/banners";
    if (window.location.pathname !== path)
      window.history.pushState({}, "", path);
  }
  function openProduct(mode: ProductRouteMode, id?: string) {
    if (!canLeaveWorkspace()) return;
    setActiveView("products");
    setProductMode(mode);
    setProductId(id);
    setOrderId(undefined);
    setBannerMode("list");
    setBannerId(undefined);
    const path = pathForProductRoute(mode, id);
    if (window.location.pathname !== path)
      window.history.pushState({}, "", path);
  }
  function openCatalog(
    view: CatalogRouteView,
    mode: CatalogRouteMode,
    recordId?: string,
  ) {
    if (!canLeaveWorkspace()) return;
    setActiveView(view);
    setCatalogRoute({ mode, recordId });
    setOrderId(undefined);
    setBannerMode("list");
    setBannerId(undefined);
    setProductMode("list");
    setProductId(undefined);
    const path = pathForCatalogRoute(view, mode, recordId);
    if (window.location.pathname !== path)
      window.history.pushState({}, "", path);
  }

  async function signOut() {
    if (!canLeaveWorkspace()) return;
    setLogoutError(undefined);
    try {
      await logout();
      setUser(undefined);
      setScreen("login");
      window.history.replaceState({}, "", "/login");
    } catch (reason) {
      // A 401 already triggers the central session-expiry handler.
      if (!(reason instanceof ApiError && reason.status === 401)) {
        setLogoutError(errorMessage(reason));
      }
    }
  }

  return (
    <AdminShell
      user={user}
      activeView={activeView}
      onNavigate={navigate}
      onLogout={() => void signOut()}
    >
      {logoutError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Sign out failed: {logoutError}
        </div>
      )}
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {activeView === "dashboard" && (
          <AdminDashboard
            onNavigate={navigate}
            onCreateProduct={() => openProduct("create")}
          />
        )}
        {activeView === "stock" && <InventoryPage />}
        {(activeView === "orders" || activeView === "abandoned-orders") && (
          <OrdersPage
            abandoned={activeView === "abandoned-orders"}
            orderId={orderId}
            canManage={(user.permissions ?? []).includes("orders.manage")}
            onOpenOrder={openOrder}
            onBack={() => navigate("orders")}
          />
        )}
        {activeView === "banners" && (
          <BannersPage
            mode={bannerMode}
            id={bannerId}
            onCreate={() => openBanner("create")}
            onEdit={(id) => openBanner("edit", id)}
            onList={() => openBanner("list")}
          />
        )}
        {activeView !== "dashboard" &&
          activeView !== "orders" &&
          activeView !== "abandoned-orders" &&
          activeView !== "banners" &&
          activeView !== "stock" &&
          !catalogViews.includes(
            activeView as (typeof catalogViews)[number],
          ) && <UnavailableModulePage view={activeView} />}
        {catalogViews.includes(activeView as (typeof catalogViews)[number]) && (
          <CatalogPage
            canManageInventory={(user.permissions ?? []).includes(
              "inventory.manage",
            )}
            view={activeView as (typeof catalogViews)[number]}
            productRoute={{ mode: productMode, productId }}
            onProductRoute={openProduct}
            catalogRoute={catalogRoute}
            onCatalogRoute={openCatalog}
          />
        )}
      </motion.div>
    </AdminShell>
  );
}
