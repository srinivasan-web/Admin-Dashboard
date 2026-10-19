import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  Headset,
  Menu,
  PackagePlus,
  Search,
  ShieldCheck,
  ShoppingBag,
  X,
} from "lucide-react";
import { Link, useLocation } from "../../app/navigation";
import type { Category } from "../../api/catalog";
import { BrandLogo } from "./BrandLogo";
import { EquipmentMegaMenu } from "./EquipmentMegaMenu";
import { ProductSearch } from "./ProductSearch";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
type UtilityLink = { label: string; href: string; icon: Icon };

const utilityLinks: UtilityLink[] = [
  { label: "Support", href: "https://www.durafit91.com/91wiz", icon: Headset },
  {
    label: "Warranty",
    href: "https://www.durafit91.com/warranty-details",
    icon: ShieldCheck,
  },
  {
    label: "Register",
    href: "https://www.durafit91.com/register-my-product",
    icon: PackagePlus,
  },
  {
    label: "Cart",
    href: "https://www.durafit91.com/checkout",
    icon: ShoppingBag,
  },
];

function HeaderLink({
  item,
  compact = false,
}: {
  item: UtilityLink;
  compact?: boolean;
}) {
  const IconComponent = item.icon;
  return (
    <a
      className={`header-link ${compact ? "header-link-compact" : ""}`}
      href={item.href}
      aria-label={item.label}
    >
      <IconComponent size={20} aria-hidden="true" />
      {!compact && <span>{item.label}</span>}
    </a>
  );
}

function MobileNavigationDrawer({
  categories,
  categoryError,
  retryCategories,
  onClose,
  onNavigate,
}: {
  categories: Category[];
  categoryError?: Error;
  retryCategories: () => void;
  onClose: (restoreFocus: boolean) => void;
  onNavigate: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(true);
      }
      if (event.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled])",
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="mobile-nav-backdrop">
      <button
        className="mobile-nav-scrim"
        type="button"
        tabIndex={-1}
        aria-label="Close navigation"
        onClick={() => onClose(true)}
      />
      <div
        className="mobile-nav-panel"
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Store navigation"
        ref={panelRef}
      >
        <div className="mobile-nav-heading">
          <span>Explore Durafit91</span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close navigation"
            onClick={() => onClose(true)}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Mobile equipment navigation">
          <span className="nav-overline">SHOP BY EQUIPMENT</span>
          <Link href="/products" onClick={onNavigate}>
            All equipment
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category_id=${encodeURIComponent(category.id)}`}
              onClick={onNavigate}
            >
              {category.name}
            </Link>
          ))}
          {categoryError && (
            <button
              type="button"
              className="mobile-nav-retry"
              onClick={retryCategories}
            >
              Retry categories
            </button>
          )}
        </nav>
        <nav aria-label="Mobile service navigation">
          <span className="nav-overline">HELP &amp; SERVICE</span>
          {utilityLinks.map((item) => (
            <HeaderLink key={item.label} item={item} />
          ))}
        </nav>
      </div>
    </div>
  );
}

export function GlobalHeader({
  categories,
  categoryError,
  retryCategories,

}: {
  categories: Category[];
  categoryError?: Error;
  retryCategories: () => void;
  announcement?: string | null;
}) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const categoryId = new URLSearchParams(location.split("?")[1]).get(
    "category_id",
  );

  useEffect(() => {
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [location]);

  const closeMobile = useCallback((restoreFocus: boolean) => {
    setMobileOpen(false);
    if (restoreFocus)
      requestAnimationFrame(() => menuTriggerRef.current?.focus());
  }, []);

  function afterMobileNavigate() {
    setMobileOpen(false);
    requestAnimationFrame(() =>
      document.getElementById("main-content")?.focus(),
    );
  }

  return (
    <header className="store-header">
     
      <div className="global-header-main">
        <BrandLogo />
        <div className="desktop-equipment">
          <EquipmentMegaMenu
            categories={categories}
            categoryError={categoryError}
            retryCategories={retryCategories}
          />
        </div>
        <div className="desktop-search">
          <ProductSearch id="global-product-search" location={location} />
        </div>
        <nav className="header-utility" aria-label="Help and shopping">
          {utilityLinks.map((item) => (
            <HeaderLink key={item.label} item={item} />
          ))}
        </nav>
        <div className="mobile-header-actions">
          <button
            className="header-icon-button"
            type="button"
            aria-label={mobileSearchOpen ? "Close search" : "Open search"}
            aria-expanded={mobileSearchOpen}
            aria-controls="mobile-search-panel"
            onClick={() => {
              setMobileSearchOpen((value) => !value);
              if (!mobileSearchOpen)
                requestAnimationFrame(() =>
                  searchInputRef.current?.querySelector("input")?.focus(),
                );
            }}
          >
            {mobileSearchOpen ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Search size={21} aria-hidden="true" />
            )}
          </button>
          <HeaderLink item={utilityLinks[3]} compact />
          <button
            ref={menuTriggerRef}
            className="header-icon-button"
            type="button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      {mobileSearchOpen && (
        <div
          className="mobile-search-panel"
          id="mobile-search-panel"
          ref={searchInputRef}
        >
          <ProductSearch
            id="mobile-product-search"
            location={location}
            onNavigate={() => setMobileSearchOpen(false)}
          />
        </div>
      )}
    
      {mobileOpen && (
        <MobileNavigationDrawer
          categories={categories}
          categoryError={categoryError}
          retryCategories={retryCategories}
          onClose={closeMobile}
          onNavigate={afterMobileNavigate}
        />
      )}
    </header>
  );
}
  