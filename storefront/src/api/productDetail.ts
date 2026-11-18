import type { Product, Specification } from "./catalog";

export type ProductDetailResponse = { data: Product | null };
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const nullableText = (value: unknown) => value == null || typeof value === "string";
const master = (value: unknown) => object(value) && typeof value.id === "string" && typeof value.name === "string";
const specification = (value: unknown): value is Specification => object(value)
  && typeof value.id === "string" && typeof value.value === "string"
  && typeof value.sort_order === "number" && master(value.attribute)
  && object(value.attribute) && nullableText(value.attribute.unit)
  && nullableText(value.attribute.icon)
  && (value.attribute.slug == null || typeof value.attribute.slug === "string");

function optionalRows(value: unknown, valid: (row: unknown) => boolean): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value) || !value.every(valid)) throw new Error("Invalid product response");
  return value;
}

/** Check the response boundary; missing optional sections stay empty. */
export function readProductDetail(response: unknown): ProductDetailResponse {
  if (!object(response) || !("data" in response)) throw new Error("Invalid product response");
  if (response.data === null) return { data: null };
  const value = response.data;
  if (!object(value) || typeof value.id !== "string" || typeof value.name !== "string"
    || typeof value.sku !== "string" || !master(value.category) || !master(value.product_type)
    || !object(value.price) || typeof value.price.currency !== "string"
    || !/^[A-Z]{3}$/.test(value.price.currency) || typeof value.price.mrp !== "string"
    || !(value.price.sale === null || typeof value.price.sale === "string")
    || typeof value.available_stock !== "number" || !Number.isFinite(value.available_stock)
    || !nullableText(value.description) || !nullableText(value.short_description)
    || !nullableText(value.slug) || !nullableText(value.tag)
    || (value.brand != null && !master(value.brand))) {
    throw new Error("Invalid product response");
  }

  const images = optionalRows(value.images, (row) => object(row)
    && typeof row.id === "string" && typeof row.url === "string"
    && typeof row.is_primary === "boolean" && nullableText(row.alt_text));
  const specifications = optionalRows(value.specifications, specification);
  const highlights = optionalRows(value.highlights, (row) => object(row)
    && typeof row.id === "string" && typeof row.is_active === "boolean"
    && typeof row.sort_order === "number" && specification(row.specification));
  const details = optionalRows(value.details, (row) => object(row)
    && typeof row.id === "string" && typeof row.title === "string"
    && typeof row.content === "string" && typeof row.is_active === "boolean");
  const benefits = optionalRows(value.benefits, (row) => object(row)
    && typeof row.id === "string" && typeof row.title === "string"
    && typeof row.is_active === "boolean" && nullableText(row.description) && nullableText(row.icon_url));
  if (value.additional_details != null && (!object(value.additional_details)
    || !Object.values(value.additional_details).every(nullableText))) {
    throw new Error("Invalid product response");
  }

  return { data: { ...value, images, specifications, highlights, details, benefits } as Product };
}
