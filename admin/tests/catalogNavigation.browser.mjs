// Runs real Laravel/Vite/Chrome against a disposable SQLite database.
// Usage on Windows: node tests/catalogNavigation.browser.mjs [path-to-php.exe]
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const admin = fileURLToPath(new URL("..", import.meta.url));
const backend = path.resolve(admin, "../Admin-Backend");
const php = process.argv[2] ?? process.env.PHP_BINARY ?? "php";
const chrome =
  process.env.CHROME_BINARY ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const temporary = mkdtempSync(path.join(tmpdir(), "durafit-catalog-network-"));
const database = path.join(temporary, "catalog.sqlite");
const mediaRoot = path.join(temporary, "public-media");
mkdirSync(mediaRoot);
writeFileSync(database, "");
const viteConfig = path.join(temporary, "vite.config.mjs");
writeFileSync(
  viteConfig,
  `import config from ${JSON.stringify(path.join(admin, "vite.config.ts").replaceAll("\\", "/"))};\nexport default {...config, server: {...config.server, proxy: {'/api': 'http://127.0.0.1:18091'}}};`,
);
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
  SESSION_COOKIE: "durafit_navigation_test",
  SESSION_PATH: "/",
  SESSION_SAME_SITE: "lax",
  SESSION_SECURE_COOKIE: "false",
  CACHE_STORE: "array",
  BCRYPT_ROUNDS: "4",
  LOG_CHANNEL: "stderr",
};
const children = [];
let socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = [];
const descriptionCheckComplete = Symbol("description check complete");
// Refuse every HTTP request unless Laravel resolves the disposable database.
const router = path.join(temporary, "guarded-router.php");
const phpLiteral = (value) =>
  "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
writeFileSync(
  router,
  `<?php
require ${phpLiteral(path.join(backend, "vendor/autoload.php"))};
$app = require ${phpLiteral(path.join(backend, "bootstrap/app.php"))};
$app->make(Illuminate\\Contracts\\Http\\Kernel::class)->bootstrap();
if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ${phpLiteral(database)}) { http_response_code(503); exit('Test database isolation failed'); }
config(['filesystems.disks.public.root' => ${phpLiteral(mediaRoot)}, 'filesystems.disks.public.url' => '/storage']);
if (str_starts_with($_SERVER['REQUEST_URI'], '/storage/')) {
  $relative = rawurldecode(substr(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), strlen('/storage/')));
  $file = realpath(${phpLiteral(mediaRoot)} . DIRECTORY_SEPARATOR . str_replace(['/', '\\\\'], DIRECTORY_SEPARATOR, $relative));
  $root = realpath(${phpLiteral(mediaRoot)}) . DIRECTORY_SEPARATOR;
  if (!$file || !str_starts_with($file, $root) || !is_file($file)) { http_response_code(404); exit; }
  header('Content-Type: ' . mime_content_type($file)); readfile($file); exit;
}
if ($_SERVER['REQUEST_URI'] === '/__test-isolation') { header('Content-Type: application/json'); echo json_encode(['isolated' => true, 'users' => App\\Models\\User::count()]); exit; }
$app->handleRequest(Illuminate\\Http\\Request::capture());
`,
);

function launch(command, args, cwd, environment = env) {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    windowsHide: true,
    stdio: "pipe",
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  children.push(child);
  return child;
}
async function startStorefront() {
  const storefront = path.resolve(admin, "../storefront");
  const configPath = path.join(temporary, "storefront.config.mjs");
  writeFileSync(
    configPath,
    "import config from " +
      JSON.stringify(
        path.join(storefront, "vite.config.ts").replaceAll("\\", "/"),
      ) +
      ";export default {...config,server:{proxy:{'/api':'http://127.0.0.1:18091','/storage':'http://127.0.0.1:18091'}}};",
  );
  launch(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      configPath,
      "--host=127.0.0.1",
      "--port=15193",
      "--strictPort",
    ],
    storefront,
  );
  await waitFor(
    async () => (await fetch("http://127.0.0.1:15193")).ok,
    "Storefront startup",
  );
}
async function waitFor(check, description) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      /* startup */
    }
    await pause(100);
  }
  throw new Error(`Timed out: ${description}`);
}
function artisan(args) {
  const result = spawnSync(php, ["artisan", ...args], {
    cwd: backend,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

try {
  // Never attach this verification to a developer's running servers/database.
  for (const port of [18091, 15191, 15193, 19391]) {
    let occupied = false;
    try {
      await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(500),
      });
      occupied = true;
    } catch {}
    assert.equal(
      occupied,
      false,
      `Port ${port} is already occupied; stop this test and choose an isolated environment.`,
    );
  }
  artisan(["migrate", "--force", "--no-interaction"]);
  artisan([
    "db:seed",
    "--class=RolesAndPermissionsSeeder",
    "--force",
    "--no-interaction",
  ]);
  const isolation = spawnSync(
    php,
    [
      "-r",
      "require 'vendor/autoload.php'; $app = require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); echo json_encode([config('database.default'), config('database.connections.sqlite.database'), App\\Models\\User::count()]);",
    ],
    { cwd: backend, env, encoding: "utf8" },
  );
  assert.equal(isolation.status, 0, isolation.stderr);
  assert.deepEqual(
    JSON.parse(isolation.stdout),
    ["sqlite", database, 0],
    "Test database isolation",
  );
  launch(
    php,
    [
      "-d",
      "variables_order=EGPCS",
      "-d",
      "opcache.enable_cli=1",
      "-d",
      "opcache.validate_timestamps=1",
      "-d",
      "opcache.revalidate_freq=0",
      "-S",
      "127.0.0.1:18091",
      router,
    ],
    path.join(backend, "public"),
  );
  launch(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      viteConfig,
      "--host=127.0.0.1",
      "--port=15191",
      "--strictPort",
    ],
    admin,
    { ...process.env, NODE_OPTIONS: "--dns-result-order=ipv4first" },
  );
  await waitFor(
    async () => (await fetch("http://127.0.0.1:18091")).ok,
    "Laravel startup",
  );
  const httpIsolation = await (
    await fetch("http://127.0.0.1:18091/__test-isolation")
  ).json();
  assert.deepEqual(httpIsolation, { isolated: true, users: 0 });
  if (process.argv.includes("--isolation-only")) {
    console.log(
      "HTTP and CLI both verified against the empty disposable SQLite database; no registration POST performed.",
    );
  } else {
    await waitFor(
      async () => (await fetch("http://127.0.0.1:15191")).ok,
      "Vite startup",
    );
    launch(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-port=19391",
        `--user-data-dir=${path.join(temporary, "chrome")}`,
        "about:blank",
      ],
      admin,
    );
    let target;
    await waitFor(async () => {
      target = (await (await fetch("http://127.0.0.1:19391/json")).json()).find(
        (item) => item.type === "page",
      );
      return target;
    }, "Chrome startup");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    let commandId = 0;
    const pending = new Map();
    const requests = new Map();
    const exceptions = [];
    let acceptExpectedUnload = false;
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const callback = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) callback?.reject(new Error(message.error.message));
        else callback?.resolve(message.result);
      }
      const value = message.params;
      if (
        message.method === "Page.javascriptDialogOpening" &&
        value.type === "beforeunload" &&
        acceptExpectedUnload
      ) {
        acceptExpectedUnload = false;
        void send("Page.handleJavaScriptDialog", { accept: true });
      }
      if (message.method === "Runtime.exceptionThrown")
        exceptions.push(value.exceptionDetails.text);
      if (
        message.method === "Runtime.consoleAPICalled" &&
        value.type === "error"
      )
        for (const argument of value.args ?? [])
          if (argument.subtype === "error")
            exceptions.push(argument.description);
      if (message.method === "Network.requestWillBeSent") {
        const url = new URL(value.request.url);
        if (
          url.pathname.startsWith("/api/v1/admin/") &&
          !url.pathname.includes("/auth/")
        ) {
          requests.set(value.requestId, {
            path: url.pathname.replace("/api/v1/admin", "") + url.search,
            started: value.timestamp,
            method: value.request.method,
          });
        }
      }
      const request = requests.get(value?.requestId);
      if (request && message.method === "Network.responseReceived")
        request.status = value.response.status;
      if (request && message.method === "Network.loadingFinished")
        request.ms = Math.round((value.timestamp - request.started) * 1000);
      if (request && message.method === "Network.loadingFailed")
        request.failed = value.errorText;
    });
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++commandId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
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
    }
    async function verifyDescriptionRibbon() {
      // Exercise actual ribbon controls and paste handling before product persistence.
      await evaluate(
        "document.querySelector('#product-description-editor').editor.commands.setTextSelection({from:1,to:5})",
      );
      await evaluate(
        "document.querySelector('.description-ribbon button[aria-label=\"Bold (Ctrl+B)\"]').click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('input[name=description]').value.includes('<strong>Safe')",
          ),
        "bold selection through ribbon",
      );
      await evaluate(
        "document.querySelector('.description-ribbon button[aria-label=\"Italic (Ctrl+I)\"]').click()",
      );
      await evaluate(
        "document.querySelector('.description-ribbon button[aria-label=\"Underline (Ctrl+U)\"]').click()",
      );
      assert.match(
        await evaluate(
          "document.querySelector('input[name=description]').value",
        ),
        /<em>|<u>/,
      );
      await evaluate(
        "document.querySelector('.description-ribbon button[aria-label=\"Undo (Ctrl+Z)\"]').click()",
      );
      await evaluate(
        "document.querySelector('.description-ribbon button[aria-label=\"Redo (Ctrl+Shift+Z)\"]').click()",
      );
      await evaluate(
        `(() => { const select = document.querySelector('select[aria-label="Paragraph style"]'); select.value='h2';select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('input[name=description]').value.startsWith('<h2>')",
          ),
        "heading style",
      );
      await evaluate(
        `(() => { const select = document.querySelector('select[aria-label="Paragraph style"]'); select.value='p';select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
      );
      await evaluate(
        `(() => {const editor=document.querySelector('#product-description-editor').editor;editor.commands.focus('end');editor.commands.insertContent('<p>Learn more</p>');const end=editor.state.doc.content.size-1;editor.commands.setTextSelection({from:end-10,to:end});})()`,
      );
      await evaluate(
        "document.querySelector('.description-ribbon button[aria-label=\"Add or edit link (Ctrl+K)\"]').click()",
      );
      await waitFor(
        () =>
          evaluate("Boolean(document.querySelector('#description-link-url'))"),
        "link editing panel",
      );
      await evaluate(
        `(() => {const input=document.querySelector('#description-link-url');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'javascript:alert(1)');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await evaluate(
        "[...document.querySelectorAll('.description-link-panel button')].find(button=>button.textContent.includes('Apply link')).click()",
      );
      await waitFor(
        () =>
          evaluate(
            "Boolean(document.querySelector('#description-link-error'))",
          ),
        "unsafe link rejected inline",
      );
      await evaluate(
        `(() => {const input=document.querySelector('#description-link-url');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://example.com/product');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await evaluate(
        "[...document.querySelectorAll('.description-link-panel button')].find(button=>button.textContent.includes('Apply link')).click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('input[name=description]').value.includes('https://example.com/product')",
          ),
        "safe link inserted",
      );
      await evaluate(
        `(() => {const node=document.querySelector('#product-description-editor');node.editor.commands.focus('end');const data=new DataTransfer();data.setData('text/html','<p onclick="alert(1)">தமிழ் <strong>Fitness</strong></p><script>alert(1)</script>');data.setData('text/plain','தமிழ் Fitness');node.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));})()`,
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('input[name=description]').value.includes('தமிழ்')",
          ),
        "multilingual paste cleaned",
      );
      const descriptionBeforeView = await evaluate(
        "document.querySelector('input[name=description]').value",
      );
      assert.doesNotMatch(
        descriptionBeforeView,
        /onclick|<script|<img|javascript:/i,
      );
      await evaluate(
        "document.querySelector('#description-tab-Format').focus()",
      );
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "ArrowLeft",
        code: "ArrowLeft",
      });
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#description-tab-Insert').getAttribute('aria-selected')==='true'",
          ),
        "ribbon keyboard navigation",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('button[aria-label=\"Tables unavailable\"]').disabled",
        ),
        true,
      );
      await evaluate(
        "document.querySelector('#description-tab-Format').click()",
      );
      await evaluate(
        `(() => {const select=document.querySelector('select[aria-label="Canvas font"]');select.value='Georgia, serif';select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('input[name=description]').value",
        ),
        descriptionBeforeView,
      );
      await evaluate("document.querySelector('#description-tab-Home').click()");
      report.push({
        route: "/products/create · Description",
        action:
          "ribbon formatting, undo/redo, paragraph styles, safe link validation, cleaned multilingual paste, keyboard tabs and view-only font",
        status: "passed",
      });
    }
    await send("Network.enable");
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.navigate", { url: "http://127.0.0.1:15191" });
    if (process.argv.includes("--product-detail-only")) {
      const { verifyProductDetail } = await import("../../storefront/tests/productDetail.browser.mjs");
      const seedPresentation = ({ id, attributeId }) => {
        const code = `require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ${phpLiteral(database)}) { throw new RuntimeException('Test database isolation failed'); }
