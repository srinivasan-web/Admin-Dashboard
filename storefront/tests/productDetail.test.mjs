import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/api/productDetail.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { readProductDetail } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
const product = () => ({
  id: "synthetic-id", name: "Test equipment", sku: "TEST-001", slug: "test-equipment",
  category: { id: "category-id", name: "Test category" },
  product_type: { id: "type-id", name: "Test type" },
  price: { currency: "INR", mrp: "20000.00", sale: null }, available_stock: 3,
});

test("missing optional sections render as empty arrays without inventing product data", () => {
  const result = readProductDetail({ data: product() }).data;
  for (const key of ["images", "specifications", "highlights", "details", "benefits"]) assert.deepEqual(result[key], []);
  assert.equal(result.slug, "test-equipment");
  assert.equal(result.price.sale, null);
  assert.equal(result.available_stock, 3);
  assert.deepEqual(readProductDetail({ data: null }), { data: null });
});

test("gallery order and specification/highlight values remain identical to the resource", () => {
  const specification = { id: "spec-id", attribute: { id: "attribute-id", name: "Motor", slug: "motor", icon: "motor", unit: "HP" }, value: "3 Peak", sort_order: 1 };
  const images = [{ id: "image-2", url: "/storage/two.webp", is_primary: false }, { id: "image-1", url: "/storage/one.webp", is_primary: true }];
  const result = readProductDetail({ data: { ...product(), images, specifications: [specification], highlights: [{ id: "highlight-id", specification, is_active: true, sort_order: 0 }] } }).data;
  assert.deepEqual(result.images, images);
  assert.equal(result.specifications[0].value, "3 Peak");
  assert.equal(result.specifications[0].attribute.unit, "HP");
  assert.equal(result.specifications[0].attribute.icon, "motor");
  assert.equal(result.highlights[0].specification, result.specifications[0]);
});

test("malformed successful responses fail instead of becoming catalogue content", () => {
  for (const response of [undefined, {}, { data: {} }, { data: { ...product(), price: null } }, { data: { ...product(), available_stock: undefined } }, { data: { ...product(), images: {} } }, { data: { ...product(), specifications: [{ id: "spec-id", value: "3", sort_order: 0, attribute: { id: "attr-id", name: "Motor", unit: "HP", icon: 42 } }] } }, { data: { ...product(), highlights: [{ specification: null }] } }]) {
    assert.throws(() => readProductDetail(response), /Invalid product response/);
  }
});
