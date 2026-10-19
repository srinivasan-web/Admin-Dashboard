import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/catalog/productFormState.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  hydrateProductRelatedDraft,
  filterableSpecifications,
  selectedHighlightSpecifications,
  snapshotProductHighlights,
  snapshotProductSpecifications,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`
);

function resource() {
  const attribute = {
    id: "attribute-motor",
    name: "Motor Power",
    slug: "motor-power",
    icon: null,
    description: null,
    data_type: "text",
    unit: "HP",
    is_filterable: true,
    is_active: true,
    sort_order: 1,
  };
  const specification = {
    id: "spec-motor",
    attribute,
    value: "3",
    sort_order: 2,
    show_on_top: false,
  };
  return {
    id: "product-real-id",
    specifications: [specification],
    highlights: [
      {
        id: "highlight-motor",
        product_attribute_id: specification.id,
        sort_order: 0,
        is_active: false,
        specification,
      },
    ],
  };
}

test("ProductResource hydrates canonical specifications and highlight relationship", () => {
  const draft = hydrateProductRelatedDraft(resource());
  assert.equal(draft.specifications.length, 1);
  assert.equal(draft.specifications[0].id, "spec-motor");
  assert.equal(draft.specifications[0].attribute_id, "attribute-motor");
  assert.equal(draft.specifications[0].value, "3");
  assert.equal(draft.specifications[0].highlight, true);
  assert.equal(draft.specifications[0].highlight_order, 0);
  assert.equal(draft.specifications[0].highlight_active, false);
});

test("resource snapshots preserve API baselines without duplicating highlight state", () => {
  const product = resource();
  assert.deepEqual(
    [...snapshotProductSpecifications(product)],
    [
      [
        "spec-motor",
        JSON.stringify({
          attribute_id: "attribute-motor",
          value: "3",
          sort_order: 2,
          show_on_top: false,
        }),
      ],
    ],
  );
  assert.equal(
    snapshotProductHighlights(product),
    JSON.stringify([
      {
        product_attribute_id: "spec-motor",
        sort_order: 0,
        is_active: false,
      },
    ]),
  );
});

test("filters and highlights are projections of the same specification draft", () => {
  const product = resource();
  const draft = hydrateProductRelatedDraft(product);
  const specification = draft.specifications[0];
  const attributes = [product.specifications[0].attribute];

  assert.deepEqual(filterableSpecifications(draft.specifications, attributes), [
    specification,
  ]);
  assert.deepEqual(selectedHighlightSpecifications(draft.specifications), [
    specification,
  ]);
  assert.equal(specification.value, "3");
  assert.equal(product.specifications.length, 1);
});

test("inactive or non-filterable attributes are excluded and unchecked specifications are not highlights", () => {
  const product = resource();
  const draft = hydrateProductRelatedDraft(product);
  const inactive = {
    ...product.specifications[0].attribute,
    is_active: false,
  };
  const nonFilterable = {
    ...product.specifications[0].attribute,
    is_filterable: false,
  };

  assert.deepEqual(
    filterableSpecifications(draft.specifications, [inactive]),
    [],
  );
  assert.deepEqual(
    filterableSpecifications(draft.specifications, [nonFilterable]),
    [],
  );
  assert.deepEqual(
    selectedHighlightSpecifications([
      { ...draft.specifications[0], highlight: false },
    ]),
    [],
  );
});