Illuminate\\Support\\Facades\\DB::transaction(function () {
    $product = App\\Models\\Product::query()->findOrFail(${phpLiteral(id)});
    $product->category->specifications()->create(['attribute_id' => ${phpLiteral(attributeId)}, 'label' => 'Motor output', 'is_active' => true, 'is_comparable' => true]);
    $product->benefits()->create(['title' => 'Synthetic warranty benefit', 'description' => 'Isolated test terms only.', 'benefit_type' => 'warranty', 'is_active' => true]);
    $product->benefits()->create(['title' => 'Unpublished test benefit', 'benefit_type' => 'information', 'is_active' => false]);
    App\\Models\\CategoryFaq::query()->create(['category_id' => $product->category_id, 'question' => 'How do I care for this synthetic product?', 'answer' => 'Use the stored test manual.', 'sort_order' => 1, 'is_active' => true]);
    App\\Models\\CategoryFaq::query()->create(['category_id' => $product->category_id, 'question' => 'Unpublished test question?', 'answer' => 'Not public', 'is_active' => false]);
    App\\Models\\ShopBenefit::query()->create(['title' => 'Verified test shopping information', 'description' => 'Stored fixture statement only.', 'sort_order' => 0, 'is_active' => true]);
    App\\Models\\ShopBenefit::query()->create(['title' => 'Unpublished shopping claim', 'is_active' => false]);
});`;
        const result = spawnSync(php, ["-r", code], { cwd: backend, env, encoding: "utf8", windowsHide: true });
        assert.equal(result.status, 0, result.stderr || result.stdout);
      };
      await verifyProductDetail({ send, evaluate, waitFor, pause, startStorefront, exceptions, seedPresentation });
      throw descriptionCheckComplete;
    }
    if (process.argv.includes("--need-selector-only")) {
      const { verifyNeedSelector } =
        await import("../../storefront/tests/needSelector.browser.mjs");
      await verifyNeedSelector({
        send,
        evaluate,
        waitFor,
        pause,
        startStorefront,
        exceptions,
      });
      throw descriptionCheckComplete;
    }
    if (process.argv.includes("--product-type-only")) {
      await waitFor(
        () => evaluate("Boolean(document.querySelector('input[type=password]'))"),
        "product type test login page",
      );
      const password = randomBytes(20).toString("hex");
      const fixture = await evaluate(`(async()=>{
        const {registerInitialAdmin}=await import('/src/api/adminAuth.ts');
        const {apiRequest,apiFormRequest}=await import('/src/api/client.ts');
        await registerInitialAdmin({name:'Product Type Verification',email:'product-type@example.test',password:${JSON.stringify(password)},password_confirmation:${JSON.stringify(password)}});
        const canvas=document.createElement('canvas');canvas.width=120;canvas.height=120;canvas.getContext('2d').fillRect(0,0,120,120);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        const body=new FormData();body.set('image',new File([blob],'product-type.png',{type:'image/png'}));
        const media=(await apiFormRequest('/media',body)).data;
        const first=(await apiRequest('/product-types','POST',{name:'Treadmills',slug:'treadmills',image_media_id:media.id,sort_order:1,is_active:true})).data;
        await apiRequest('/product-types','POST',{name:'Walkpads',slug:'walkpads',image_media_id:media.id,sort_order:3,is_active:true});
        return {id:first.id,mediaId:media.id};
      })()`);
      await send("Page.navigate", { url: `http://127.0.0.1:15191/product-types/${fixture.id}/edit` });
      await waitFor(
        () => evaluate("document.querySelector('#product-type-sort-order')?.value==='1'"),
        "saved Admin product type order",
      );
      await startStorefront();
      await send("Page.navigate", { url: "http://127.0.0.1:15193/" });
      await waitFor(
        () => evaluate("document.querySelector('#categories [data-testid=\"product-type-card\"]')?.textContent.includes('Treadmills')"),
        "real product type on storefront home",
      );
      assert.deepEqual(
        await evaluate("[...document.querySelectorAll('#categories [data-testid=\"product-type-card\"]')].map(card=>card.textContent.includes('Treadmills')?'Treadmills':'Walkpads')"),
        ["Treadmills", "Walkpads"],
      );
      await evaluate("document.querySelector('#categories [data-testid=\"product-type-card\"]').scrollIntoView({block:'center'})");
      await waitFor(
        () => evaluate("document.querySelector('#categories [data-testid=\"product-type-card\"] img')?.naturalWidth>0"),
        "visible product type image loaded",
      );
      await evaluate("document.querySelector('#categories [data-testid=\"product-type-card\"]').click()");
      await waitFor(
        () => evaluate("location.pathname==='/products' && new URLSearchParams(location.search).has('product_type_id')"),
        "product type card opens filtered product list",
      );
      assert.equal(await evaluate("new URLSearchParams(location.search).get('product_type_id')"), fixture.id);
      assert.deepEqual(exceptions, []);
      console.log("Admin product type → Laravel → public product types → storefront card/navigation passed (isolated SQLite)");
      throw descriptionCheckComplete;
    }
    if (process.argv.includes("--banner-only")) {
      await waitFor(
        () =>
          evaluate("Boolean(document.querySelector('input[type=password]'))"),
        "banner test login page",
      );
      const password = randomBytes(20).toString("hex");
      const fixture = await evaluate(`(async()=>{
        const {registerInitialAdmin}=await import('/src/api/adminAuth.ts');const {apiRequest,apiFormRequest}=await import('/src/api/client.ts');
        await registerInitialAdmin({name:'Banner Verification',email:'banner@example.test',password:${JSON.stringify(password)},password_confirmation:${JSON.stringify(password)}});
        const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=500;canvas.getContext('2d').fillRect(0,0,1200,500);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const body=new FormData();body.set('image',new File([blob],'campaign.png',{type:'image/png'}));
        const media=(await apiFormRequest('/media',body)).data;
        const base={desktop_media_id:media.id,mobile_media_id:media.id,page:'landing',is_active:true,redirect_url:'http://127.0.0.1:15193/products'};
        const {createBanner}=await import('/src/features/banners/bannersApi.ts');
        const first=(await createBanner({...base,title:'Live Campaign',description:'Admin-managed campaign',cta_text:'Explore equipment',sort_order:1})).data;
        const second=(await createBanner({...base,title:'Second Campaign',cta_text:'Shop now',sort_order:2})).data;
        return {first:first.id,second:second.id};
      })()`);
      await send("Page.navigate", {
        url: `http://127.0.0.1:15191/banners/${fixture.first}/edit`,
      });
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#banner-cta-text')?.value==='Explore equipment'",
          ),
        "real banner edit form",
      );
      await startStorefront();
      const target = await send("Target.createTarget", {
        url: "http://127.0.0.1:15193/",
      });
      let frontTarget;
      await waitFor(async () => {
        frontTarget = (
          await (await fetch("http://127.0.0.1:19391/json")).json()
        ).find((item) => item.id === target.targetId);
        return frontTarget;
      }, "storefront browser target");
      const frontSocket = new WebSocket(frontTarget.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        frontSocket.addEventListener("open", resolve, { once: true });
        frontSocket.addEventListener("error", reject, { once: true });
      });
      let id = 0;
      const pending = new Map();
      const bannerRequests = new Map();
      const browserErrors = [];
      function frontSend(method, params = {}) {
        return new Promise((resolve, reject) => {
          const key = ++id;
          pending.set(key, { resolve, reject });
          frontSocket.send(JSON.stringify({ id: key, method, params }));
        });
      }
      frontSocket.addEventListener("message", ({ data }) => {
        const message = JSON.parse(data);
        if (message.id) {
          const callback = pending.get(message.id);
          pending.delete(message.id);
          message.error
            ? callback?.reject(new Error(message.error.message))
            : callback?.resolve(message.result);
        }
        const value = message.params;
        if (message.method === "Runtime.exceptionThrown")
          browserErrors.push(value.exceptionDetails.text);
        if (
          message.method === "Network.requestWillBeSent" &&
          new URL(value.request.url).pathname === "/api/v1/banners/active"
        )
          bannerRequests.set(value.requestId, {
            headers: value.request.headers,
          });
        if (
          message.method === "Network.responseReceived" &&
          bannerRequests.has(value.requestId)
        )
          bannerRequests.get(value.requestId).status = value.response.status;
      });
      async function frontEvaluate(expression) {
        const result = await frontSend("Runtime.evaluate", {
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
      }
      await frontSend("Runtime.enable");
      await frontSend("Network.enable");
      await frontSend("Page.enable");
      await frontSend("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
      });
      await frontSend("Page.bringToFront");
      await waitFor(
        () =>
          frontEvaluate(
            "document.querySelector('.hero-slide:not([aria-hidden=true]) h1')?.textContent==='Live Campaign'",
          ),
        "initial storefront campaign",
      );
      await waitFor(
        () =>
          frontEvaluate(
            "Boolean(document.querySelector('button[aria-label=\"Pause carousel\"]'))",
          ),
        "carousel play controls",
      ).catch(async (error) => {
        throw new Error(
          error.message +
            ": " +
            JSON.stringify(
              await frontEvaluate(
                "({motion:matchMedia('(prefers-reduced-motion: reduce)').matches,html:document.querySelector('.hero-carousel')?.innerHTML,api:await(await fetch('/api/v1/banners/active')).json()})",
              ),
            ),
        );
      });
      await frontEvaluate(
        "document.querySelector('button[aria-label=\"Pause carousel\"]').click()",
      );
      await frontEvaluate(
        "document.querySelector('button[aria-label=\"Next banner\"]').click()",
      );
      assert.equal(
        await frontEvaluate(
          "document.querySelector('.hero-slide[aria-hidden=true]')?.inert",
        ),
        true,
      );
      await waitFor(
        () =>
          frontEvaluate(
            "document.querySelector('.hero-slide:not([aria-hidden=true]) h1')?.textContent==='Second Campaign'",
          ),
        "animated next banner",
      );
      await frontEvaluate(
        "document.querySelector('button[aria-label=\"Previous banner\"]').click()",
      );
      await waitFor(
        () =>
          frontEvaluate(
            "document.querySelector('.hero-slide:not([aria-hidden=true]) h1')?.textContent==='Live Campaign'",
          ),
        "animated previous banner",
      );
      await send("Page.bringToFront");
      await evaluate(
        "document.querySelector('#banner-cta-text').focus();document.querySelector('#banner-cta-text').select()",
      );
      await send("Input.insertText", { text: "Discover performance" });
      await evaluate("document.querySelector('form').requestSubmit()");
      await waitFor(
        () => evaluate("location.pathname==='/banners'"),
        "admin banner text saved",
      );
      await frontSend("Page.bringToFront");
      await waitFor(
        () =>
          frontEvaluate(
            "document.querySelector('.hero-slide:not([aria-hidden=true]) .hero-slide-cta')?.textContent.includes('Discover performance')",
          ),
        "saved Button Text refreshed without page reload",
      );
      await evaluate(
        `import('/src/features/banners/bannersApi.ts').then(({updateBanner})=>updateBanner(${JSON.stringify(fixture.first)},{cta_text:'Remote campaign update'}))`,
      );
      await waitFor(
        () =>
          frontEvaluate(
            "document.querySelector('.hero-slide:not([aria-hidden=true]) .hero-slide-cta')?.textContent.includes('Remote campaign update')",
          ),
        "cross-origin visible polling update",
      );
      const count = bannerRequests.size;
      await frontEvaluate("window.dispatchEvent(new Event('focus'))");
      await waitFor(
        () =>
          bannerRequests.size > count &&
          [...bannerRequests.values()]
            .slice(count)
            .some((request) => request.status === 304),
        "unchanged conditional banner response",
      );
      await evaluate(
        `import('/src/features/banners/bannersApi.ts').then(({updateBanner})=>updateBanner(${JSON.stringify(fixture.first)},{cta_text:'Instant same-origin update'}))`,
      );
      const started = Date.now();
      const signalPath =
        "/@fs/" +
        path.resolve(admin, "../shared/bannerUpdates.ts").replaceAll("\\", "/");
      await frontEvaluate(
        `import(${JSON.stringify(signalPath)}).then(({publishBannerUpdate})=>publishBannerUpdate())`,
      );
      await waitFor(
        () =>
          frontEvaluate(
            "document.querySelector('.hero-slide:not([aria-hidden=true]) .hero-slide-cta')?.textContent.includes('Instant same-origin update')",
          ),
        "same-origin banner invalidation signal",
      );
      assert.ok(
        Date.now() - started < 5000,
        "same-origin refresh must not wait for the polling interval",
      );
      await frontSend("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      await waitFor(
        () =>
          frontEvaluate(
            "!document.querySelector('button[aria-label=\"Play carousel\"]') && !document.querySelector('button[aria-label=\"Pause carousel\"]')",
          ),
        "reduced motion stops autoplay",
      );
      await frontSend("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true,
      });
      assert.ok(
        await frontEvaluate(
          "document.querySelector('.hero-carousel').getBoundingClientRect().width<=390",
        ),
      );
      await evaluate(
        `import('/src/features/banners/bannersApi.ts').then(({updateBanner})=>updateBanner(${JSON.stringify(fixture.first)},{is_active:false}))`,
      );
      await frontEvaluate(
        `import(${JSON.stringify(signalPath)}).then(({publishBannerUpdate})=>publishBannerUpdate())`,
      );
      await waitFor(
        () =>
          frontEvaluate(
            "document.querySelector('.hero-slide:not([aria-hidden=true]) h1')?.textContent==='Second Campaign'",
          ),
        "deactivation removes current banner without reload",
      );
      assert.equal(
        await frontEvaluate(
          "document.querySelector('.hero-slide:not([aria-hidden=true]) .hero-slide-cta')?.textContent.trim()",
        ),
        "Shop now",
      );
      assert.deepEqual(browserErrors, []);
      assert.deepEqual(exceptions, []);
      console.log(
        JSON.stringify(
          {
            banners:
              "Admin form Button Text -> saved API -> open storefront; polling, same-origin signal, 304 responses, transitions, reduced motion, mobile and deactivation passed",
            bannerRequests: [...bannerRequests.values()].map(
              (request) => request.status,
            ),
            browserErrors,
          },
          null,
          2,
        ),
      );
      frontSocket.close();
      throw descriptionCheckComplete;
    }
    if (process.argv.includes("--description-only")) {
      await waitFor(
        () => evaluate("document.readyState==='complete'"),
        "description host page",
      );
      await evaluate(`(async()=>{
        const React=await import('/node_modules/.vite/deps/react.js');
        const ReactDOM=await import('/node_modules/.vite/deps/react-dom_client.js');
        const {ProductDescriptionEditor}=await import('/src/features/catalog/ProductDescriptionEditor.tsx');
        document.getElementById('root').style.display='none';
        const host=document.createElement('form');host.id='description-test';document.body.append(host);
        host.style.cssText='max-width:1100px;margin:24px auto;padding:24px';
        (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(host).render((React.createElement ?? React.default.createElement)(ProductDescriptionEditor,{initialValue:'<p>Legacy <strong>description</strong></p>',onEdit:()=>host.dataset.edited='true'}));
      })()`);
      try {
        await waitFor(
          () =>
            evaluate(
              "Boolean(document.querySelector('#product-description-editor')?.editor)",
            ),
          "standalone description editor",
        );
      } catch (error) {
        throw new Error(
          `${error.message}: ${JSON.stringify(await evaluate("({html:document.querySelector('#description-test')?.innerHTML,errors:" + JSON.stringify(exceptions) + "})"))}`,
        );
      }
      assert.equal(
        await evaluate(
          "document.querySelector('input[name=description]').value",
        ),
        "<p>Legacy <strong>description</strong></p>",
      );
      await evaluate(
        "document.querySelector('#product-description-editor').editor.commands.setTextSelection({from:1,to:7})",
      );
      await evaluate(
        "document.querySelector('.description-ribbon button[aria-label=\"Bold (Ctrl+B)\"]').click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('input[name=description]').value.includes('<strong>Legacy')",
          ),
        "standalone bold",
      );
      await send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true,
      });
      assert.ok(
        await evaluate(
          "document.querySelector('.description-editor-shell').getBoundingClientRect().width <= 390",
        ),
      );
      await evaluate(
        "document.querySelector('#product-description-editor').editor.commands.setContent('<p>Safe <strong>description</strong></p>')",
      );
      await verifyDescriptionRibbon();
      const password = randomBytes(20).toString("hex");
      const persisted = await evaluate(`(async()=>{
        const {registerInitialAdmin}=await import('/src/api/adminAuth.ts');
        const {apiRequest}=await import('/src/api/client.ts');
        await registerInitialAdmin({name:'Description Verification',email:'description@example.test',password:${JSON.stringify(password)},password_confirmation:${JSON.stringify(password)}});
        const brand=(await apiRequest('/brands','POST',{name:'Description Brand',slug:'description-brand'})).data;
        const type=(await apiRequest('/product-types','POST',{name:'Description Type',slug:'description-type',is_active:true})).data;
        const category=(await apiRequest('/categories','POST',{name:'Description Category',slug:'description-category',is_active:true})).data;
        const body={name:'Description Product',sku:'DESCRIPTION-TEST',brand_id:brand.id,product_type_id:type.id,category_id:category.id,mrp_price:'100.00',sale_price:null,is_active:true,description:new FormData(document.querySelector('#description-test')).get('description')};
        const created=(await apiRequest('/products','POST',body)).data;
        const warehouse=(await apiRequest('/warehouses','POST',{name:'Description Warehouse',address:'Test address',city:'Trichy',state:'Tamil Nadu',postal_code:'620015'})).data;
        await apiRequest('/warehouses/'+warehouse.id+'/products/'+created.id+'/stock','PUT',{quantity:1});
        const reloaded=(await apiRequest('/products/'+created.id)).data;
        const publicProduct=(await (await fetch('/api/v1/products/'+created.id)).json()).data;
        const updated=(await apiRequest('/products/'+created.id,'PUT',{...body,edit_token:reloaded.edit_token,description:reloaded.description+'<p>Updated description</p>'})).data;
        const afterEdit=(await apiRequest('/products/'+created.id)).data;
        return {entered:body.description,created:created.description,reloaded:reloaded.description,public:publicProduct.description,updated:updated.description,afterEdit:afterEdit.description};
      })()`);
      assert.equal(persisted.created, persisted.entered);
      assert.equal(persisted.reloaded, persisted.created);
      assert.equal(persisted.public, persisted.created);
      assert.equal(persisted.afterEdit, persisted.updated);
      assert.match(persisted.afterEdit, /Updated description/);
      await evaluate(`(async()=>{
        const React=await import('/node_modules/.vite/deps/react.js');const ReactDOM=await import('/node_modules/.vite/deps/react-dom_client.js');
        const {ProductDescriptionEditor}=await import('/src/features/catalog/ProductDescriptionEditor.tsx');
        document.querySelector('#description-test').remove();
        const host=document.createElement('form');host.id='description-reload-test';document.body.append(host);
        (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(host).render((React.createElement ?? React.default.createElement)(ProductDescriptionEditor,{initialValue:${JSON.stringify(persisted.afterEdit)}}));
      })()`);
      await waitFor(
        () =>
          evaluate(
            "Boolean(document.querySelector('#product-description-editor')?.editor)",
          ),
        "persisted description editor reload",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('input[name=description]').value",
        ),
        persisted.afterEdit,
      );
      assert.deepEqual(exceptions, []);
      console.log(
        JSON.stringify(
          {
            descriptionEditor:
              "formatting, links, cleaned multilingual paste, keyboard tabs, mobile layout, real API create/update/reload and public description passed",
            browserErrors: exceptions,
          },
          null,
          2,
        ),
      );
      throw descriptionCheckComplete;
    }
    await waitFor(
      () => evaluate("document.querySelector('input[type=password]') !== null"),
      "login page",
    );
    const credentials = {
      name: "Navigation Verification",
      email: "navigation@example.test",
      password: randomBytes(20).toString("hex"),
    };
    const registered = await evaluate(`(async () => {
    const csrf = await (await fetch('/api/v1/admin/auth/csrf', {credentials:'include',headers:{Accept:'application/json'}})).json();
    const body = ${JSON.stringify(credentials)};
    const response = await fetch('/api/v1/admin/auth/register', {method:'POST',credentials:'include',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf.data.csrf_token},body:JSON.stringify({...body,password_confirmation:body.password})});
    return {status:response.status, body:await response.json()};
  })()`);
    assert.equal(
      registered.status,
      201,
      JSON.stringify(registered.body?.error),
    );
    await send("Page.reload");
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('button[aria-label=\"Sign out\"]') !== null",
        ),
      "authenticated Admin",
    );
    await evaluate(
      "document.querySelector('button[aria-label=\"Sign out\"]').click()",
    );
    await waitFor(
      () =>
        evaluate(
          "location.pathname === '/login' && document.querySelector('#login-email') !== null",
        ),
      "sign out returns to the login route",
    );
    await send("Page.navigate", { url: "http://127.0.0.1:15191/products" });
    await waitFor(
      () =>
        evaluate(
          "location.pathname === '/login' && new URLSearchParams(location.search).get('next') === '/products'",
        ),
      "protected route redirects to login with return path",
    );
    await evaluate("document.querySelector('#login-email').focus()");
    await send("Input.insertText", { text: credentials.email });
    await evaluate("document.querySelector('#login-password').focus()");
    await send("Input.insertText", { text: credentials.password });
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor(
      () =>
        evaluate(
          "location.pathname === '/products' && document.querySelector('button[aria-label=\"Sign out\"]') !== null",
        ),
      "sign in restores the protected route",
    );
    await send("Page.reload");
    await waitFor(
      () =>
        evaluate(
          "location.pathname === '/products' && document.querySelector('button[aria-label=\"Sign out\"]') !== null",
        ),
      "authenticated route survives reload",
    );
    report.push({
      route: "/login?next=/products",
      action: "sign out, protected-route redirect, sign in, reload",
      status: "passed",
    });
    async function navigate(route) {
      await evaluate(
        `history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'));`,
      );
    }
    async function settled(title) {
      await waitFor(
        () =>
          evaluate(
            `document.body.innerText.includes(${JSON.stringify(title)}) && !document.body.innerText.includes('Loading catalogue') && !document.body.innerText.includes('Refreshing inventory')`,
          ),
        title,
      );
      await pause(600);
      await waitFor(
        () =>
          [...requests.values()].every(
            (request) => request.ms !== undefined || request.failed,
          ),
        "API completion",
      );
    }
    await navigate("/dashboard");
    requests.clear();
    await waitFor(
      () =>
        evaluate(
          "[...document.querySelectorAll('button')].some(button => button.textContent.includes('Create product'))",
        ),
      "dashboard create-product shortcut",
    );
    await evaluate(
      "[...document.querySelectorAll('button')].find(button => button.textContent.includes('Create product')).click()",
    );
    assert.equal(await evaluate("location.pathname"), "/products/create");
    await waitFor(
      () =>
        evaluate("document.body.innerText.includes('Classification required')"),
      "dashboard product-create shortcut",
    );
    assert.ok(
      ![...requests.values()].some((request) => request.path === "/products"),
    );
    report.push({
      route: "/dashboard → /products/create",
      action: "Create product shortcut",
      status: "passed",
    });
    for (const [route, title, expected] of [
      ["/product-types", "Product Types", ["/product-types"]],
      ["/category", "Categories", ["/categories"]],
      ["/hsn", "HSN", ["/hsn-codes"]],
      [
        "/products",
        "Products",
        ["/products", "/product-types", "/categories", "/hsn-codes"],
      ],
      ["/combos", "Combos", ["/combos"]],
      [
        "/warehouse-stock",
        "Warehouse stock",
        ["/warehouses", "/warehouse-stocks"],
      ],
    ]) {
      await navigate("/");
      await evaluate(
        "import('/src/api/readCache.ts').then(module => module.invalidateReads())",
      );
      requests.clear();
      await navigate(route);
      await settled(title);
      const cold = [...requests.values()].map(
        ({ started, ...request }) => request,
      );
      assert.deepEqual(
        cold.map((request) => request.path.split("?")[0]).sort(),
        [...expected].sort(),
        route,
      );
      assert.ok(
        cold.every((request) => request.status === 200 && !request.failed),
        JSON.stringify(cold),
      );
      await navigate("/");
      await pause(50);
      requests.clear();
      await navigate(route);
      await settled(title);
      assert.equal(requests.size, 0, `Repeat navigation ${route}`);
      report.push({ route, cold, repeatRequests: 0 });
    }
    await navigate("/product-types");
    await settled("Product Types");
    await evaluate(
      "[...document.querySelectorAll('button')].find(button => button.textContent.includes('Add New')).click()",
    );
    assert.equal(await evaluate("location.pathname"), "/product-types/create");
    await send("Page.reload");
    await pause(800);
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('input[name=name]') !== null && document.querySelector('input[name=slug]') !== null",
        ),
      "product type create form after reload",
    );
    await evaluate(`(() => {
      document.querySelector('input[name=name]').value = 'Browser Route Type';
      document.querySelector('input[name=slug]').value = 'browser-route-type';
      document.querySelector('form').requestSubmit();
    })()`);
    await waitFor(
      () =>
        evaluate(
          "location.pathname === '/product-types' && document.body.innerText.includes('Browser Route Type')",
        ),
      "product type saved and list restored",
    );
    await evaluate(
      "document.querySelector('button[aria-label=\"Edit Browser Route Type\"]').click()",
    );
    assert.match(
      await evaluate("location.pathname"),
      /^\/product-types\/[^/]+\/edit$/,
    );
    await send("Page.reload");
    await pause(800);
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('input[name=name]')?.value === 'Browser Route Type'",
        ),
      "product type edit form after reload",
    );
    await evaluate(`(() => {
      document.querySelector('input[name=name]').value = 'Updated Browser Route Type';
      document.querySelector('form').requestSubmit();
    })()`);
    await waitFor(
      () =>
        evaluate(
          "location.pathname === '/product-types' && document.body.innerText.includes('Updated Browser Route Type')",
        ),
      "product type update and list restored",
    );
    await evaluate(
      "document.querySelector('button[aria-label=\"Deactivate Updated Browser Route Type\"]').click()",
    );
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('button[aria-label=\"Activate Updated Browser Route Type\"]') !== null",
        ),
      "product type status persisted",
    );
    report.push({
      route:
        "/product-types/create → /product-types/{id}/edit → /product-types",
      action: "create, edit, deactivate",
      status: "passed",
    });
    await navigate("/");
    await evaluate(
      "import('/src/api/readCache.ts').then(module => module.invalidateReads())",
    );
    requests.clear();
    await navigate("/products");
    await settled("Products");
    requests.clear();
    await evaluate(
      "[...document.querySelectorAll('button')].find(button => button.textContent.includes('Add Product')).click()",
    );
    await waitFor(
      () =>
        evaluate("document.body.innerText.includes('Classification required')"),
      "product editor dependencies",
    );
    await settled("Classification required");
    const editor = [...requests.values()].map(
      ({ started, ...request }) => request,
    );
    assert.deepEqual(
      editor.map((request) => request.path).sort(),
      ["/brands"].sort(),
    );
    assert.ok(editor.every((request) => request.status === 200));
    const masters = await evaluate(`(async () => {
      const { apiRequest } = await import('/src/api/client.ts');
      const brand = await apiRequest('/brands', 'POST', {name:'Editor Test Brand',slug:'editor-test-brand'});
      const type = await apiRequest('/product-types', 'POST', {name:'Editor Test Type',slug:'editor-test-type',is_active:true});
      const category = await apiRequest('/categories', 'POST', {name:'Editor Test Category',slug:'editor-test-category',is_active:true});
      const attribute = await apiRequest('/attributes', 'POST', {name:'Motor',slug:'motor',data_type:'text',unit:'HP',is_filterable:true,is_active:true});
      const warehouse = await apiRequest('/warehouses', 'POST', {name:'Editor Warehouse',address:'Test address',city:'Trichy',state:'Tamil Nadu',postal_code:'620015'});
      return {brand:brand.data.id,type:type.data.id,category:category.data.id,attribute:attribute.data.id,warehouse:warehouse.data.id};
    })()`);
    requests.clear();
    await send("Page.navigate", {
      url: "http://127.0.0.1:15191/products/create",
    });
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('form#product-form select[name=brand_id]')?.options.length > 1",
        ),
      "product form masters",
    );
    assert.equal(await evaluate("location.pathname"), "/products/create");
    const coldCreatePaths = [...requests.values()].map(
      (request) => request.path,
    );
    assert.ok(!coldCreatePaths.includes("/products"));
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('#product-attributes select')?.options.length > 1 && document.querySelector('#product-inventory select')?.options.length > 1",
        ),
      "independent related masters",
    );
    await waitFor(
      () =>
        evaluate(
          "Boolean(document.querySelector('#product-description-editor')?.editor)",
        ),
      "local description editor initialization",
    );
    assert.deepEqual(
      await evaluate(
        "[...document.querySelectorAll('#product-form > section')].map(section => section.id)",
      ),
      [
        "product-basic",
        "product-content",
        "product-attributes",
        "product-media",
        "product-inventory",
      ],
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.equal(
      await evaluate(
        "getComputedStyle(document.querySelector('#product-basic > div')).gridTemplateColumns.split(' ').length",
      ),
      4,
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 900,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.equal(
      await evaluate(
        "getComputedStyle(document.querySelector('#product-basic > div')).gridTemplateColumns.split(' ').length",
      ),
      2,
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true,
    });
    assert.equal(
      await evaluate(
        "getComputedStyle(document.querySelector('#product-basic > div')).gridTemplateColumns.split(' ').length",
      ),
      1,
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(`(() => {
      const form = document.querySelector('form#product-form');
      for (const [name,value] of Object.entries(${JSON.stringify({
        name: "Editor Test Product",
        group_name: "Editor Group",
        sku: "EDITOR-TEST-SKU",
        mrp_price: "1000.00",
        sale_price: "900.00",
        sort_order: "3",
      })})) form.elements.namedItem(name).value = value;
      for (const [name,value] of Object.entries(${JSON.stringify({
        brand_id: masters.brand,
        product_type_id: masters.type,
        category_id: masters.category,
      })})) form.elements.namedItem(name).value = value;
      form.elements.namedItem('is_active').value = '0';
      const surface = document.querySelector('#product-description-editor');
      surface.editor.commands.setContent('<p>Safe <strong onclick=alert(1)>description</strong><img alt=ignored></p>');
    })()`);
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('input[name=description]').value.includes('<strong>description</strong>')",
        ),
      "rich description editor value",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('input[name=description]').value.includes('onclick')",
      ),
      false,
    );
    await verifyDescriptionRibbon();
    // Enter dependent data BEFORE the first product POST; no fake product ID.
    await evaluate(`(() => {
      const select = document.querySelector('#product-attributes select');
      select.value = ${JSON.stringify(masters.attribute)};
      select.dispatchEvent(new Event('change', {bubbles:true}));
      const input = document.querySelector('#product-attributes input[placeholder="Specification value"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '3');
      input.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('#product-attributes input[type=checkbox]').click();
    })()`);
    await evaluate(
      "[...document.querySelectorAll('#product-attributes button')].find(button => button.textContent.includes('Add specification')).click()",
    );
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('input[aria-label=\"Value for Motor\"]')?.value === '3'",
        ),
      "draft specification",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('#product-attributes input[disabled]')?.value",
      ),
      "—",
    );
    await evaluate(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 40;
      canvas.getContext('2d').fillRect(0,0,40,40);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'product-test.png', {type:'image/png'}));
      const input = document.querySelector('#product-media input[type=file][multiple]');
      input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true}));
      const warehouse = document.querySelector('#product-inventory select');
      warehouse.value = ${JSON.stringify(masters.warehouse)}; warehouse.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    await evaluate(`(() => {
      const input = document.querySelector('#product-inventory input[type=number]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '4');
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`);
    await evaluate(
      "[...document.querySelectorAll('#product-inventory button')].find(button => button.textContent.includes('Queue stock operation')).click()",
    );
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('#product-inventory tbody')?.textContent.includes('Editor Warehouse')",
        ),
      "draft stock operation before create",
    );
    assert.ok(
      ![...requests.values()].some(
        (request) => request.method === "POST" && request.path === "/products",
      ),
    );
    await evaluate(
      "document.querySelector('form#product-form').requestSubmit()",
    );
    await waitFor(
      () =>
        evaluate(
          "/^\\/products\\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/create')",
        ),
      "complete product saved and detail opened",
    );
    const createdId = await evaluate("location.pathname.split('/')[2]");
    const created = await evaluate(
      `fetch('/api/v1/admin/products/${createdId}',{credentials:'include',headers:{Accept:'application/json'}}).then(r=>r.json()).then(r=>r.data)`,
    );
    assert.equal(created.name, "Editor Test Product");
    assert.equal(created.is_active, false);
    assert.equal(created.sort_order, 3);
    assert.match(created.description, /<strong>description<\/strong>/);
    assert.doesNotMatch(created.description, /onclick|<img/i);
    assert.equal(created.specifications.length, 1);
    assert.equal(created.specifications[0].value, "3");
    assert.equal(created.specifications[0].attribute.unit, "HP");
    assert.equal(created.specifications[0].show_on_top, true);
    assert.equal(
      created.highlights[0].product_attribute_id,
      created.specifications[0].id,
    );
    assert.equal(created.images.length, 1);
    const savedStock = await evaluate(
      `fetch('/api/v1/admin/warehouses/${masters.warehouse}/products/${createdId}/stock').then(r=>r.json()).then(r=>r.data)`,
    );
    assert.equal(savedStock.quantity, 4);
    assert.equal(savedStock.movements.length, 1);
    requests.clear();
    await send("Page.navigate", {
      url: `http://127.0.0.1:15191/products/${createdId}/edit`,
    });
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('input[name=name]')?.value === 'Editor Test Product'",
        ),
      "persisted product edit form",
    );
    await waitFor(
      () =>
        evaluate(
          "Boolean(document.querySelector('#product-description-editor')?.editor)",
        ),
      "description restored into edit editor",
    );
    assert.equal(
      await evaluate("document.querySelector('input[name=description]').value"),
      created.description,
    );
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('input[aria-label=\"Value for Motor\"]')?.value === '3'",
        ),
      "specification reloaded into shared edit form",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('input[aria-label=\"Show Motor on top\"]').checked",
      ),
      true,
    );
    assert.ok(
      ![...requests.values()].some((request) => request.path === "/products"),
    );
    await evaluate(`(() => {
      document.querySelector('input[name=sale_price]').value = '1100';
      document.querySelector('form#product-form').requestSubmit();
    })()`);
    await waitFor(
      () =>
        evaluate(
          "Boolean(document.querySelector('#product-error-sale_price')?.textContent)",
        ),
      "inline server pricing validation",
    );
    assert.equal(
      await evaluate("location.pathname"),
      `/products/${createdId}/edit`,
    );
    await evaluate(
      "document.querySelector('input[name=sale_price]').value = '900'",
    );
    await evaluate(`(async () => {
      const {apiRequest} = await import('/src/api/client.ts');
      await apiRequest('/products/${createdId}', 'PUT', ${JSON.stringify({
        brand_id: masters.brand,
        category_id: masters.category,
        product_type_id: masters.type,
        name: "Concurrent administrator change",
        sku: created.sku,
        mrp_price: created.price.mrp,
        sale_price: created.price.sale,
        is_active: created.is_active,
        group_name: created.group_name,
        tag: created.tag,
        sort_order: created.sort_order,
        description: created.description,
      })});
    })()`);
    await evaluate(
      "document.querySelector('form#product-form').requestSubmit()",
    );
    await waitFor(
      () =>
        evaluate(
          "document.body.innerText.includes('changed by another administrator')",
        ),
      "stale edit conflict feedback",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('button[form=product-form]').disabled",
      ),
      true,
    );
    acceptExpectedUnload = true;
    await send("Page.navigate", {
      url: `http://127.0.0.1:15191/products/${createdId}/edit`,
    });
    await waitFor(
      () =>
        evaluate(
          "document.querySelector('input[name=name]')?.value === 'Concurrent administrator change' && document.querySelector('input[aria-label=\"Value for Motor\"]')?.value === '3'",
        ),
      "reload conflict without data loss",
    );
    await evaluate(`(() => {
      document.querySelector('input[name=name]').value = 'Updated Editor Test Product';
      document.querySelector('form#product-form').requestSubmit();
    })()`);
    await waitFor(
      () => evaluate(`location.pathname === '/products/${createdId}'`),
      "product updated and detail opened",
    );
    const updated = await evaluate(
      `fetch('/api/v1/admin/products/${createdId}',{credentials:'include',headers:{Accept:'application/json'}}).then(r=>r.json()).then(r=>r.data)`,
    );
    assert.equal(updated.name, "Updated Editor Test Product");
    assert.match(updated.description, /<strong>description<\/strong>/);
    assert.equal(updated.specifications[0].id, created.specifications[0].id);
    assert.equal(updated.images[0].id, created.images[0].id);
    assert.equal(
      (
        await evaluate(
          `fetch('/api/v1/admin/warehouses/${masters.warehouse}/products/${createdId}/stock').then(r=>r.json()).then(r=>r.data)`,
        )
      ).movements.length,
      1,
    );
    requests.clear();
    await send("Page.navigate", {
      url: `http://127.0.0.1:15191/products/${createdId}`,
    });
    await waitFor(
      () =>
        evaluate(
          "document.body.innerText.includes('Updated Editor Test Product') && document.body.innerText.includes('Overview')",
        ),
      "persisted product detail deep link",
    );
    assert.ok(
      ![...requests.values()].some((request) => request.path === "/products"),
    );
    report.push({
      route:
        "/products/create → /products/{id} → /products/{id}/edit → /products/{id}",
      action:
        "one shared form, pre-save specification/highlight/image/stock, persisted reload and edit without duplicate relationships or stock",
      status: "passed",
    });
    if (process.argv.includes("--product-only")) {
      const seedPages = spawnSync(
        php,
        [
          "-r",
          `require 'vendor/autoload.php'; $app = require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ${phpLiteral(database)}) { exit(2); } for ($i=1; $i<=25; $i++) { App\\Models\\Product::factory()->create(['name'=>sprintf('Paging Fixture %02d',$i),'sku'=>sprintf('PAGE-%02d',$i),'mrp_price'=>'100.00','sale_price'=>null]); }`,
        ],
        { cwd: backend, env, encoding: "utf8" },
      );
      assert.equal(seedPages.status, 0, seedPages.stderr);
      await send("Page.navigate", {
        url: "http://127.0.0.1:15191/products?search=Paging+Fixture&sort=name&page=2",
      });
      await settled("Page 2 of 2");
      await evaluate(
        "document.querySelector('button[aria-label=\"Edit Paging Fixture 21\"]').click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('input[name=name]')?.value === 'Paging Fixture 21'",
          ),
        "edit from second server page",
      );
      assert.equal(
        await evaluate("new URLSearchParams(location.search).get('page')"),
        "2",
      );
      await evaluate(
        "[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Cancel').click()",
      );
      await settled("Page 2 of 2");
      await evaluate(
        `(() => { const input = document.querySelector('input[aria-label="Search products"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'PAGE-25'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
      );
      await evaluate(
        "[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Apply filters').click()",
      );
      await settled("Paging Fixture 25");
      assert.equal(
        await evaluate("new URLSearchParams(location.search).get('search')"),
        "PAGE-25",
      );
      assert.equal(
        await evaluate("new URLSearchParams(location.search).has('page')"),
        false,
      );
      report.push({
        route:
          "/products?search=Paging+Fixture&sort=name&page=2 → edit → cancel",
        action:
          "real pagination, context preserved, server search beyond first page",
        status: "passed",
      });
      const restrict = spawnSync(
        php,
        [
          "-r",
          `require 'vendor/autoload.php'; $app = require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ${phpLiteral(database)}) { exit(2); } $role = App\\Models\\Role::create(['name'=>'Catalog only','slug'=>'catalog-only']); $role->permissions()->attach(App\\Models\\Permission::where('name','catalog.manage')->firstOrFail()); App\\Models\\User::where('email','navigation@example.test')->firstOrFail()->roles()->sync([$role->id]);`,
        ],
        { cwd: backend, env, encoding: "utf8" },
      );
      assert.equal(restrict.status, 0, restrict.stderr);
      requests.clear();
      await send("Page.navigate", {
        url: `http://127.0.0.1:15191/products/${createdId}/edit`,
      });
      await settled("Inventory changes require inventory permission");
      assert.equal(
        await evaluate("document.querySelector('input[name=name]')?.value"),
        "Updated Editor Test Product",
      );
      assert.ok(
        ![...requests.values()].some((request) =>
          request.path.startsWith("/warehouses"),
        ),
      );
      const forbidden = await evaluate(
        `(async () => { const {apiRequest} = await import('/src/api/client.ts'); try { await apiRequest('/warehouses/${masters.warehouse}/products/${createdId}/stock', 'PUT', {quantity:5}); return 200; } catch (error) { return error.status; } })()`,
      );
      assert.equal(forbidden, 403);
      await evaluate(
        "document.querySelector('form#product-form').requestSubmit()",
      );
      await waitFor(
        () => evaluate(`location.pathname === '/products/${createdId}'`),
        "catalog-only user saves without inventory permission",
      );
      assert.deepEqual(exceptions, []);
      console.log(
        JSON.stringify(
          {
            pages: report,
            catalogOnly:
              "edit/save succeeds; no warehouse fetch; stock write forbidden",
            browserErrors: exceptions,
          },
          null,
          2,
        ),
      );
    } else {
      const featuredProduct = await evaluate(`(async () => {
      const { apiRequest } = await import('/src/api/client.ts');
      return (await apiRequest('/products', 'POST', {
        brand_id: ${JSON.stringify(masters.brand)},
        product_type_id: ${JSON.stringify(masters.type)},
        category_id: ${JSON.stringify(masters.category)},
        name: 'Featured Browser Product',
        sku: 'FEATURED-BROWSER-SKU',
        mrp_price: '1000.00',
        sale_price: '800.00',
        is_active: true
      })).data;
    })()`);
      await navigate("/featured-products/choose");
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('article h3')?.textContent === 'Featured Browser Product'",
          ),
        "featured product card loaded",
      );
      assert.equal(
        await evaluate("document.querySelector('article img') === null"),
        true,
        "missing image has a graceful fallback",
      );
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await evaluate(
          "getComputedStyle(document.querySelector('article').parentElement).gridTemplateColumns.split(' ').length",
        ),
        5,
      );
      await send("Emulation.setDeviceMetricsOverride", {
        width: 900,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await evaluate(
          "getComputedStyle(document.querySelector('article').parentElement).gridTemplateColumns.split(' ').length",
        ),
        2,
      );
      await send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true,
      });
      assert.equal(
        await evaluate(
          "getComputedStyle(document.querySelector('article').parentElement).gridTemplateColumns.split(' ').length",
        ),
        1,
      );
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "document.querySelector('input[aria-label=\"Search eligible products\"]').focus()",
      );
      await send("Input.insertText", { text: "Featured Browser" });
      await waitFor(
        () =>
          evaluate("document.body.innerText.includes('1 matching product')"),
        "featured search result",
      );
      await evaluate(`(() => {
      const type = document.querySelector('select[aria-label="Product type"]');
      type.value = ${JSON.stringify(masters.type)};
      type.dispatchEvent(new Event('change', { bubbles: true }));
      const category = document.querySelector('select[aria-label="Category"]');
      category.value = ${JSON.stringify(masters.category)};
      category.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
      await waitFor(
        () =>
          evaluate(
            "document.querySelectorAll('article').length === 1 && document.body.innerText.includes('1 matching product')",
          ),
        "composed featured filters",
      );
      await evaluate("document.querySelector('article button').click()");
      await waitFor(
        () =>
          evaluate(
            "[...document.querySelectorAll('article button')].some(button => button.disabled && button.textContent.includes('Added')) && document.body.innerText.includes('1 assigned')",
          ),
        "product assigned and duplicate action disabled",
      );
      await evaluate(`(() => {
      const order = document.querySelector('input[aria-label="Order for Featured Browser Product"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(order, '7');
      order.dispatchEvent(new Event('input', { bubbles: true }));
      const active = order.closest('article').querySelector('input[type=checkbox]');
      active.click();
      [...order.closest('article').querySelectorAll('button')].find(button => button.textContent.includes('Save')).click();
    })()`);
      await waitFor(
        () =>
          evaluate("document.body.innerText.includes('Placement updated.')"),
        "featured order and status saved",
      );
      const featuredPlacement = await evaluate(
        `fetch('/api/v1/admin/merchandising/featured', {credentials:'include',headers:{Accept:'application/json'}}).then(r=>r.json()).then(r=>r.data.items[0])`,
      );
      assert.equal(featuredPlacement.product.id, featuredProduct.id);
      assert.equal(featuredPlacement.sort_order, 7);
      assert.equal(featuredPlacement.is_active, false);
      await evaluate(`(() => {
      window.confirm = () => true;
      document.querySelector('button[aria-label="Remove Featured Browser Product"]').click();
    })()`);
      await waitFor(
        () =>
          evaluate(
            "document.body.innerText.includes('0 assigned') && document.body.innerText.includes('Product removed.')",
          ),
        "featured product removed",
      );
      await evaluate(
        "[...document.querySelectorAll('button')].find(button => button.textContent.includes('Reset')).click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('input[aria-label=\"Search eligible products\"]').value === ''",
          ),
        "featured filters reset",
      );
      report.push({
        route: "/featured-products/choose",
        action:
          "responsive cards, search and filters, assign, update, remove, reset",
        status: "passed",
      });
      // Verify the first storefront slice against the same isolated Laravel data.
      const storefront = path.resolve(admin, "../storefront");
      const storefrontConfig = path.join(temporary, "storefront.config.mjs");
      writeFileSync(
        storefrontConfig,
        "import config from " +
          JSON.stringify(
            path.join(storefront, "vite.config.ts").replaceAll("\\", "/"),
          ) +
          "; export default {...config,server:{proxy:{'/api':'http://127.0.0.1:18091','/storage':'http://127.0.0.1:18091'}}};",
      );
      launch(
        process.execPath,
        [
          "node_modules/vite/bin/vite.js",
          "--config",
          storefrontConfig,
          "--host=127.0.0.1",
          "--port=15193",
          "--strictPort",
        ],
        storefront,
      );
      await waitFor(
        async () => (await fetch("http://127.0.0.1:15193")).ok,
        "Storefront startup",
      );
      const storefrontFixture = await evaluate(
        "(async () => { const {apiRequest} = await import('/src/api/client.ts'); const warehouse = await apiRequest('/warehouses','POST',{name:'Storefront Test Warehouse',address:'Test address',city:'Trichy',state:'Tamil Nadu',postal_code:'620015'}); await apiRequest('/warehouses/'+warehouse.data.id+'/products/" +
          featuredProduct.id +
          "/stock','PUT',{quantity:4}); await apiRequest('/merchandising/featured/products','POST',{product_id:" +
          JSON.stringify(featuredProduct.id) +
          "}); await apiRequest('/merchandising/bestsellers/products','POST',{product_id:" +
          JSON.stringify(featuredProduct.id) +
          "}); return {warehouse:warehouse.data.id}; })()",
      );
      const bannerFixture = await evaluate(`(async () => {
      const {apiRequest,apiFormRequest} = await import('/src/api/client.ts');
      async function image(width,height,name) {
        const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
        const context = canvas.getContext('2d'); context.fillStyle='#071a2b'; context.fillRect(0,0,width,height);
        context.fillStyle='#ff6b1a'; context.fillRect(0,0,width/3,height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
        const body = new FormData(); body.set('image',new File([blob],name,{type:'image/png'}));
        return (await apiFormRequest('/media',body)).data;
      }
      const desktop = await image(1200,500,'hero-desktop.png');
      const mobile = await image(480,720,'hero-mobile.png');
      const base = {desktop_media_id:desktop.id,mobile_media_id:mobile.id,page:'landing',is_active:true,redirect_url:'https://www.durafit91.com/products'};
      const first = (await apiRequest('/banners','POST',{...base,title:'Move Your Way',description:'A real admin-managed homepage campaign.',cta_text:'Explore equipment',sort_order:1})).data;
      const second = (await apiRequest('/banners','POST',{...base,title:'Second Campaign',description:'Another published campaign.',cta_text:'Shop now',sort_order:2})).data;
      return {first:first.id,second:second.id,mobileUrl:mobile.url};
    })()`);
      await send("Page.navigate", {
        url: "http://127.0.0.1:15191/banners/create",
      });
      await waitFor(
        () => evaluate("document.querySelector('#banner-title') !== null"),
        "admin banner create form",
      );
      await evaluate("document.querySelector('#banner-title').focus()");
      await send("Input.insertText", { text: "UI-created Banner" });
      await evaluate("document.querySelector('#banner-description').focus()");
      await send("Input.insertText", {
        text: "Created through the admin form.",
      });
      await evaluate("document.querySelector('#banner-cta-text').focus()");
      await send("Input.insertText", { text: "Browse" });
      await evaluate(
        "document.querySelector('#banner-page').value = 'listing'; document.querySelector('#banner-page').dispatchEvent(new Event('change', {bubbles:true}))",
      );
      await evaluate(
        "[...document.querySelectorAll('button')].filter(button => button.textContent.includes('Choose from Library'))[0].click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('button.banner-lib-item[title=\"hero-desktop.png\"]') !== null",
          ),
        "desktop media library choice",
      );
      await evaluate(
        "document.querySelector('button.banner-lib-item[title=\"hero-desktop.png\"]').click()",
      );
      await evaluate(
        "[...document.querySelectorAll('button')].filter(button => button.textContent.includes('Choose from Library'))[1].click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('button.banner-lib-item[title=\"hero-mobile.png\"]') !== null",
          ),
        "mobile media library choice",
      );
      await evaluate(
        "document.querySelector('button.banner-lib-item[title=\"hero-mobile.png\"]').click()",
      );
      await evaluate("document.querySelector('form').requestSubmit()");
      try {
        await waitFor(
          () =>
            evaluate(
              "location.pathname === '/banners' && document.body.innerText.includes('UI-created Banner')",
            ),
          "admin banner created from form",
        );
      } catch (error) {
        const formState = await evaluate(
          "({path:location.pathname,alerts:[...document.querySelectorAll('[role=alert]')].map(node=>node.textContent),selected:[...document.querySelectorAll('[aria-label^=\"Upload \"]')].map(node=>node.parentElement?.textContent)})",
        );
        throw new Error(`${error.message}: ${JSON.stringify(formState)}`);
      }
      const uiBanner = await evaluate(
        "(async () => {const {apiRequest}=await import('/src/api/client.ts');return (await apiRequest('/banners?search=UI-created%20Banner')).data[0]})()",
      );
      assert.equal(uiBanner.page, "listing");
      assert.equal(uiBanner.description, "Created through the admin form.");
      await send("Page.navigate", {
        url: "http://127.0.0.1:15191/banners/" + uiBanner.id + "/edit",
      });
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#banner-title')?.value === 'UI-created Banner'",
          ),
        "admin banner edit form prefilled",
      );
      await evaluate(
        "document.querySelector('#banner-title').focus(); document.querySelector('#banner-title').select()",
      );
      await send("Input.insertText", { text: "UI-edited Banner" });
      await evaluate("document.querySelector('form').requestSubmit()");
      await waitFor(
        () =>
          evaluate(
            "location.pathname === '/banners' && document.body.innerText.includes('UI-edited Banner')",
          ),
        "admin banner updated from form",
      );
      assert.equal(
        await evaluate(
          "(async () => {const {apiRequest}=await import('/src/api/client.ts');return (await apiRequest('/banners/" +
            uiBanner.id +
            "')).data.title})()",
        ),
        "UI-edited Banner",
      );
      report.push({
        route: "/banners/create → /banners/{id}/edit",
        action:
          "Admin form selects desktop/mobile media, creates and edits a persisted banner",
        status: "passed",
      });
      await send("Page.navigate", { url: "http://127.0.0.1:15193/" });
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#featured .product-card h3')?.textContent === 'Featured Browser Product'",
          ),
        "Admin curated product on storefront",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.hero-slide h1')?.textContent === 'Move Your Way'",
          ),
        "admin banner on storefront carousel",
      );
      assert.equal(
        await evaluate("document.querySelector('.hero-slide p')?.textContent"),
        "A real admin-managed homepage campaign.",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.hero-slide-cta')?.textContent.includes('Explore equipment')",
        ),
        true,
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.hero-slide img')?.naturalWidth > 0",
          ),
        "desktop banner image loads",
      );
      await evaluate("document.querySelector('.hero-dot.is-active').click()");
      await evaluate(
        "document.querySelector('button[aria-label=\"Next banner\"]').click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.hero-slide h1')?.textContent === 'Second Campaign'",
          ),
        "carousel next banner",
      );
      await evaluate(
        "document.querySelector('button[aria-label=\"Previous banner\"]').click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.hero-slide h1')?.textContent === 'Move Your Way'",
          ),
        "carousel previous banner",
      );
      assert.match(
        await evaluate(
          "document.querySelector('#featured .product-price').textContent",
        ),
        /800/,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.brand-logo img')?.getAttribute('alt')",
        ),
        "Durafit91",
      );
      assert.deepEqual(
        await evaluate(
          "Array.from(document.querySelectorAll('.header-utility a')).map(link => link.href)",
        ),
        [
          "https://www.durafit91.com/91wiz",
          "https://www.durafit91.com/warranty-details",
          "https://www.durafit91.com/register-my-product",
          "https://www.durafit91.com/checkout",
        ],
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#categories [data-testid=\"product-type-card\"][href*=\"product_type_id\"]') !== null || document.querySelector('#categories [role=\"alert\"] button') !== null",
          ),
        "real product types or retry state on home",
      );
      if (
        await evaluate(
          "document.querySelector('#categories [role=\"alert\"] button') !== null",
        )
      ) {
        await evaluate(
          "document.querySelector('#categories [role=\"alert\"] button').click()",
        );
        await waitFor(
          () =>
            evaluate(
            "document.querySelector('#categories [data-testid=\"product-type-card\"][href*=\"product_type_id\"]') !== null",
            ),
          "product types after retry",
        );
      }
      for (const width of [1440, 768, 390]) {
        await send("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width === 390,
        });
        await pause(150);
        assert.equal(
          await evaluate("document.documentElement.scrollWidth <= innerWidth"),
          true,
          "Storefront overflow at " + width,
        );
        const heroBounds = await evaluate(
          "(() => { const hero = document.querySelector('.hero-carousel').getBoundingClientRect(); return {left:hero.left,right:hero.right,top:hero.top,headerBottom:document.querySelector('.store-header').getBoundingClientRect().bottom,viewport:document.documentElement.clientWidth}; })()",
        );
        assert.equal(
          Math.abs(heroBounds.left) <= 1 &&
            Math.abs(heroBounds.right - heroBounds.viewport) <= 1,
          true,
          "Homepage banner fills viewport at " + width,
        );
        assert.equal(
          Math.abs(heroBounds.top - heroBounds.headerBottom) <= 1,
          true,
          "Homepage banner sits directly below header at " + width,
        );
        if (width === 390) {
          await waitFor(
            () =>
              evaluate(
                "document.querySelector('.hero-slide img')?.naturalWidth > 0",
              ),
            "mobile banner image loads",
          );
          assert.equal(
            await evaluate(
              "document.querySelector('.hero-slide img')?.currentSrc.endsWith(" +
                JSON.stringify(bannerFixture.mobileUrl) +
                ")",
            ),
            true,
            "dedicated mobile banner image selected",
          );
        }
        if (process.argv.includes("--screenshots")) {
          const screenshot = await send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false,
          });
          const screenshotPath = path.join(
            tmpdir(),
            "durafit-storefront-home-" + width + ".png",
          );
          writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
          console.log("Storefront screenshot: " + screenshotPath);
        }
      }
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const hasEquipmentTrigger = await evaluate(
        "Boolean(document.querySelector('.equipment-trigger'))",
      );
      if (hasEquipmentTrigger) {
        await evaluate("document.querySelector('.equipment-trigger').click()");
        assert.equal(
          await evaluate(
            "document.querySelector('.equipment-trigger').getAttribute('aria-expanded')",
          ),
          "true",
        );
        assert.equal(
          await evaluate(
            "document.querySelector('#equipment-mega-menu a[href*=category_id]') !== null",
          ),
          true,
        );
        await evaluate(
          "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))",
        );
        assert.equal(
          await evaluate(
            "document.querySelector('#equipment-mega-menu') === null",
          ),
          true,
        );
      }
      await evaluate(
        "document.querySelector('#global-product-search').focus()",
      );
      await send("Input.insertText", { text: "Featured Browser Product" });
      await evaluate(
        "document.querySelector('.desktop-search form').requestSubmit()",
      );
      await waitFor(
        () =>
          evaluate(
            "location.pathname === '/products' && new URLSearchParams(location.search).get('q') === 'Featured Browser Product'",
          ),
        "header search navigation",
      );
      await evaluate("history.back()");
      await waitFor(
        () => evaluate("location.pathname === '/'"),
        "header search back navigation",
      );
      const bannerUpdate = await evaluate(
        "(async () => { const csrf=await (await fetch('/api/v1/admin/auth/csrf',{headers:{Accept:'application/json'}})).json(); return (await fetch('/api/v1/admin/banners/" +
          bannerFixture.first +
          "',{method:'PUT',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf.data.csrf_token},body:JSON.stringify({is_active:false})})).status; })()",
      );
      assert.equal(bannerUpdate, 200);
      await send("Page.reload");
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.hero-slide h1')?.textContent === 'Second Campaign'",
          ),
        "admin unpublish reflected on storefront",
      );
      await send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await evaluate(
        "document.querySelector('.mobile-header-actions button[aria-controls=mobile-search-panel]').click()",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('#mobile-search-panel') !== null",
        ),
        true,
      );
      await waitFor(
        () =>
          evaluate("document.activeElement?.id === 'mobile-product-search'"),
        "mobile search focus",
      );
      await send("Input.insertText", { text: "test" });
      assert.equal(
        await evaluate(
          "document.querySelector('#mobile-product-search').value",
        ),
        "test",
      );
      await evaluate(
        "document.querySelector('#mobile-search-panel .nav-search-clear').click()",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('#mobile-product-search').value",
        ),
        "",
      );
      await evaluate(
        "document.querySelector('.mobile-header-actions button[aria-controls=mobile-search-panel]').click()",
      );
      await evaluate(
        "document.querySelector('.mobile-header-actions button[aria-controls=mobile-nav-panel]').click()",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.mobile-header-actions button[aria-controls=mobile-nav-panel]').getAttribute('aria-expanded')",
        ),
        "true",
      );
      assert.equal(
        await evaluate(
          "document.querySelectorAll('#mobile-nav-panel nav[aria-label=" +
            JSON.stringify("Mobile service navigation") +
            "] a').length",
        ),
        4,
      );
      await evaluate(
        "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))",
      );
      assert.equal(
        await evaluate("document.querySelector('#mobile-nav-panel') === null"),
        true,
      );
      await waitFor(
        () =>
          evaluate(
            "document.activeElement?.getAttribute('aria-controls') === 'mobile-nav-panel'",
          ),
        "mobile drawer focus restoration",
      );
      await evaluate(
        "document.querySelector('.mobile-header-actions button[aria-controls=mobile-nav-panel]').click()",
      );
      await evaluate(
        "document.querySelector('#mobile-nav-panel nav a[href=" +
          JSON.stringify("/products") +
          "]').click()",
      );
      await waitFor(
        () =>
          evaluate(
            "location.pathname === '/products' && document.querySelector('.product-card h3') !== null",
          ),
        "mobile catalog navigation",
      );
      assert.equal(
        await evaluate("document.querySelector('#mobile-nav-panel') === null"),
        true,
      );
      await evaluate("document.querySelector('.product-card h3 a').click()");
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.product-intro h1')?.textContent === 'Featured Browser Product'",
          ),
        "real product detail route",
      );
      assert.equal(
        await evaluate("location.pathname"),
        "/products/" + featuredProduct.id,
      );
      assert.match(
        await evaluate("document.querySelector('.sku').textContent"),
        /FEATURED-BROWSER-SKU/,
      );
      assert.match(
        await evaluate("document.querySelector('.availability').textContent"),
        /4 available/,
      );
      await send("Page.reload");
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.product-intro h1')?.textContent === 'Featured Browser Product'",
          ),
        "storefront deep-link reload",
      );
      await evaluate("history.back()");
      await waitFor(
        () =>
          evaluate(
            "location.pathname === '/products' && document.querySelector('#catalog-search') !== null",
          ),
        "storefront browser back",
      );
      await evaluate("document.querySelector('#catalog-search').focus()");
      await send("Input.insertText", { text: "missing-equipment" });
      await evaluate(
        "document.querySelector('.catalog-search').requestSubmit()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('.feedback h3')?.textContent.includes('different direction')",
          ),
        "storefront empty search state",
      );
      await send("Network.setBlockedURLs", {
        urls: ["*/api/v1/merchandising/bestsellers"],
      });
      await send("Page.navigate", { url: "http://127.0.0.1:15193/" });
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#bestsellers [role=alert]') !== null && document.querySelector('#featured .product-card') !== null",
          ),
        "isolated merchandising failure",
      );
      await send("Network.setBlockedURLs", { urls: [] });
      await evaluate(
        "document.querySelector('#bestsellers .error button').click()",
      );
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#bestsellers .product-card') !== null",
          ),
        "merchandising retry",
      );
      const stockStatus = await evaluate(
        "(async () => { const csrf = await (await fetch('/api/v1/admin/auth/csrf',{headers:{Accept:'application/json'}})).json(); return (await fetch('/api/v1/admin/warehouses/" +
          storefrontFixture.warehouse +
          "/products/" +
          featuredProduct.id +
          "/stock',{method:'PUT',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf.data.csrf_token},body:JSON.stringify({quantity:0})})).status; })()",
      );
      assert.equal(stockStatus, 200);
      await send("Page.navigate", {
        url: "http://127.0.0.1:15193/products/" + featuredProduct.id,
      });
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('[role=alert]')?.textContent.includes('no longer available')",
          ),
        "stock change controls storefront visibility",
      );
      report.push({
        route: "Storefront / → /products → /products/{id}",
        action:
          "Admin product/stock/merchandising/banner → public homepage/detail; carousel navigation, desktop/mobile media, unpublish refresh, responsive logo, mega menu, search, mobile drawer/keyboard, utility links, reload/back, API retry, stock visibility",
        status: "passed (isolated SQLite)",
      });
      assert.deepEqual(exceptions, []);
      console.log(
        JSON.stringify(
          {
            pages: report,
            productEditor: editor,
            attributesRoute:
              "No standalone Attributes route; fetched only for the product editor",
            browserErrors: exceptions,
          },
          null,
          2,
        ),
      );
    }
  }
} catch (error) {
  if (error !== descriptionCheckComplete) throw error;
} finally {
  socket?.close();
  for (const child of children.reverse()) {
    if (!child.pid) continue;
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
    console.warn(`Temporary test files still locked by Windows: ${temporary}`);
  }
}
