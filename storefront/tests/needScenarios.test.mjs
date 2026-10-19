import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/components/home/needScenarios.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  needScenarios,
  collectionProducts,
  previewProduct,
  previewSpecification,
  needJourney,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`
);
const scenario = (id) => needScenarios.find((item) => item.id === id);
const product = (id, sale = null, specifications = []) => ({
  id,
  name: id,
  specifications,
  price: { currency: "INR", mrp: "20000.00", sale },
});

test("six needs have unique IDs, complete guidance and supported destinations", () => {
  assert.equal(needScenarios.length, 6);
  assert.equal(new Set(needScenarios.map((need) => need.id)).size, 6);
  for (const need of needScenarios) {
    assert.ok(need.title && need.problem && need.approach && need.cta);
    assert.equal(need.checks.length, 3);
    assert.match(
      needJourney(need),
      /^(\/products(?:\?sort=price_asc)?|https:\/\/www\.durafit91\.com\/91wiz)$/,
    );
  }
});
test("collection previews reuse persisted IDs and remove overlapping placements", () => {
  const first = product("persisted-one");
  const second = product("persisted-two");
  assert.deepEqual(collectionProducts([first], undefined, [first, second]), [
    first,
    second,
  ]);
  assert.deepEqual(collectionProducts(undefined, []), []);
});
test("budget opens real server price sorting and previews only existing prices", () => {
  const expensive = product("expensive");
  const discounted = product("sale", "12000.00");
  assert.equal(
    previewProduct([expensive, discounted], scenario("budget")),
    discounted,
  );
  assert.equal(needJourney(scenario("budget")), "/products?sort=price_asc");
  assert.equal(previewProduct([], scenario("budget")), undefined);
  assert.equal(
    previewProduct(
      [{ ...expensive, price: { mrp: "invalid", sale: null } }],
      scenario("budget"),
    ),
    undefined,
  );
});
test("specification preview displays existing values without inventing dimensions or capacity", () => {
  const dimension = {
    attribute: { name: "Equipment Dimensions", unit: "cm" },
    value: "160 x 75",
    id: "persisted-spec",
  };
  const specified = product("specified", null, [dimension]);
  assert.equal(
    previewProduct([product("other"), specified], scenario("space")),
    specified,
  );
  assert.equal(previewSpecification(specified, scenario("space")), dimension);
  assert.equal(
    previewSpecification(specified, scenario("household")),
    undefined,
  );
  assert.equal(
    needJourney(scenario("space"), specified),
    "/products/specified",
  );
  assert.equal(needJourney(scenario("space")), "/products");
});
test("routine and support journeys never introduce comparison, quiz or unsupported filter routes", () => {
  assert.equal(needJourney(scenario("routine"), product("one")), "/products");
  assert.equal(
    needJourney(scenario("support"), product("one")),
    "https://www.durafit91.com/91wiz",
  );
  for (const need of needScenarios)
    assert.doesNotMatch(
      needJourney(need, product("one")),
      /discover|compare|recommendation|budget=/,
    );
});
