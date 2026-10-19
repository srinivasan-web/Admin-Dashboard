// Real Laravel + React + Chrome, isolated SQLite records created through application actions.
// node tests/inventoryFlow.browser.mjs [path-to-php]
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const admin = fileURLToPath(new URL("..", import.meta.url));
const backend = path.resolve(admin, "../Admin-Backend");
const php = process.argv[2] ?? "php";
const temporary = mkdtempSync(
  path.join(tmpdir(), "durafit-inventory-browser-"),
);
const database = path.join(temporary, "browser.sqlite");
const password = randomBytes(20).toString("hex");
const env = {
  ...process.env,
  APP_ENV: "testing",
  APP_DEBUG: "false",
  APP_KEY: `base64:${randomBytes(32).toString("base64")}`,
  DB_CONNECTION: "sqlite",
  DB_DATABASE: database,
  DB_URL: "",
  SESSION_DRIVER: "database",
  SESSION_DOMAIN: "127.0.0.1",
  SESSION_COOKIE: "durafit_inventory_browser",
  SESSION_PATH: "/",
  SESSION_SECURE_COOKIE: "false",
  SESSION_SAME_SITE: "lax",
  CACHE_STORE: "array",
  BCRYPT_ROUNDS: "4",
  LOG_CHANNEL: "stderr",
  INVENTORY_RESERVATION_TTL_MINUTES: "30",
};
const children = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const phpString = (value) =>
  "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
