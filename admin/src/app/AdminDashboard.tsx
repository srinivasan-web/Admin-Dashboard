import {
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  PackagePlus,
  Warehouse,
} from "lucide-react";
import type { AdminView } from "./AdminSidebar";

export function AdminDashboard({
  onNavigate,
  onCreateProduct,
}: {
  onNavigate: (view: AdminView) => void;
  onCreateProduct: () => void;
}) {
  return (
    <section className="dashboard-view">
      <div className="dashboard-hero card">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Durafit 91 Admin</h1>
        </div>
        <div className="dashboard-actions">
          <button onClick={onCreateProduct}>
            <PackagePlus size={18} aria-hidden="true" /> Create product
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button className="secondary" onClick={() => onNavigate("stock")}>
            <Warehouse size={18} aria-hidden="true" /> Stock update
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="metric-card card">
          <div className="metric-header">
            <span className="metric-icon orange">
              <PackagePlus size={18} aria-hidden="true" />
            </span>
            <span className="metric-label">Products</span>
          </div>
          <strong>Catalog ready</strong>
          <p>
            Manage products, classification, pricing, media, and publishing.
          </p>
        </article>

        <article className="metric-card card">
          <div className="metric-header">
            <span className="metric-icon amber">
              <Warehouse size={18} aria-hidden="true" />
            </span>
            <span className="metric-label">Inventory</span>
          </div>
          <strong>Warehouse stock</strong>
          <p>
            Track available stock and update inventory in a controlled flow.
          </p>
        </article>

        <article className="metric-card card">
          <div className="metric-header">
            <span className="metric-icon blue">
              <Boxes size={18} aria-hidden="true" />
            </span>
            <span className="metric-label">Bundles</span>
          </div>
          <strong>Combo merchandising</strong>
          <p>
            Prepare curated product bundles while preserving the catalog data.
          </p>
        </article>

        <article className="metric-card card">
          <div className="metric-header">
            <span className="metric-icon green">
              <ChartNoAxesCombined size={18} aria-hidden="true" />
            </span>
            <span className="metric-label">Status</span>
          </div>
          <strong>Milestone 1</strong>
          <p>
            Core catalog and inventory slice is active; broader commerce modules
            remain planned.
          </p>
        </article>
      </div>

    
    </section>
  );
}
