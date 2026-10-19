// Invoked by the existing isolated Laravel/Vite/Chrome harness:
// node admin/tests/catalogNavigation.browser.mjs <php.exe> --need-selector-only
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export async function verifyNeedSelector({
  send,
  evaluate,
  waitFor,
  pause,
  startStorefront,
  exceptions,
}) {
  await waitFor(
    () => evaluate("Boolean(document.querySelector('input[type=password]'))"),
    "test admin entry",
  );
  const password = randomBytes(20).toString("hex");
  const fixture = await evaluate(`(async()=>{
    const {registerInitialAdmin}=await import('/src/api/adminAuth.ts');
    const {apiRequest,apiFormRequest}=await import('/src/api/client.ts');
    await registerInitialAdmin({name:'Need Selector Verification',email:'needs@example.test',password:${JSON.stringify(password)},password_confirmation:${JSON.stringify(password)}});
    const brand=(await apiRequest('/brands','POST',{name:'Need Test Brand',slug:'need-test-brand'})).data;
    const type=(await apiRequest('/product-types','POST',{name:'Need Test Type',slug:'need-test-type',is_active:true})).data;
    const category=(await apiRequest('/categories','POST',{name:'Treadmills',slug:'treadmills',is_active:true})).data;
    const warehouse=(await apiRequest('/warehouses','POST',{name:'Need Test Warehouse',address:'Test address',city:'Trichy',state:'Tamil Nadu',postal_code:'620015'})).data;
    const attribute=(await apiRequest('/attributes','POST',{name:'Equipment Dimensions',slug:'equipment-dimensions',data_type:'text',unit:'cm',is_active:true,is_filterable:true,sort_order:0})).data;
    const products=[];
    for(let index=0;index<2;index++){
      const product=(await apiRequest('/products','POST',{name:'Need Test Product '+index,sku:'NEED-TEST-'+index,brand_id:brand.id,product_type_id:type.id,category_id:category.id,mrp_price:'20000.00',sale_price:index?'10000.00':'15000.00',is_active:true})).data;
      await apiRequest('/warehouses/'+warehouse.id+'/products/'+product.id+'/stock','PUT',{quantity:2});
      await apiRequest('/products/'+product.id+'/attributes','POST',{attribute_id:attribute.id,value:'160 x 75',sort_order:0,show_on_top:true});
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.getContext('2d').fillRect(0,0,64,64);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const image=new FormData();image.set('image',new File([blob],'need-test.png',{type:'image/png'}));image.set('is_primary','1');
      await apiFormRequest('/products/'+product.id+'/images',image);
      if(index===0){canvas.getContext('2d').fillStyle='#ff6b1a';canvas.getContext('2d').fillRect(0,0,64,64);const extraBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const extraImage=new FormData();extraImage.set('image',new File([extraBlob],'need-test-extra.png',{type:'image/png'}));await apiFormRequest('/products/'+product.id+'/images',extraImage);}
      await apiRequest('/merchandising/featured/products','POST',{product_id:product.id,sort_order:index,is_active:true});
      products.push(product.id);
    }
    return {products,categoryId:category.id};
  })()`);
  await startStorefront();
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: "http://127.0.0.1:15193/" });
  await waitFor(
    () =>
      evaluate(
        "Boolean(document.querySelector('[data-testid=need-product-caption] a'))",
      ),
    "persisted merchandising preview",
  );
  await waitFor(
    () =>
      evaluate(
        `document.querySelector('[data-testid=product-type-card]')?.getAttribute('href')===${JSON.stringify(`/products?category_id=${fixture.categoryId}`)}`,
      ),
    "live category card destination",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=product-type-section] h2').innerText",
    ),
    "Explore equipment",
    "product-type section heading",
  );
  await waitFor(
    () => evaluate("Boolean(document.querySelector('#featured .product-card .card-highlights dd'))"),
    "persisted product card highlights",
  );
  assert.equal(
    await evaluate("document.querySelector('#featured [data-testid=product-collection-carousel]')?.getAttribute('aria-roledescription')"),
    "carousel",
    "featured collection uses the accessible product slider",
  );
  assert.equal(
    await evaluate("document.querySelector('#featured .product-collection-slide')?.getAttribute('aria-roledescription')"),
    "slide",
    "collection products are announced as slides",
  );
  assert.equal(
    await evaluate("document.querySelector('#featured .product-card .card-highlights dt').textContent"),
    "Equipment Dimensions",
  );
  assert.equal(
    await evaluate("document.querySelector('#featured .product-card .card-highlights dd').textContent"),
    "160 x 75 cm",
  );
  assert.match(
    await evaluate("document.querySelector('#featured .product-card .product-price strong').textContent"),
    /15,000/,
  );
  assert.match(
    await evaluate("document.querySelector('#featured .product-card .product-price del').textContent"),
    /20,000/,
  );
  assert.equal(
    await evaluate("document.querySelector('#featured .product-card .product-discount').textContent"),
    "25% off",
  );
  assert.equal(
    await evaluate("document.querySelector('#featured .product-card .product-card-cta').getAttribute('href')"),
    `/products/${fixture.products[0]}`,
  );
  const primaryCardImage = await evaluate(
    "document.querySelector('#featured .product-card .product-image img').getAttribute('src')",
  );
  assert.match(primaryCardImage, /\/storage\//);
  assert.equal(
    await evaluate("document.querySelector('#featured .product-card .product-image img').getAttribute('src')"),
    primaryCardImage,
    "product cards retain the persisted primary image",
  );
  assert.equal(
    await evaluate("Boolean(document.querySelector('#featured .product-card .card-gallery-controls'))"),
    false,
    "product cards do not expose an image gallery",
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('[data-testid=product-type-slider]')).flexWrap",
    ),
    "nowrap",
    "product types stay in a single horizontal row",
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-testid=product-type-card] [aria-hidden=true] svg').length>=9",
    ),
    true,
    "every product-type card includes its arrow treatment",
  );
  await evaluate(
    "document.querySelector('[data-testid=product-type-slider]').focus()",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=product-type-slider]').scrollLeft>0",
      ),
    "keyboard product-type slider navigation",
  );
  await evaluate(
    "document.querySelector('button[aria-label=\"Show previous product types\"]').click()",
  );
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=product-type-slider]').scrollLeft===0",
      ),
    "previous product-type control",
  );
  const cardAssets = await evaluate(
    `[...document.querySelectorAll('[data-testid=product-type-card]')].map(card=>[card.getAttribute('aria-label'),card.querySelector('img')?.getAttribute('src')])`,
  );
  const expectedCardAssets = [
      ["Explore Treadmills", "cat-treadmill"],
      ["Ellipticals: explore all equipment", "cat-elleptical"],
      ["Spin Bikes: explore all equipment", "cat-spin-bike"],
      ["Massagers: explore all equipment", "cat-massager"],
      ["Accessories: explore all equipment", "cat_accessory"],
      ["Combo Kits: explore all equipment", "combo-kits"],
      ["Strength Machines: explore all equipment", "abductor-machine"],
      ["Walkpads: explore all equipment", "cat-walkpad"],
      ["Discover: explore all equipment", "tiles-discover"],
  ];
  assert.equal(cardAssets.length, expectedCardAssets.length);
  for (const [index, [label, filename]] of expectedCardAssets.entries()) {
    assert.equal(cardAssets[index][0], label);
    assert.ok(cardAssets[index][1]?.includes(filename), `${label} image mapping`);
  }
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=product-type-card]:last-child').getAttribute('href')",
    ),
    "/products",
  );
  await evaluate("document.querySelector('[data-testid=product-type-card]').focus()");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await waitFor(
    () =>
      evaluate(
        `location.pathname==='/products' && new URLSearchParams(location.search).get('category_id')===${JSON.stringify(fixture.categoryId)} && Boolean(document.querySelector('.product-card'))`,
      ),
    "keyboard category navigation reaches persisted catalog products",
  );
  assert.equal(
    await evaluate("document.querySelector('.catalog-heading h1')?.textContent"),
    "Treadmills",
    "category listing uses the persisted category title",
  );
  await waitFor(
    () => evaluate("document.querySelector('.catalog-attribute-filter legend')?.textContent.includes('Equipment Dimensions')"),
    "category listing derives specification filters from persisted attributes",
  );
  assert.equal(
    await evaluate("document.querySelector('.catalog-count strong')?.textContent"),
    "2 products",
    "listing count comes from the paginated API",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitFor(
    () => evaluate("getComputedStyle(document.querySelector('.catalog-mobile-filter-toggle')).display !== 'none'"),
    "mobile catalog filter control",
  );
  await evaluate("document.querySelector('.catalog-mobile-filter-toggle').click()");
  assert.equal(
    await evaluate("document.querySelector('.catalog-filter-panel')?.getAttribute('role')"),
    "dialog",
    "mobile filters open as an accessible drawer",
  );
  await evaluate("document.querySelector('.catalog-filter-close').click()");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate("history.back()");
  await waitFor(
    () =>
      evaluate(
        "Boolean(document.querySelector('[data-testid=product-type-section]') && document.querySelector('[data-testid=need-specification]') && document.querySelector('[data-testid=need-product-caption] a'))",
      ),
    "return to loaded homepage",
  );
  assert.match(
    await evaluate(
      "document.querySelector('[data-testid=need-specification]').innerText",
    ),
    /160 x 75 cm/,
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=need-product-caption] a').getAttribute('href')",
    ),
    `/products/${fixture.products[0]}`,
  );
  const requestCount = await evaluate(
    "performance.getEntriesByType('resource').filter(item=>item.name.includes('/api/v1/merchandising/')).length",
  );
  for (const id of [
    "space",
    "routine",
    "budget",
    "household",
    "practicalities",
    "support",
  ]) {
    await evaluate(
      `document.querySelectorAll('[data-testid=need-option]')[${["space", "routine", "budget", "household", "practicalities", "support"].indexOf(id)}].click()`,
    );
    await waitFor(
      () =>
        evaluate(
          `document.querySelector('[data-testid=need-panel]')?.dataset.need===${JSON.stringify(id)}`,
        ),
      `select ${id}`,
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-testid=need-option][aria-pressed=true]').length",
      ),
      1,
    );
    const href = await evaluate(
      "document.querySelector('[data-testid=need-actions] a').getAttribute('href')",
    );
    assert.ok(
      href.startsWith("/products") ||
        href === "https://www.durafit91.com/91wiz",
    );
    if (id === "budget") {
      assert.equal(href, "/products?sort=price_asc");
      assert.equal(
        await evaluate(
          "document.querySelector('[data-testid=need-product-caption] a').getAttribute('href')",
        ),
        `/products/${fixture.products[1]}`,
      );
    }
  }
  assert.equal(
    await evaluate(
      "performance.getEntriesByType('resource').filter(item=>item.name.includes('/api/v1/merchandising/')).length",
    ),
    requestCount,
    "selection reuses existing homepage reads",
  );

  // Real keyboard selection, without forcing application state.
  await evaluate(
    "document.querySelectorAll('[data-testid=need-option]')[2].focus()",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=need-panel]').dataset.need==='budget'",
      ),
    "keyboard activation",
  );
  await evaluate(
    "document.querySelector('[data-testid=need-actions] a').click()",
  );
  await waitFor(
    () =>
      evaluate(
        "location.pathname==='/products' && location.search.includes('sort=price_asc') && Boolean(document.querySelector('.product-card'))",
      ),
    "price-sorted catalog navigation",
  );
  assert.match(
    await evaluate("document.querySelector('.product-card h3').innerText"),
    /Product 1/,
  );
  await evaluate("history.back()");
  await waitFor(
    () =>
      evaluate(
        "location.pathname==='/' && Boolean(document.querySelector('[data-testid=need-product-caption] a'))",
      ),
    "browser back to homepage",
  );
  await evaluate(
    "document.querySelector('[data-testid=need-actions] a').click()",
  );
  await waitFor(
    () => evaluate("Boolean(document.querySelector('.specifications'))"),
    "product detail specifications",
  );
  assert.match(
    await evaluate("document.querySelector('.specifications').innerText"),
    /160 x 75 cm/,
  );
  await send("Page.navigate", { url: "http://127.0.0.1:15193/" });
  await waitFor(
    () =>
      evaluate("Boolean(document.querySelector('[data-testid=need-panel]'))"),
    "homepage return",
  );

  const previews = mkdtempSync(
    path.join(tmpdir(), "durafit-need-selector-preview-"),
  );
  for (const width of [1440, 1024, 768, 390, 320]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await pause(100);
    assert.ok(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      `no horizontal overflow at ${width}px`,
    );
    assert.equal(
      await evaluate(
        "getComputedStyle(document.querySelector('[data-testid=product-type-slider]')).flexWrap",
      ),
      "nowrap",
      `product-type slider does not wrap at ${width}px`,
    );
    assert.ok(
      await evaluate(
        "document.querySelector('[data-testid=product-type-slider]').scrollWidth>document.querySelector('[data-testid=product-type-slider]').clientWidth",
      ),
      `product-type slider remains horizontally scrollable at ${width}px`,
    );
    if (width === 320) {
      await waitFor(
        () => evaluate("Boolean(document.querySelector('#featured .product-collection-arrow[aria-label^=\"Show next\"]'))"),
        "product collection carousel controls at mobile width",
      );
      await evaluate("document.querySelector('#featured .product-collection-arrow[aria-label^=\"Show next\"]')?.click()");
      await waitFor(
        () => evaluate("document.querySelector('#featured [data-testid=product-collection-track]').scrollLeft > 0"),
        "mobile product collection next-slide navigation",
      );
      await evaluate("document.querySelector('#featured .product-collection-arrow[aria-label^=\"Show previous\"]')?.click()");
      await waitFor(
        () => evaluate("document.querySelector('#featured [data-testid=product-collection-track]').scrollLeft === 0"),
        "mobile product collection previous-slide navigation",
      );
    }
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('[data-testid=need-option]')].every(button=>button.getBoundingClientRect().height>=44)",
      ),
      "accessible touch targets",
    );
    if (width === 1440 || width === 390) {
      await evaluate(
        "document.querySelector('[data-testid=need-selector]').scrollIntoView({block:'start',behavior:'instant'})",
      );
      await pause(150);
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(
        path.join(previews, `${width}.png`),
        Buffer.from(data, "base64"),
      );
      await evaluate(
        "document.querySelector('[data-testid=product-type-section]').scrollIntoView({block:'start',behavior:'instant'})",
      );
      await pause(150);
      const productTypes = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(
        path.join(previews, `product-types-${width}.png`),
        Buffer.from(productTypes.data, "base64"),
      );
    }
  }
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await evaluate(
    "document.querySelectorAll('[data-testid=need-option]')[3].click()",
  );
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=need-panel]').dataset.need==='household'",
      ),
    "reduced motion selection",
  );

  await send("Network.setBlockedURLs", { urls: ["*storage/*"] });
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Page.reload");
  await waitFor(
    () =>
      evaluate(
        "Boolean(document.querySelector('[data-testid=need-product-visual] .image-fallback'))",
      ),
    "unavailable image fallback",
  );
  await send("Network.setBlockedURLs", { urls: ["*/api/v1/merchandising/*"] });
  await send("Page.reload");
  await waitFor(
    () =>
      evaluate(
        "Boolean(document.querySelector('[data-testid=need-data-message] button'))",
      ),
    "API failure guidance and retry",
  );
  assert.ok(
    await evaluate("Boolean(document.querySelector('.hero-carousel'))"),
    "API failure does not hide hero",
  );
  await send("Network.setBlockedURLs", { urls: [] });
  await evaluate(
    "document.querySelector('[data-testid=need-data-message] button').click()",
  );
  await waitFor(
    () =>
      evaluate(
        "Boolean(document.querySelector('[data-testid=need-product-caption] a'))",
      ),
    "retry recovers real persisted preview",
  );

  await send("Network.setCacheDisabled", { cacheDisabled: false });
  await evaluate(`(async()=>{
    const id=${JSON.stringify(fixture.products[0])};
    const otherId=${JSON.stringify(fixture.products[1])};
    const csrf=(await(await fetch('/api/v1/admin/auth/csrf',{headers:{Accept:'application/json'}})).json()).data.csrf_token;
    const productResponse=await fetch('/api/v1/admin/products/'+id,{credentials:'include',headers:{Accept:'application/json'}});
    if(!productResponse.ok)throw new Error('Could not load test product for update');
    const product=(await productResponse.json()).data;
    const headers={Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf};
    const updated=await fetch('/api/v1/admin/products/'+id,{method:'PUT',credentials:'include',headers,body:JSON.stringify({edit_token:product.edit_token,name:'Need Test Product Updated',sku:product.sku,brand_id:product.brand.id,category_id:product.category.id,product_type_id:product.product_type.id,mrp_price:'20000.00',sale_price:'12000.00',tag:'New',is_active:true})});
    if(!updated.ok)throw new Error('Could not update test product: '+updated.status);
    const reordered=await fetch('/api/v1/admin/merchandising/featured/products/'+id,{method:'PUT',credentials:'include',headers,body:JSON.stringify({sort_order:9,is_active:true})});
    if(!reordered.ok)throw new Error('Could not update test placement: '+reordered.status);
    const otherResponse=await fetch('/api/v1/admin/products/'+otherId,{credentials:'include',headers:{Accept:'application/json'}});
    if(!otherResponse.ok)throw new Error('Could not load second test product');
    const other=(await otherResponse.json()).data;
    const equalPrice=await fetch('/api/v1/admin/products/'+otherId,{method:'PUT',credentials:'include',headers,body:JSON.stringify({edit_token:other.edit_token,name:other.name,sku:other.sku,brand_id:other.brand.id,category_id:other.category.id,product_type_id:other.product_type.id,mrp_price:'20000.00',sale_price:'20000.00',is_active:true})});
    if(!equalPrice.ok)throw new Error('Could not update equal-price test product: '+equalPrice.status);
  })()`);
  await send("Page.reload");
  await waitFor(
    () => evaluate(
      "document.querySelector('#featured .product-collection-slide:first-child .product-card h3')?.textContent === 'Need Test Product 1' && document.querySelector('#featured .product-collection-slide:nth-child(2) .product-card h3')?.textContent === 'Need Test Product Updated'",
    ),
    "Admin product edit and placement order reach the next storefront request",
  );
  assert.match(
    await evaluate("document.querySelector('#featured .product-collection-slide:nth-child(2) .product-price strong').textContent"),
    /12,000/,
  );
  assert.equal(
    await evaluate("document.querySelector('#featured .product-collection-slide:nth-child(2) .product-tag').textContent"),
    "New",
  );
  assert.match(
    await evaluate("document.querySelector('#featured .product-collection-slide:first-child .product-price strong').textContent"),
    /20,000/,
  );
  assert.equal(
    await evaluate("Boolean(document.querySelector('#featured .product-collection-slide:first-child .product-discount, #featured .product-collection-slide:first-child .product-price del'))"),
    false,
    "equal MRP and sale price do not create a discount",
  );

  // Remove only test-created placement links, using the actual API and test session.
  await evaluate(`(async()=>{
    const csrf=(await(await fetch('/api/v1/admin/auth/csrf',{headers:{Accept:'application/json'}})).json()).data.csrf_token;
    for(const product of ${JSON.stringify(fixture.products)}){
      const response=await fetch('/api/v1/admin/merchandising/featured/products/'+product,{method:'DELETE',headers:{Accept:'application/json','X-CSRF-TOKEN':csrf}});
      if(!response.ok)throw new Error('Could not clear test placement');
    }
  })()`);
  await send("Page.reload");
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('[data-testid=need-data-message]')?.innerText.includes('New collection picks')",
      ),
    "empty placements retain guidance and catalog link",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=need-actions] a').getAttribute('href')",
    ),
    "/products",
  );
  assert.deepEqual(exceptions, []);
  console.log(
    JSON.stringify(
      {
        needSelector:
          "6 selections; keyboard; real API product/specification/price/media persistence; catalog sorting; product detail; browser back; 320–1440px; reduced motion; image failure; API retry; empty collection; zero extra reads on selection",
        productTypeSection:
          "9 verified asset mappings; real category route, card keyboard navigation and slider controls; single-row responsive scrolling layout",
        database: "disposable SQLite only",
        previews,
        browserErrors: exceptions,
      },
      null,
      2,
    ),
  );
}
