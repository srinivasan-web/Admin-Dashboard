import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/app/routes.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const routes = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`
);

test("every admin view has one stable canonical route", () => {
  const entries = Object.entries(routes.adminViewPaths);
  assert.equal(entries.length, 23);
  assert.equal(new Set(entries.map(([, path]) => path)).size, entries.length);
  for (const [view, path] of entries) {
    assert.equal(routes.adminViewFromPath(path), view);
    assert.equal(routes.pathForAdminView(view), path);
  }
});

test("legacy catalog paths continue to resolve", () => {
  assert.equal(routes.adminViewFromPath("/"), "dashboard");
  assert.equal(routes.adminViewFromPath("/category"), "categories");
  assert.equal(routes.adminViewFromPath("/hsn"), "hsn");
  assert.equal(routes.adminViewFromPath("/combos"), "combos");
  assert.equal(routes.adminViewFromPath("/stock-movements"), "stock");
});

test("trailing slashes normalize and unknown routes remain unresolved", () => {
  assert.equal(routes.adminViewFromPath("/warranty-registrations/"), "warranty");
  assert.equal(routes.adminViewFromPath("/not-a-real-module"), undefined);
});

test("product create, edit, and detail actions have refreshable routes", () => {
  assert.deepEqual(routes.resolveAdminRoute("/products/create"), {
    view: "products",
    productMode: "create",
  });
  assert.deepEqual(routes.resolveAdminRoute("/products/product%201/edit"), {
    view: "products",
    productMode: "edit",
    productId: "product 1",
  });
  assert.deepEqual(routes.resolveAdminRoute("/products/product%201"), {
    view: "products",
    productMode: "detail",
    productId: "product 1",
  });
  assert.equal(
    routes.pathForProductRoute("edit", "product 1"),
    "/products/product%201/edit",
  );
});

test("catalog master and combo forms resolve create/edit deep links", () => {
  const cases = [
    ["product-types", "/product-types"],
    ["categories", "/categories"],
    ["hsn", "/hsn-codes"],
    ["combos", "/buy-it-with-combos"],
  ];
  for (const [view, base] of cases) {
    assert.equal(routes.pathForCatalogRoute(view, "list"), base);
    assert.equal(routes.pathForCatalogRoute(view, "create"), `${base}/create`);
    assert.equal(
      routes.pathForCatalogRoute(view, "edit", "record 1"),
      `${base}/record%201/edit`,
    );
    assert.deepEqual(routes.resolveAdminRoute(`${base}/create`), {
      view,
      catalogRoute: { mode: "create" },
    });
    assert.deepEqual(routes.resolveAdminRoute(`${base}/record%201/edit`), {
      view,
      catalogRoute: { mode: "edit", recordId: "record 1" },
    });
  }
});

test("banner and order details preserve their action context", () => {
  assert.deepEqual(routes.resolveAdminRoute("/banners/banner-1/edit"), {
    view: "banners",
    bannerMode: "edit",
    bannerId: "banner-1",
  });
  assert.deepEqual(routes.resolveAdminRoute("/sales/orders/order-1"), {
    view: "orders",
    orderId: "order-1",
  });
});
