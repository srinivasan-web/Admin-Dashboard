import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/catalog/productFormPersistence.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { persistProductRelations, persistProductForm } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`
);

function progress() {
  return {
    draft: {
      removedSpecificationIds: [],
      removedImageIds: [],
      imageUpdates: [],
      specifications: [],
      media: [],
      inventory: [],
    },
    specifications: new Map(),
    highlights: "[]",
    images: [],
    requiresReview: false,
  };
}

function api(overrides = {}) {
  return {
    deleteSpecification: async () => undefined,
    saveSpecification: async () => ({
      data: { id: "persisted-specification" },
    }),
    saveHighlights: async () => ({ data: [] }),
    uploadProductImage: async () => ({ data: { images: [] } }),
    updateProductImage: async () => ({ data: { images: [] } }),
    replaceProductImage: async () => ({ data: { images: [] } }),
    deleteProductImage: async () => ({ data: { images: [] } }),
    setWarehouseStock: async () => ({ data: { quantity: 1 } }),
    ...overrides,
  };
}

test("one create save persists core, specifications, highlights, media and stock using real response IDs", async () => {
  const state = progress();
  state.draft.specifications.push({
    attribute_id: "motor",
    value: "3",
    sort_order: 0,
    highlight: true,
    highlight_order: 0,
    highlight_active: true,
  });
  state.draft.media.push({
    file: { name: "motor.png" },
    type: "gallery",
    sort_order: 0,
    is_primary: true,
  });
  state.draft.inventory.push({
    warehouse_id: "warehouse",
    operation: "stock_in",
    quantity: 4,
  });
  const calls = [];
  const saved = { id: "database-product", name: "Treadmill" };
  await persistProductForm(
    { name: "Treadmill" },
    state,
    api({
      saveProduct: async (_body, id) => {
        assert.equal(id, undefined);
        calls.push("create");
        return { data: saved };
      },
      saveSpecification: async (id) => {
        assert.equal(id, saved.id);
        calls.push("specification");
        return { data: { id: "database-spec" } };
      },
      saveHighlights: async (id, rows) => {
        assert.equal(id, saved.id);
        assert.equal(rows[0].product_attribute_id, "database-spec");
        calls.push("highlights");
      },
      uploadProductImage: async (id) => {
        assert.equal(id, saved.id);
        calls.push("image");
        return { data: { images: [{ id: "database-image" }] } };
      },
      setWarehouseStock: async (_warehouse, id) => {
        assert.equal(id, saved.id);
        calls.push("stock");
      },
      loadProduct: async (id) => {
        assert.equal(id, saved.id);
        calls.push("reload");
        return { data: saved };
      },
    }),
    () => {},
  );
  assert.deepEqual(calls, [
    "create",
    "specification",
    "highlights",
    "image",
    "stock",
    "reload",
  ]);
  assert.equal(state.productId, saved.id);
  assert.equal(state.draft.media.length, 0);
  assert.equal(state.draft.inventory.length, 0);
});

test("dependent failure during create retries with PUT and preserves acknowledged specifications", async () => {
  const state = progress();
  state.draft.specifications.push({
    attribute_id: "motor",
    value: "3",
    sort_order: 0,
    highlight: true,
    highlight_order: 0,
    highlight_active: true,
  });
  const coreIds = [];
  let specWrites = 0;
  let failHighlight = true;
  const client = api({
    saveProduct: async (_body, id) => {
      coreIds.push(id);
      return { data: { id: "saved-product" } };
    },
    saveSpecification: async () => {
      specWrites++;
      return { data: { id: "saved-spec" } };
    },
    saveHighlights: async () => {
      if (failHighlight) throw { status: 422 };
    },
    loadProduct: async (id) => ({ data: { id } }),
  });
  await assert.rejects(persistProductForm({}, state, client, () => {}));
  assert.equal(state.productId, "saved-product");
  failHighlight = false;
  await persistProductForm({}, state, client, () => {});
  assert.deepEqual(coreIds, [undefined, "saved-product"]);
  assert.equal(specWrites, 1);
});

test("uncertain create response blocks replay and never invents a product ID", async () => {
  const state = progress();
  let writes = 0;
  const client = api({
    saveProduct: async () => {
      writes++;
      throw new TypeError("Disconnected");
    },
  });
  await assert.rejects(
    persistProductForm({}, state, client, () => {}),
    /Creation response interrupted/,
  );
  assert.equal(state.productId, undefined);
  assert.equal(state.requiresReview, true);
  await assert.rejects(
    persistProductForm({}, state, client, () => {}),
    /Review/,
  );
  assert.equal(writes, 1);
});

test("edit uses the existing ID and preserves unchanged relationships", async () => {
  const state = progress();
  state.productId = "existing-product";
  const result = await persistProductForm(
    { description: "Updated" },
    state,
    api({
      saveProduct: async (body, id) => {
        assert.equal(id, state.productId);
        assert.equal(body.description, "Updated");
        return { data: { id } };
      },
      saveSpecification: async () => {
        assert.fail("Unchanged specifications must not be recreated");
      },
      loadProduct: async (id) => ({ data: { id, description: "Updated" } }),
    }),
    () => {},
  );
  assert.equal(result.data.description, "Updated");
});

test("highlights use the persisted specification ID returned by the API", async () => {
  const state = progress();
  state.draft.specifications.push({
    attribute_id: "motor",
    value: "3 HP",
    sort_order: 0,
    show_on_top: true,
    highlight: true,
    highlight_order: 2,
    highlight_active: false,
  });
  let highlights;
  await persistProductRelations(
    "real-product",
    state,
    api({
      saveHighlights: async (productId, values) => {
        assert.equal(productId, "real-product");
        highlights = values;
        return { data: [] };
      },
    }),
    () => {},
  );
  assert.deepEqual(highlights, [
    {
      product_attribute_id: "persisted-specification",
      sort_order: 2,
      is_active: false,
    },
  ]);
  assert.equal(state.draft.specifications[0].id, "persisted-specification");
});

test("retry after validation failure does not repeat acknowledged stock changes", async () => {
  const state = progress();
  state.draft.inventory = [
    { warehouse_id: "warehouse", operation: "stock_in", quantity: 5 },
    { warehouse_id: "warehouse", operation: "stock_out", quantity: 9 },
  ];
  const calls = [];
  let reject = true;
  const client = api({
    setWarehouseStock: async (_warehouse, _product, quantity) => {
      calls.push(quantity);
      if (quantity === 9 && reject) throw { status: 422 };
      return { data: { quantity } };
    },
  });
  await assert.rejects(
    persistProductRelations("product", state, client, () => {}),
  );
  assert.equal(state.draft.inventory.length, 1);
  reject = false;
  await persistProductRelations("product", state, client, () => {});
  assert.deepEqual(calls, [5, 9, 9]);
  assert.equal(state.draft.inventory.length, 0);
});

test("unknown stock outcome blocks automatic replay", async () => {
  const state = progress();
  state.draft.inventory = [
    { warehouse_id: "warehouse", operation: "stock_in", quantity: 5 },
  ];
  let writes = 0;
  const client = api({
    setWarehouseStock: async () => {
      writes++;
      throw new TypeError("Connection lost");
    },
  });
  await assert.rejects(
    persistProductRelations("product", state, client, () => {}),
    /Review/,
  );
  await assert.rejects(
    persistProductRelations("product", state, client, () => {}),
    /Review/,
  );
  assert.equal(writes, 1);
  assert.equal(state.requiresReview, true);
});

test("stock operations with persistent keys can retry an interrupted response using the same key", async () => {
  const state = progress();
  state.draft.inventory = [
    {
      warehouse_id: "warehouse",
      operation: "stock_in",
      quantity: 4,
      idempotency_key: "same-operation-key",
    },
  ];
  const keys = [];
  let first = true;
  const client = api({
    setWarehouseStock: async (
      _warehouse,
      _product,
      _quantity,
      _operation,
      key,
    ) => {
      keys.push(key);
      if (first) {
        first = false;
        throw new TypeError("Response interrupted");
      }
    },
  });
  await assert.rejects(
    persistProductRelations("product", state, client, () => {}),
  );
  assert.equal(state.requiresReview, false);
  await persistProductRelations("product", state, client, () => {});
  assert.deepEqual(keys, ["same-operation-key", "same-operation-key"]);
  assert.equal(state.draft.inventory.length, 0);
});

test("the core edit token advances after a successful core save before dependent retry", async () => {
  const state = progress();
  state.productId = "existing";
  state.editToken = "old-token";
  const tokens = [];
  const client = api({
    saveProduct: async (body) => {
      tokens.push(body.edit_token);
      return { data: { id: "existing", edit_token: "new-token" } };
    },
    loadProduct: async () => ({ data: { id: "existing" } }),
  });
  await persistProductForm({}, state, client, () => {});
  await persistProductForm({}, state, client, () => {});
  assert.deepEqual(tokens, ["old-token", "new-token"]);
});

test("unchanged persisted specifications are preserved and cleared highlights send an empty list", async () => {
  const state = progress();
  const payload = {
    attribute_id: "motor",
    value: "3 HP",
    sort_order: 0,
    show_on_top: false,
  };
  state.draft.specifications = [
    {
      ...payload,
      id: "spec",
      highlight: false,
      highlight_order: 0,
      highlight_active: true,
    },
  ];
  state.specifications.set("spec", JSON.stringify(payload));
  state.highlights = '[{"product_attribute_id":"spec"}]';
  let saved;
  await persistProductRelations(
    "product",
    state,
    api({
      saveSpecification: async () =>
        assert.fail("Unchanged specification must not be rewritten"),
      saveHighlights: async (_id, highlights) => {
        saved = highlights;
        return { data: [] };
      },
    }),
    () => {},
  );
  assert.deepEqual(saved, []);
});

test("acknowledged uploads are removed from the queue before a later failure", async () => {
  const state = progress();
  state.draft.media = [
    {
      file: { name: "image" },
      is_primary: true,
      type: "gallery",
      sort_order: 0,
    },
  ];
  state.draft.inventory = [
    { warehouse_id: "warehouse", operation: "stock_out", quantity: 9 },
  ];
  await assert.rejects(
    persistProductRelations(
      "product",
      state,
      api({
        uploadProductImage: async () => ({
          data: { images: [{ id: "saved-image" }] },
        }),
        setWarehouseStock: async () => {
          throw { status: 422 };
        },
      }),
      () => {},
    ),
  );
  assert.deepEqual(state.draft.media, []);
  assert.equal(state.images[0].id, "saved-image");
});

test("uncertain new specification response prevents duplicate creation on retry", async () => {
  const state = progress();
  state.draft.specifications = [
    {
      attribute_id: "motor",
      value: "3 HP",
      sort_order: 0,
      show_on_top: false,
      highlight: false,
      highlight_order: 0,
      highlight_active: true,
    },
  ];
  let calls = 0;
  const client = api({
    saveSpecification: async () => {
      calls++;
      throw new TypeError("Connection lost");
    },
  });
  await assert.rejects(
    persistProductRelations("product", state, client, () => {}),
    /Review/,
  );
  await assert.rejects(
    persistProductRelations("product", state, client, () => {}),
    /Review/,
  );
  assert.equal(calls, 1);
});

test("saved image replacement uses its persisted ID and clears the acknowledged queue", async () => {
  const state = progress();
  state.draft.media = [
    {
      file: { name: "new.jpg" },
      replace_image_id: "real-image",
      is_primary: true,
      type: "gallery",
      sort_order: 0,
    },
  ];
  const calls = [];
  await persistProductRelations(
    "real-product",
    state,
    api({
      replaceProductImage: async (productId, imageId, file) => {
        calls.push([productId, imageId, file.name]);
        return { data: { images: [{ id: imageId }] } };
      },
    }),
    () => {},
  );
  assert.deepEqual(calls, [["real-product", "real-image", "new.jpg"]]);
  assert.equal(state.draft.media.length, 0);
  assert.equal(state.images[0].id, "real-image");
});
