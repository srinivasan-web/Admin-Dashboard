// Uses the existing isolated SQLite/Laravel/Vite/Chrome harness.
// node admin/tests/catalogNavigation.browser.mjs <php.exe> --product-detail-only
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export async function verifyProductDetail({
  send,
  evaluate,
  waitFor,
  startStorefront,
  exceptions,
}) {
  await waitFor(
    () => evaluate("Boolean(document.querySelector('input[type=password]'))"),
    "admin login entry",
  );
  const password = randomBytes(20).toString("hex");
  const fixture = await evaluate(`(async()=>{
    const {registerInitialAdmin}=await import('/src/api/adminAuth.ts');
    const {apiRequest,apiFormRequest}=await import('/src/api/client.ts');
    await registerInitialAdmin({name:'Detail Verification',email:'details@example.test',password:${JSON.stringify(password)},password_confirmation:${JSON.stringify(password)}});
    const brand=(await apiRequest('/brands','POST',{name:'Durafit Detail Brand',slug:'detail-brand'})).data;
    const type=(await apiRequest('/product-types','POST',{name:'Treadmills',slug:'treadmills',is_active:true})).data;
    const category=(await apiRequest('/categories','POST',{name:'Fitness',slug:'fitness',is_active:true})).data;
    const warehouse=(await apiRequest('/warehouses','POST',{name:'Detail Warehouse',address:'Test address',city:'Trichy',state:'Tamil Nadu',postal_code:'620015'})).data;
    const attribute=(await apiRequest('/attributes','POST',{name:'Motor',slug:'motor',data_type:'text',unit:'HP',is_active:true,is_filterable:true,sort_order:0})).data;
    const product=(await apiRequest('/products','POST',{name:'Detail Treadmill',sku:'DETAIL-001',brand_id:brand.id,product_type_id:type.id,category_id:category.id,mrp_price:'50000.00',sale_price:'40000.00',description:'<p>Built for home training. <strong>Keep moving.</strong></p>',tag:'New',is_active:true})).data;
    await apiRequest('/warehouses/'+warehouse.id+'/products/'+product.id+'/stock','PUT',{quantity:5});
    const spec=(await apiRequest('/products/'+product.id+'/attributes','POST',{attribute_id:attribute.id,value:'3 Peak',sort_order:0})).data;
    await apiRequest('/products/'+product.id+'/highlights','PUT',{highlights:[{product_attribute_id:spec.id,sort_order:0,is_active:true}]});
    for(let i=0;i<2;i++){
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
      const context=canvas.getContext('2d');context.fillStyle=i?'#ff6b1a':'#071a2b';context.fillRect(0,0,640,640);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      const data=new FormData();data.set('image',new File([blob],'detail-'+i+'.png',{type:'image/png'}));data.set('sort_order',String(i));data.set('is_primary',i?'1':'0');
      await apiFormRequest('/products/'+product.id+'/images',data);
    }
    const other=(await apiRequest('/products','POST',{name:'Simple Equipment',sku:'DETAIL-002',brand_id:brand.id,product_type_id:type.id,category_id:category.id,mrp_price:'20000.00',is_active:true})).data;
    await apiRequest('/warehouses/'+warehouse.id+'/products/'+other.id+'/stock','PUT',{quantity:2});
    await apiRequest('/combos','POST',{name:'Training setup',is_active:true,items:[{product_id:product.id,quantity:1},{product_id:other.id,quantity:1}]});
    return {id:product.id,otherId:other.id,typeId:type.id,specId:spec.id,attributeId:attribute.id,warehouseId:warehouse.id};
  })()`);
  await startStorefront();
  await send("Page.navigate", {
    url: `http://127.0.0.1:15193/products/${fixture.id}`,
  });
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('.product-intro h1')?.textContent==='Detail Treadmill'",
      ),
    "persisted product detail",
  );
  assert.match(
    await evaluate(
      "document.querySelector('.product-intro .product-price strong').textContent",
    ),
    /40,000/,
  );
  assert.equal(
    await evaluate("document.querySelector('.product-discount').textContent"),
    "20% off",
  );
  assert.match(
    await evaluate("document.querySelector('.availability').textContent"),
    /5 available/,
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=product-highlights] dd').textContent",
    ),
    "3 Peak HP",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=product-specifications] dd').textContent",
    ),
    "3 Peak HP",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.product-description strong').textContent",
    ),
    "Keep moving.",
  );
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=product-gallery] > div > img')?.naturalWidth>0",
      ),
    "persisted image served",
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[aria-label=\"Choose product image\"] button')[1].getAttribute('aria-pressed')",
    ),
    "true",
    "primary image selected even when not first",
  );
  await evaluate(
    "document.querySelector('[aria-label=\"Next product image\"]').click()",
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[aria-label=\"Choose product image\"] button')[0].getAttribute('aria-pressed')",
    ),
    "true",
  );
  await evaluate(
    "document.querySelector('[aria-label=\"Expand product image\"]').click()",
  );
  await waitFor(
    () => evaluate("Boolean(document.querySelector('dialog[open]'))"),
    "image viewer opened",
  );
  assert.equal(
    await evaluate("document.activeElement.getAttribute('aria-label')"),
    "Close image viewer",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await waitFor(
    () => evaluate("!document.querySelector('dialog[open]')"),
    "Escape closes viewer",
  );
  assert.equal(await evaluate("document.body.style.overflow"), "");
  await waitFor(
    () =>
      evaluate(
        `Boolean(document.querySelector('[aria-label="Related equipment"] a[href="/products/${fixture.otherId}"]'))`,
      ),
    "persisted combo recommendation",
  );
  const screenshots = mkdtempSync(
    path.join(tmpdir(), "durafit-product-detail-"),
  );
  for (const width of [1440, 768, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width === 390,
    });
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
      true,
      `no overflow at ${width}px`,
    );
    const capture = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(
      path.join(screenshots, `${width}.png`),
      Buffer.from(capture.data, "base64"),
    );
  }

  await send("Page.navigate", { url: "http://127.0.0.1:15191/products" });
  await waitFor(
    () => evaluate("Boolean(document.querySelector('main'))"),
    "admin update context",
  );
  await evaluate(`(async()=>{
    const {apiRequest}=await import('/src/api/client.ts');
    const p=(await apiRequest('/products/${fixture.id}')).data;
    await apiRequest('/products/${fixture.id}','PUT',{edit_token:p.edit_token,name:p.name,sku:p.sku,brand_id:p.brand.id,category_id:p.category.id,product_type_id:p.product_type.id,mrp_price:'50000.00',sale_price:'35000.00',description:'<p>Updated persisted description.</p>',is_active:true});
    await apiRequest('/products/${fixture.id}/attributes/${fixture.specId}','PUT',{attribute_id:${JSON.stringify(fixture.attributeId)},value:'4 Peak',sort_order:0});
  })()`);
  await send("Page.navigate", {
    url: `http://127.0.0.1:15193/products/${fixture.id}`,
  });
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=product-specifications] dd')?.textContent==='4 Peak HP'",
      ),
    "updated persisted specification",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=product-highlights] dd').textContent",
    ),
    "4 Peak HP",
  );
  assert.match(
    await evaluate(
      "document.querySelector('.product-intro .product-price strong').textContent",
    ),
    /35,000/,
  );
  assert.match(
    await evaluate(
      "document.querySelector('.product-description').textContent",
    ),
    /Updated persisted description/,
  );
  await send("Page.reload");
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=product-highlights] dd')?.textContent==='4 Peak HP'",
      ),
    "direct reload keeps saved values",
  );

  await send("Page.navigate", {
    url: `http://127.0.0.1:15193/products/${fixture.otherId}`,
  });
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('.product-intro h1')?.textContent==='Simple Equipment'",
      ),
    "minimal product detail",
  );
  assert.equal(
    await evaluate(
      "Boolean(document.querySelector('[aria-label=\"Expand product image\"]'))",
    ),
    false,
  );
  assert.match(
    await evaluate(
      "document.querySelector('#product-specifications').textContent",
    ),
    /Specifications have not been provided/,
  );
  assert.match(
    await evaluate("document.querySelector('#product-details').textContent"),
    /description has not been provided/,
  );
  await send("Page.navigate", {
    url: "http://127.0.0.1:15193/products/00000000-0000-0000-0000-000000000000",
  });
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[role=alert]')?.textContent.includes('no longer available')",
      ),
    "unavailable product error",
  );
  assert.deepEqual(exceptions, []);
  console.log(
    "Product detail: real Admin/API persistence, gallery, modal keyboard handling, pricing, specifications/highlights, recommendations, reload, empty/error states and responsive widths passed (isolated SQLite).",
  );
  console.log(`Product detail screenshots: ${screenshots}`);
}
