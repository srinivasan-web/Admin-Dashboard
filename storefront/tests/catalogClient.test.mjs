import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/api/catalogClient.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { acquireCatalogRequest, catalogRequest, CatalogError } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

test("concurrent consumers share one read and one cancellation does not stop the other", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let complete;
  let calls = 0;
  let signal;
  globalThis.fetch = async (_path, options) => {
    calls++;
    signal = options.signal;
    assert.equal(options.cache, "no-store");
    return new Promise((resolve) => { complete = resolve; });
  };
  const first = acquireCatalogRequest("/products/shared");
  const second = acquireCatalogRequest("/products/shared");
  first.release();
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(signal.aborted, false);
  complete(Response.json({ data: { id: "shared" } }));
  assert.deepEqual(await first.promise, await second.promise);
  second.release();
});

test("leaving the last consumer aborts an unfinished read", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (_path, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  const request = acquireCatalogRequest("/products/aborted");
  const rejection = assert.rejects(request.promise, { name: "AbortError" });
  request.release();
  await rejection;
});

test("completed responses are fetched afresh on the next visit", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => Response.json({ data: { available_stock: ++calls } });
  const first = acquireCatalogRequest("/products/fresh");
  assert.equal((await first.promise).data.available_stock, 1);
  first.release();
  const second = acquireCatalogRequest("/products/fresh");
  assert.equal((await second.promise).data.available_stock, 2);
  second.release();
});

test("not-found and malformed responses preserve actionable errors", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("", { status: 404 });
  await assert.rejects(catalogRequest("/products/missing"), (error) => error instanceof CatalogError && error.status === 404);
  globalThis.fetch = async () => new Response("<html>Unavailable</html>");
  await assert.rejects(catalogRequest("/products/invalid"), (error) => error instanceof CatalogError && error.status === 502);
});
