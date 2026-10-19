import { useState } from "react";
import { ArrowLeft, Image, Pencil, Settings2 } from "lucide-react";
import type { CatalogMasters, Product } from "./types";
import { ProductOperations } from "./ProductOperations";
import { ProductManagementHeader } from "./ProductManagementHeader";
import type { ProductSpecification } from "./types";
import type { CatalogAttribute } from "./types";
import { descriptionAsEditorHtml } from "../../../../shared/productDescription";

type Tab =
  | "overview"
  | "classification"
  | "pricing"
  | "media"
  | "content"
  | "specifications"
  | "inventory"
  | "publishing"
  | "relationships";

export function ProductDetail({
  product,
  onBack,
  onEdit,
  attributes = [],
  masters,
}: {
  product: Product;
  onBack: () => void;
  onEdit: () => void;
  attributes?: CatalogAttribute[];
  masters: CatalogMasters;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const tabs: Array<[Tab, string]> = [
    ["overview", "Overview"],
    ["classification", "Classification"],
    ["pricing", "Pricing"],
    ["media", "Media"],
    ["content", "Content"],
    ["inventory", "Inventory"],
    ["publishing", "Publishing"],
    ["specifications", "Specifications"],

    ["relationships", "Relations"],
  ];
  return (
    <section className="product-detail">
      <ProductManagementHeader
        title={product.name}
        description={product.sku}
        breadcrumb={["Product Management", "Products", product.name]}
        actions={
          <>
            <button className="secondary" onClick={onBack}>
              <ArrowLeft size={18} /> Products
            </button>
            <button onClick={onEdit}>
              <Pencil size={18} /> Edit product
            </button>
          </>
        }
      />
      <nav className="detail-tabs" aria-label="Product detail sections">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section className="card detail-body">
        {tab === "overview" && (
          <div className="detail-grid">
            <Detail label="SKU" value={product.sku} />
            <Detail label="Brand" value={product.brand.name} />
            <Detail label="Group" value={product.group_name ?? "Not set"} />
            <Detail label="Tag" value={product.tag ?? "Not set"} />
            <Detail label="Sort order" value={String(product.sort_order)} />
            <Detail
              label="Status"
              value={product.is_active ? "Active" : "Inactive"}
            />
          </div>
        )}
        {tab === "classification" && (
          <div className="detail-grid">
            <Detail label="Product type" value={product.product_type.name} />
            <Detail label="Category" value={product.category.name} />
            <Detail
              label="HSN"
              value={product.hsn_code?.hsn_code ?? "Not set"}
            />
          </div>
        )}
        {tab === "pricing" && (
          <div className="detail-grid">
            <Detail label="MRP" value={"₹" + product.price.mrp} />
            <Detail
              label="Sale price"
              value={product.price.sale ? "₹" + product.price.sale : "Not set"}
            />
            <Detail label="Currency" value="INR" />
          </div>
        )}
        {tab === "media" && (
          <div>
            <h2>Product media</h2>
            {product.images?.length ? (
              <div className="table-scroll product-media-table">
                <table>
                  <thead>
                    <tr>
                      <th>Media</th>
                      <th>Type</th>
                      <th>Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.images.map((image) => (
                      <tr key={image.id}>
                        <td>
                          <a href={image.url} target="_blank" rel="noreferrer">
                            <Image size={16} /> Open image
                          </a>
                        </td>
                        <td>{image.type}</td>
                        <td>
                          <span
                            className={`status-badge ${image.is_primary ? "active" : "inactive"}`}
                          >
                            {image.is_primary ? "Primary" : "Gallery"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No product image has been uploaded.</p>
            )}
          </div>
        )}
        {tab === "content" && (
          <div>
            <h2>Description</h2>
            {product.description ? (
              <div
                className="content-copy space-y-2 [&_a]:text-orange-700 [&_a]:underline [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{
                  __html: descriptionAsEditorHtml(product.description),
                }}
              />
            ) : (
              <p className="content-copy">
                No product description has been added.
              </p>
            )}
          </div>
        )}
        {tab === "specifications" && (
          <div>
            <h2>Selected highlights</h2>
            {product.highlights?.some((highlight) => highlight.is_active) ? (
              <div className="mb-5 flex flex-wrap gap-2">
                {(product.highlights ?? [])
                  .filter((highlight) => highlight.is_active)
                  .map((highlight) => (
                    <span
                      key={highlight.id}
                      className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-900"
                    >
                      {highlight.specification.attribute.name}:{" "}
                      {highlight.specification.value}{" "}
                      {highlight.specification.attribute.unit}
                    </span>
                  ))}
              </div>
            ) : (
              <p className="empty-state">No highlights selected.</p>
            )}
            <SpecificationsView specifications={product.specifications ?? []} />
          </div>
        )}
        {tab === "inventory" && (
          <div>
            <h2>Current inventory</h2>
            <div className="detail-grid">
              <Detail
                label="Available quantity"
                value={String(product.available_stock)}
              />
              <Detail
                label="Stock status"
                value={
                  product.available_stock > 0 ? "In stock" : "Out of stock"
                }
              />
            </div>
            <ProductOperations
              product={product}
              masters={masters}
              mode="stock"
              readOnly
              onSaved={() => undefined}
            />
          </div>
        )}
        {tab === "publishing" && (
          <div>
            <h2>Publishing</h2>
            <p className="content-copy">
              This product is currently{" "}
              <strong>{product.is_active ? "active" : "inactive"}</strong>.
              Publishing state is managed in Edit product.
            </p>
            <button onClick={onEdit}>
              <Settings2 size={18} /> Edit publishing
            </button>
          </div>
        )}
        {tab === "relationships" && (
          <div>
            <h2>Relations</h2>
            <p className="empty-state">
              Buy It With and related-product relationships are not yet
              supported by the Laravel API or database contract.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SpecificationsView({
  specifications,
}: {
  specifications: ProductSpecification[];
}) {
  if (!specifications.length)
    return <p className="empty-state">No specifications to display.</p>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {specifications.map((item) => (
            <tr key={item.id}>
              <td>{item.attribute.name}</td>
              <td>{item.value}</td>
              <td>{item.attribute.unit ?? "—"}</td>
              <td>{item.sort_order}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
