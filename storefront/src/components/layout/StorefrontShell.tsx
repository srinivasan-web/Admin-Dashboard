import type { ReactNode } from "react";
import { Link } from "../../app/navigation";
import type { Category } from "../../api/catalog";
import { BrandLogo } from "../navigation/BrandLogo";
import { GlobalHeader } from "../navigation/GlobalHeader";

export function StorefrontShell({
  children,
  fullBleed = false,
  categories = [],
  categoryError,
  retryCategories,
}: {
  children: ReactNode;
  fullBleed?: boolean;
  categories?: Category[];
  categoryError?: Error;
  retryCategories: () => void;
}) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <GlobalHeader
        categories={categories}
        categoryError={categoryError}
        retryCategories={retryCategories}
      />
      <main
        className={fullBleed ? "storefront storefront-home" : "storefront"}
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="store-footer">
        <div className="footer-inner">
          <div>
            <BrandLogo />
            <p>Make movement part of home.</p>
          </div>
          <nav aria-label="Footer navigation">
            <Link href="/products">Explore equipment</Link>
            <a href="/#categories">Browse equipment types</a>
            <a href="/#featured">Featured collection</a>
          </nav>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Durafit91</span>
            <span>Built around your everyday.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
