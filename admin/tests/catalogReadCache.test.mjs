import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/api/readCache.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { cachedRead, invalidateReads, invalidateAfterWrite } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
test.beforeEach(() => invalidateReads());

test("concurrent consumers and repeat navigation share one request", async () => {
  let calls = 0;
  const load = async () => {
    calls++;
    return { data: [] };
  };
  const [first, second] = await Promise.all([
    cachedRead("/product-types", load),
    cachedRead("/product-types", load),
  ]);
  assert.equal(first, second);
  await cachedRead("/product-types", load);
  assert.equal(calls, 1);
});

test("refresh and expiration revalidate intentionally", async () => {
  let calls = 0;
  const load = async () => ++calls;
  await cachedRead("/products", load);
  assert.equal(await cachedRead("/products", load, { force: true, ttl: 0 }), 2);
  assert.equal(await cachedRead("/products", load), 3);
});

test("a failed read is retryable and is never cached", async () => {
  await assert.rejects(
    cachedRead("/categories", async () => {
      throw new Error("Unavailable");
    }),
  );
  assert.equal(
    await cachedRead("/categories", async () => "recovered"),
    "recovered",
  );
});

test("one cancelled consumer does not abort another consumer", async () => {
  let finish;
  let underlyingSignal;
  const controller = new AbortController();
  const load = (signal) => {
    underlyingSignal = signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const first = cachedRead("/products", load, { signal: controller.signal });
  const second = cachedRead("/products", load);
  const rejected = assert.rejects(first, { name: "AbortError" });
  await Promise.resolve();
  controller.abort();
  await rejected;
  assert.equal(underlyingSignal.aborted, false);
  finish("persisted data");
  assert.equal(await second, "persisted data");
});

test("navigation cancels an orphaned request and it cannot populate a new entry", async () => {
  let finish;
  let underlyingSignal;
  const controller = new AbortController();
  const old = cachedRead(
    "/products",
    (signal) => {
      underlyingSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    { signal: controller.signal },
  );
  const rejected = assert.rejects(old, { name: "AbortError" });
  await Promise.resolve();
  controller.abort();
  await rejected;
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(underlyingSignal.aborted, true);
  assert.equal(await cachedRead("/products", async () => "new"), "new");
  finish("stale");
  await Promise.resolve();
  assert.equal(await cachedRead("/products", async () => "wrong"), "new");
});

test("writes invalidate dependent data, including query keys, but retain unrelated masters", async () => {
  await cachedRead("/categories", async () => "categories");
  await cachedRead("/products", async () => "old stock");
  await cachedRead(
    "/warehouse-stocks?view=matrix&page=1",
    async () => "old stock",
  );
  invalidateAfterWrite("/warehouses/warehouse/products/product/stock");
  assert.equal(
    await cachedRead("/categories", async () => "unnecessary fetch"),
    "categories",
  );
  assert.equal(await cachedRead("/products", async () => "updated"), "updated");
  assert.equal(
    await cachedRead(
      "/warehouse-stocks?view=matrix&page=1",
      async () => "updated",
    ),
    "updated",
  );
});

test("authentication changes clear all cached data", async () => {
  await cachedRead("/categories", async () => "previous user");
  invalidateAfterWrite("/auth/logout");
  assert.equal(
    await cachedRead("/categories", async () => "next user"),
    "next user",
  );
});
