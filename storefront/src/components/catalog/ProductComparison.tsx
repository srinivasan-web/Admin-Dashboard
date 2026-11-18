import { ArrowRight, Check, CircleHelp } from "lucide-react";
import { Link } from "../../app/navigation";
import {
  specificationValue,
  useCatalogResource,
  type ProductComparison as ComparisonResponse,
} from "../../api/catalog";
import { ErrorState, LoadingState } from "../Feedback";
import {
  formatIndianCurrency,
  ProductImage,
  validAmount,
} from "./ProductCard";

export function ProductComparison({
  productId,
  typeName,
}: {
  productId: string;
  typeName: string;
}) {
  const comparison = useCatalogResource<ComparisonResponse>(
    `/products/${encodeURIComponent(productId)}/comparison`,
    { refreshOnFocus: true },
  );

  if (comparison.error) {
    return (
      <section className="mt-12" aria-label="Product comparison">
        <ErrorState error={comparison.error} retry={comparison.retry} />
      </section>
    );
  }
  if (!comparison.data) {
    return <LoadingState label="Loading product comparison…" />;
  }

  const { products, attributes } = comparison.data.data;
  if (attributes.length === 0 || products.length < 2) return null;

  const colSpecWidth = "190px";
  const colProductWidth = "240px";

  return (
    <section
      className="mt-14 sm:mt-20 min-w-0 border-t border-amber-200/50 bg-[#fffdf5] py-12 sm:py-16"
      aria-labelledby="comparison-title"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        {/* Section Header matching Image 3 */}
        <div className="mb-9 text-center">
          <h2
            id="comparison-title"
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-navy tracking-tight"
          >
            Compare {typeName}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm sm:text-base text-slate-500 font-normal">
            Find the perfect fit for your fitness goals
          </p>
        </div>

        {/* Scrollable Comparison Card */}
        <div
          className="overflow-x-auto rounded-2xl border border-amber-200/70 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-accent [scrollbar-width:thin]"
          role="region"
          aria-label="Scrollable product comparison"
          tabIndex={0}
        >
          <table
            className="w-full table-fixed border-collapse text-left text-sm"
            data-testid="product-comparison"
            style={{ minWidth: `${190 + products.length * 240}px` }}
          >
            <caption className="sr-only">
              Comparison of {products.length} available {typeName} products. Not provided means no saved specification value is available.
            </caption>
            <colgroup>
              <col style={{ width: colSpecWidth, minWidth: colSpecWidth }} />
              {products.map((product) => (
                <col
                  key={product.id}
                  style={{ width: colProductWidth, minWidth: colProductWidth }}
                />
              ))}
            </colgroup>

            <thead>
              {/* Product Header Row */}
              <tr className="border-b border-slate-100">
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-white p-4 sm:p-5 align-bottom text-[11px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.03)]"
                >
                  SPECS
                </th>
                {products.map((product) => {
                  const current = product.id === productId;
                  const mrp = validAmount(product.price.mrp);
                  const sale = validAmount(product.price.sale);
                  const currentPrice =
                    sale !== null && (mrp === null || sale <= mrp) ? sale : mrp;
                  const originalPrice =
                    mrp !== null && sale !== null && sale < mrp ? mrp : null;

                  return (
                    <th
                      key={product.id}
                      scope="col"
                      className={`border-r border-slate-100 last:border-r-0 p-4 sm:p-5 align-top transition-colors ${
                        current ? "bg-[#fffcf2]" : "bg-white"
                      }`}
                    >
                      <div className="flex flex-col items-center text-center h-full">
                        {/* Top Badge */}
                        <div className="h-7 mb-2 flex items-center justify-center">
                          {current ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff6b1a] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                              ★ YOUR PRODUCT
                            </span>
                          ) : (
                            <span className="invisible text-[10px] py-1">placeholder</span>
                          )}
                        </div>

                        {/* Product Image - Fully visible, centered, uncropped, matching Image 3 */}
                        <Link
                          href={`/products/${encodeURIComponent(product.id)}`}
                          className="group block w-full"
                        >
                          <div className="relative mx-auto mb-3 flex h-32 sm:h-36 w-full max-w-[170px] items-center justify-center p-1.5 transition-transform duration-300 group-hover:scale-105">
                            <ProductImage product={product} />
                          </div>

                          {/* Product Title */}
                          <span className="block min-h-[2.4rem] text-[13px] sm:text-[14px] font-bold leading-snug text-navy group-hover:text-accent-deep transition-colors line-clamp-2 px-1">
                            {product.name}
                          </span>

                          {/* Price & MRP directly under title matching Image 3 */}
                          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                            {currentPrice !== null && (
                              <span className="text-[15px] sm:text-[16px] font-bold text-navy font-tech">
                                {formatIndianCurrency(currentPrice)}
                              </span>
                            )}
                            {originalPrice !== null && (
                              <del className="text-[11px] text-slate-400 font-normal line-through">
                                {formatIndianCurrency(originalPrice)}
                              </del>
                            )}
                          </div>
                        </Link>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {attributes.map((attribute) => (
                <tr
                  key={attribute.id}
                  className="border-b border-slate-100/90 last:border-b-0 hover:bg-slate-50/30 transition-colors"
                >
                  {/* Left Column with orange bullet point matching Image 3 */}
                  <th
                    scope="row"
                    className="sticky left-0 z-10 p-4 sm:p-5 font-semibold text-xs text-navy border-r border-slate-100 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.03)]"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-[#ff6b1a] font-bold text-sm leading-none">•</span>
                      <span className="truncate">{attribute.name}</span>
                    </span>
                  </th>

                  {products.map((product) => {
                    const specification = product.specifications.find(
                      (spec) => spec.attribute.id === attribute.id,
                    );
                    const current = product.id === productId;
                    return (
                      <td
                        key={product.id}
                        className={`border-r border-slate-100 last:border-r-0 p-3.5 sm:p-4 text-center align-middle ${
                          current ? "bg-[#fffcf2]" : "bg-white"
                        }`}
                      >
                        {specification ? (
                          current ? (
                            /* Warm yellow pill chip for YOUR PRODUCT matching Image 3 */
                            <span className="inline-block rounded-full border border-amber-300/80 bg-[#fff5db] px-3.5 py-1 text-xs font-bold text-amber-950 text-center shadow-2xs">
                              {specificationValue(specification)}
                            </span>
                          ) : (
                            /* Clean specification text for other products */
                            <span className="text-xs font-medium text-slate-700 text-center inline-block">
                              {specificationValue(specification)}
                            </span>
                          )
                        ) : (
                          <span className="text-xs font-normal text-slate-400 text-center inline-block">
                            Not provided
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            <tfoot>
              {/* Action / Next Step Row */}
              <tr className="border-t border-slate-100 bg-slate-50/40">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-slate-50/95 p-4 sm:p-5 font-bold text-[11px] uppercase tracking-wider text-slate-400 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.03)]"
                >
                  NEXT STEP
                </th>
                {products.map((product) => {
                  const current = product.id === productId;
                  return (
                    <td
                      key={product.id}
                      className={`border-r border-slate-100 last:border-r-0 p-3.5 sm:p-4 text-center ${
                        current ? "bg-[#fffcf2]" : ""
                      }`}
                    >
                      {current ? (
                        <span className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-amber-100/80 border border-amber-300/80 text-xs font-bold text-amber-900 cursor-default shadow-2xs">
                          Currently viewing
                        </span>
                      ) : (
                        <Link
                          href={`/products/${encodeURIComponent(product.id)}`}
                          className="group inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#ff6b1a] hover:bg-[#e94f00] active:scale-95 text-white px-3.5 text-xs font-bold transition-all shadow-xs hover:shadow-md"
                        >
                          <span>View product</span>
                          <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-3 text-center text-xs text-slate-400 sm:hidden">
          Swipe sideways to compare all products.
        </p>
      </div>
    </section>
  );
}