const bootstrap = `require ${phpString(path.join(backend, "vendor/autoload.php"))}; $app = require ${phpString(path.join(backend, "bootstrap/app.php"))};`;
let socket;
let evaluate;
let stage = "setup";
function runPhp(args) {
  const result = spawnSync(php, args, {
    cwd: backend,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
function launch(command, args, cwd, environment = env) {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    stdio: "pipe",
    windowsHide: true,
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  children.push(child);
}
async function until(check, label) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {}
    await pause(100);
  }
  throw new Error(`Timed out: ${label}`);
}
try {
  for (const port of [18093, 15193, 19393]) {
    let occupied = false;
    try {
      await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(1500),
      });
      occupied = true;
    } catch {}
    assert.equal(occupied, false, `Port ${port} is occupied`);
  }
  writeFileSync(database, "");
  runPhp(["artisan", "migrate", "--force", "--no-interaction"]);
  const fixture = JSON.parse(
    runPhp([
      "-r",
      bootstrap +
        String.raw`
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ` +
        phpString(database) +
        String.raw`) throw new RuntimeException('Fixture database isolation failed');
    $user = App\Models\User::factory()->create(['name' => 'Inventory browser', 'email' => 'inventory-browser@example.test', 'password' => ` +
        phpString(password) +
        String.raw`]);
    $role = App\Models\Role::factory()->create();
    foreach (['orders.view', 'orders.manage', 'inventory.manage'] as $permission) $role->permissions()->attach(App\Models\Permission::factory()->create(['name' => $permission]));
    $user->roles()->attach($role);
    $warehouse = App\Models\Warehouse::factory()->create(['name' => 'Browser warehouse']);
    $orders = [];
    foreach (['PAYMENT', 'EXPIRY'] as $scenario) {
      $product = App\Models\Product::factory()->create(['name' => 'Browser '.$scenario, 'sku' => 'BROWSER-'.$scenario]);
      app(App\Actions\SetWarehouseStock::class)->execute($warehouse, $product, 20);
      $address = ['name' => 'Browser customer', 'address' => 'Test address'];
      $order = app(App\Actions\CreateOrder::class)->execute(App\Models\Customer::factory()->create(), 'BROWSER-'.$scenario, [['product' => $product, 'quantity' => 2, 'unit_price' => '100.00']], $address, $address);
      $payment = $order->payments()->create(['provider' => 'test', 'provider_transaction_reference' => 'BROWSER-'.$scenario, 'amount' => '200.00', 'currency' => 'INR', 'status' => 'authorized']);
      $orders[$scenario] = ['id' => $order->id, 'payment' => $payment->id];
    }
    echo json_encode(['orders' => $orders, 'warehouse' => $warehouse->id]);
  `,
    ]),
  );
  const router = path.join(temporary, "router.php");
  writeFileSync(
    router,
    "<?php " +
      bootstrap +
      String.raw`
    $app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();
    if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ` +
      phpString(database) +
      String.raw`) { http_response_code(503); exit('Isolation failed'); }
    if ($_SERVER['REQUEST_URI'] === '/__isolation') { header('Content-Type: application/json'); echo json_encode(['isolated' => true]); exit; }
    $app->handleRequest(Illuminate\Http\Request::capture());
  `,
  );
  const vite = path.join(temporary, "vite.config.mjs");
  writeFileSync(
    vite,
    `import config from ${JSON.stringify(path.join(admin, "vite.config.ts").replaceAll("\\", "/"))}; export default {...config,server:{...config.server,proxy:{'/api':'http://127.0.0.1:18093'}}};`,
  );
  launch(
    php,
    ["-d", "variables_order=EGPCS", "-S", "127.0.0.1:18093", router],
    path.join(backend, "public"),
  );
  await until(
    async () =>
      (await (await fetch("http://127.0.0.1:18093/__isolation")).json())
        .isolated === true,
    "HTTP isolation",
  );
  launch(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      vite,
      "--host=127.0.0.1",
      "--port=15193",
      "--strictPort",
    ],
    admin,
  );
  await until(async () => (await fetch("http://127.0.0.1:15193")).ok, "Vite");
  launch(
    process.env.CHROME_BINARY ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=19393",
      `--user-data-dir=${path.join(temporary, "chrome")}`,
      "about:blank",
    ],
    admin,
  );
  let target;
  await until(async () => {
    target = (await (await fetch("http://127.0.0.1:19393/json")).json()).find(
      (item) => item.type === "page",
    );
    return target;
  }, "Chrome");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const commands = new Map();
  const requests = [];
  const errors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const callback = commands.get(message.id);
      commands.delete(message.id);
      if (message.error) callback.reject(new Error(message.error.message));
      else callback.resolve(message.result);
    }
    if (
      message.method === "Network.requestWillBeSent" &&
      message.params.request.url.includes("/api/v1/admin/orders/")
    )
      requests.push({
        path: new URL(message.params.request.url).pathname,
        method: message.params.request.method,
      });
    if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails.text);
    if (message.method === "Page.javascriptDialogOpening")
      void send("Page.handleJavaScriptDialog", { accept: true });
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      commands.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:15193" });
  stage = "login";
  await until(
    () => evaluate("document.querySelector('input[type=password]') !== null"),
    "login form",
  );
  await evaluate(
    `(() => { for (const [selector, value] of ${JSON.stringify([
      ["input[type=email]", "inventory-browser@example.test"],
      ["input[type=password]", password],
    ])}) {const input=document.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true}));} })()`,
  );
  await evaluate(
    "document.querySelector('input[type=password]').closest('form').requestSubmit()",
  );
  await until(
    () =>
      evaluate(
        "document.body.innerText.includes('inventory-browser@example.test')",
      ),
    "authenticated Admin",
  );
  assert.equal(
    await evaluate(
      "fetch('/api/v1/admin/auth/me',{credentials:'include',headers:{Accept:'application/json'}}).then(r=>r.status)",
    ),
    200,
  );
  async function navigate(id) {
    const scenario = Object.entries(fixture.orders).find(
      ([, order]) => order.id === id,
    )[0];
    await evaluate(
      `history.pushState({},'', '/sales/orders/${id}');window.dispatchEvent(new PopStateEvent('popstate'));`,
    );
    await until(
      () =>
        evaluate(
          `document.body.innerText.includes('Inventory allocation') && document.body.innerText.includes('BROWSER-${scenario}')`,
        ),
      "order detail",
    );
  }
  async function allocate() {
    await evaluate(
      `(() => {const select=document.querySelector('[aria-label="Manually choose warehouse"]'); select.value=${JSON.stringify(fixture.warehouse)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await evaluate(
      "[...document.querySelectorAll('button')].find(b=>b.textContent==='Allocate & reserve').click()",
    );
    await until(
      () =>
        evaluate(
          "document.body.innerText.includes('Warehouse allocated and stock reserved.')",
        ),
      "allocate and reserve",
    );
  }
  async function persisted(id) {
    return evaluate(
      `fetch('/api/v1/admin/orders/${id}',{credentials:'include',headers:{Accept:'application/json'}}).then(r=>r.json()).then(r=>r.data)`,
    );
  }
  async function assertInventory(id, status, quantities) {
    const order = await persisted(id);
    const row = order.inventory.items[0];
    assert.equal(row.reservation_status, status);
    assert.deepEqual([row.physical, row.reserved, row.available], quantities);
    const rendered = await evaluate(
      "[...document.querySelectorAll('section')].find(s=>s.querySelector('h2')?.textContent==='Inventory allocation')?.innerText",
    );
    assert.ok(rendered.toLowerCase().includes(status.toLowerCase()));
    assert.ok(rendered.includes("Browser warehouse"));
    if (status === "ACTIVE") {
      assert.ok(row.expires_at);
      assert.ok(rendered.toLowerCase().includes("expires at"));
    }
  }
  stage = "allocation/reservation";
  await navigate(fixture.orders.PAYMENT.id);
  await allocate();
  await assertInventory(fixture.orders.PAYMENT.id, "ACTIVE", [20, 2, 18]);
  const writes = requests.filter((r) => r.method !== "GET");
  assert.deepEqual(
    writes.map((r) => r.path.split("/").at(-1)),
    ["warehouse", "reserve"],
  );
  stage = "payment";
  // Use the actual payment form in Order Detail.
  await evaluate(
    "(() => { const select=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='paid'));select.value='paid';select.dispatchEvent(new Event('change',{bubbles:true}));})()",
  );
  await until(
    () =>
      evaluate(
        "document.body.innerText.includes('Payment status updated to paid.')",
      ),
    "payment commit",
  );
  await assertInventory(fixture.orders.PAYMENT.id, "COMMITTED", [18, 0, 18]);
  stage = "expiry";
  await navigate(fixture.orders.EXPIRY.id);
  await allocate();
  await assertInventory(fixture.orders.EXPIRY.id, "ACTIVE", [20, 2, 18]);
  runPhp([
    "-r",
    bootstrap +
      String.raw`
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    if (config('database.connections.sqlite.database') !== ` +
      phpString(database) +
      String.raw`) throw new RuntimeException('Isolation failed');
    $reservation=App\Models\StockReservation::query()->where('order_id', ` +
      phpString(fixture.orders.EXPIRY.id) +
      String.raw`)->sole();
    Illuminate\Support\Carbon::setTestNow($reservation->expires_at);
    if (Illuminate\Support\Facades\Artisan::call('inventory:expire-reservations') !== 0) throw new RuntimeException('Expiry command failed');
    if (Illuminate\Support\Facades\Artisan::call('inventory:expire-reservations') !== 0) throw new RuntimeException('Expiry retry failed');
    if (App\Models\StockMovement::query()->where('order_id',$reservation->order_id)->where('movement_type','RELEASE')->count() !== 1) throw new RuntimeException('Duplicate release');
  `,
  ]);
  await send("Page.reload");
  await until(
    () =>
      evaluate(
        "document.body.innerText.toLowerCase().includes('reservation expired')",
      ),
    "persisted expiry after reload",
  );
  await assertInventory(fixture.orders.EXPIRY.id, "EXPIRED", [20, 0, 20]);
  stage = "warehouse stock";
  await evaluate(
    "history.pushState({},'', '/warehouse-stock');window.dispatchEvent(new PopStateEvent('popstate'));",
  );
  await until(
    () =>
      evaluate(
        "[...document.querySelectorAll('tbody')].some(body=>body.innerText.includes('BROWSER-EXPIRY'))",
      ),
    "warehouse stock balances",
  );
  const cells = await evaluate(
    "[...document.querySelectorAll('tbody tr')].filter(r=>r.innerText.includes('BROWSER-')).map(r=>[...r.querySelectorAll('td')].map(c=>c.innerText))",
  );
  assert.deepEqual(
    cells.find((r) => r.includes("BROWSER-EXPIRY")).slice(3, 6),
    ["20", "0", "20"],
  );
  assert.deepEqual(
    cells.find((r) => r.includes("BROWSER-PAYMENT")).slice(3, 6),
    ["18", "0", "18"],
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real browser login -> allocate + immediate reserve -> payment/commit -> expiry command/retry -> reload -> exact order and warehouse balances; no browser exceptions.",
  );
} catch (error) {
  console.error(`Browser verification failed during ${stage}.`);
  if (evaluate) {
    console.error(
      await evaluate(
        "JSON.stringify({path:location.pathname,text:document.body.innerText.slice(0,1200)})",
      ).catch(() => "Browser disconnected"),
    );
    console.error(
      await evaluate(
        "fetch('/api/v1/admin/auth/me',{credentials:'include',headers:{Accept:'application/json'}}).then(r=>JSON.stringify({sessionStatus:r.status}))",
      ).catch(() => "Session probe unavailable"),
    );
  }
  throw error;
} finally {
  socket?.close();
  for (const child of children.reverse())
    if (child.pid) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else child.kill("SIGTERM");
    }
  await pause(500);
  try {
    rmSync(temporary, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
  } catch {
    console.warn(`Temporary browser files remain locked: ${temporary}`);
  }
}
