// Renders the actual React inventory panel using responses from Laravel API tests.
// node tests/inventoryUi.integration.mjs [path-to-php]
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const admin = fileURLToPath(new URL("..", import.meta.url));
const backend = path.resolve(admin, "../Admin-Backend");
const temporary = mkdtempSync(path.join(tmpdir(), "durafit-inventory-ui-"));
const fixture = path.join(temporary, "api-responses.json");
const require = createRequire(new URL("../package.json", import.meta.url));
const loaded = new Map();
function component(filename) {
  if (loaded.has(filename)) return loaded.get(filename);
  const result = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputText)(
    (name) =>
      name.startsWith(".")
        ? component(path.resolve(path.dirname(filename), `${name}.tsx`))
        : require(name),
    module,
    module.exports,
  );
  loaded.set(filename, module.exports);
  return module.exports;
}

try {
  const mysql = process.argv.includes("--mysql");
  const args = mysql
    ? [
        "tests/runtime/verify-inventory-mysql.php",
        "--transactional",
        "--ui-snapshots",
      ]
    : [
        "artisan",
        "test",
        "--compact",
        "--filter=test_api_returns_persisted_expiry_balances_and_timeline_after_reload",
      ];
  const result = spawnSync(process.argv[2] ?? "php", args, {
    cwd: backend,
    env: mysql
      ? process.env
      : {
          ...process.env,
          DB_CONNECTION: "sqlite",
          DB_DATABASE: ":memory:",
          DB_URL: "",
          APP_ENV: "testing",
          DURAFIT_INVENTORY_UI_FIXTURES: fixture,
        },
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const snapshots = mysql
    ? JSON.parse(
        result.stdout
          .split(/\r?\n/)
          .find((line) => line.startsWith("UI_SNAPSHOTS:"))
          .slice("UI_SNAPSHOTS:".length),
      )
    : JSON.parse(readFileSync(fixture, "utf8"));
  const orders = ["ACTIVE", "EXPIRED", "COMMITTED", "RELEASED"].map((status) =>
    snapshots.find((order) => order.inventory.status === status),
  );
  const { OrderInventoryPanel } = component(
    path.join(admin, "src/features/orders/OrderInventoryPanel.tsx"),
  );
  const { formatDate } = component(
    path.join(admin, "src/features/orders/OrderUi.tsx"),
  );
  const expected = [
    ["ACTIVE", 20, 2, 18],
    ["EXPIRED", 20, 0, 20],
    ["COMMITTED", 18, 0, 18],
    ["RELEASED", 20, 0, 20],
  ];
  for (const [index, order] of orders.entries()) {
    const [status, physical, reserved, available] = expected[index];
    const markup = renderToStaticMarkup(
      React.createElement(OrderInventoryPanel, {
        order,
        canManage: true,
        saving: false,
        onAllocate() {},
        onReserve() {},
      }),
    );
    const row = markup.match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? "";
    assert.equal(order.inventory.status, status);
    assert.ok(markup.includes(order.warehouse.name));
    assert.ok(row.includes(`<td>${order.inventory.items[0].sku}</td>`));
    assert.ok(
      row.includes(
        `<td>${physical}</td><td>${reserved}</td><td>${available}</td>`,
      ),
      `API quantities not rendered for ${status}`,
    );
    assert.ok(row.includes(`>${status.toLowerCase()}</span>`));
    if (status === "ACTIVE")
      assert.ok(row.includes(formatDate(order.inventory.items[0].expires_at)));
    else
      assert.ok(
        row.includes("<td>—</td>"),
        "Terminal states must not show an active countdown",
      );
    assert.ok(
      !markup.includes("Allocate &amp; reserve"),
      "Existing holds must not expose allocation again",
    );
    console.log(
      `PASS: persisted ${mysql ? "MySQL resource" : "SQLite API"} ${status} response renders warehouse, SKU, ${physical}/${reserved}/${available}, state and expiry correctly.`,
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
