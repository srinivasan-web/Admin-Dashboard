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
  seedPresentation,
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
    const attribute=(await apiRequest('/attributes','POST',{name:'Motor',slug:'motor',icon:'motor',data_type:'text',unit:'HP',is_active:true,is_filterable:true,sort_order:0})).data;
    const speedAttribute=(await apiRequest('/attributes','POST',{name:'Speed range',slug:'speed-range',icon:'speed',data_type:'text',unit:'km/h',is_active:true,is_filterable:false,sort_order:1})).data;
    const product=(await apiRequest('/products','POST',{name:'Detail Treadmill',slug:'detail-treadmill',sku:'DETAIL-001',brand_id:brand.id,product_type_id:type.id,category_id:category.id,mrp_price:'50000.00',sale_price:'40000.00',description:'<p>Built for home training. <strong>Keep moving.</strong></p>',short_description:'Synthetic equipment description for browser verification.',details:[{title:'Stored feature section',content:'<p>Persisted feature information.</p>',sort_order:0,is_active:true}],additional_details:{model_number:'DETAIL-MODEL-001',country_of_origin:'Synthetic origin',manufactured_by:'Synthetic manufacturer for testing only',consumer_complaints:'Synthetic support contact for testing only.'},tag:'New',is_active:true})).data;
    await apiRequest('/warehouses/'+warehouse.id+'/products/'+product.id+'/stock','PUT',{quantity:5});
    const lender=(await apiRequest('/finance/emi-providers','POST',{name:'Synthetic Browser Lender',code:'browser-lender',is_active:true})).data;
    for (const months of [6,12]) {
      const plan=(await apiRequest('/finance/emi-plans','POST',{provider_id:lender.id,tenure_months:months,annual_interest_rate:0,processing_fee:0,minimum_amount:100,maximum_amount:null,is_no_cost:false,is_active:true})).data;
      await apiRequest('/finance/product-emi-plans','POST',{product_id:product.id,emi_plan_id:plan.id,is_active:true,sort_order:months});
    }
    const sale=(await apiRequest('/finance/flash-sales','POST',{name:'Synthetic Browser Flash Sale',starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),is_active:true})).data;
    await apiRequest('/finance/flash-sale-products','POST',{flash_sale_id:sale.id,product_id:product.id,discount_type:'price',discount_value:'38000.00',is_active:true});
    await apiRequest('/product-offers','POST',{scope_type:'product',product_id:product.id,title:'Verified launch code',description:'Saved test offer terms.',offer_type:'coupon',coupon_code:'detail100',discount_type:'fixed',discount_value:'1000',minimum_order_amount:'2000',is_active:true,sort_order:0});
    await apiRequest('/product-offers','POST',{scope_type:'category',category_id:category.id,title:'Category offer',description:'Published without a coupon code.',offer_type:'promotion',is_active:true,sort_order:1});
    await apiRequest('/product-offers','POST',{scope_type:'product',product_id:product.id,title:'Hidden draft',offer_type:'coupon',coupon_code:'HIDDEN100',is_active:false,sort_order:2});
    const spec=(await apiRequest('/products/'+product.id+'/attributes','POST',{attribute_id:attribute.id,value:'3 Peak',sort_order:0})).data;
    const speedSpec=(await apiRequest('/products/'+product.id+'/attributes','POST',{attribute_id:speedAttribute.id,value:'18',sort_order:1})).data;
    await apiRequest('/products/'+product.id+'/highlights','PUT',{highlights:[{product_attribute_id:spec.id,sort_order:0,is_active:true},{product_attribute_id:speedSpec.id,sort_order:1,is_active:true}]});
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
    await apiRequest('/merchandising/bestsellers/products','POST',{product_id:other.id,sort_order:0});
    return {id:product.id,slug:product.slug,otherId:other.id,typeId:type.id,specId:spec.id,attributeId:attribute.id,warehouseId:warehouse.id,lenderId:lender.id};
  })()`);
  seedPresentation(fixture);
  await send("Page.navigate", { url: "http://127.0.0.1:15191/finance" });
  await waitFor(() => evaluate("document.querySelector('h1')?.textContent==='EMI & Flash Sales' && document.querySelector('tbody')?.textContent.includes('Synthetic Browser Lender')"), "authenticated finance management route");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Add providers').click()");
  await waitFor(() => evaluate("Boolean(document.querySelector('form[aria-label=\"Finance configuration\"]'))"), "provider create form");
  await evaluate(`(()=>{
    for(const [id,value] of [['approved-provider-name','UI Draft Lender'],['unique-provider-code','INVALID-CODE']]){
      const input=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  })()`);
  await evaluate("document.querySelector('form[aria-label=\"Finance configuration\"]').requestSubmit()");
  await waitFor(() => evaluate("document.getElementById('unique-provider-code')?.getAttribute('aria-invalid')==='true'"), "server validation appears against provider field");
  await evaluate(`(()=>{const input=document.getElementById('unique-provider-code');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'ui-draft-lender');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate("document.querySelector('form[aria-label=\"Finance configuration\"]').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('form[aria-label=\"Finance configuration\"]') && document.querySelector('tbody')?.textContent.includes('UI Draft Lender')"), "draft provider saved and listed");
  await evaluate("[...document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('UI Draft Lender')).querySelector('button').click()");
  await waitFor(() => evaluate("document.getElementById('approved-provider-name')?.value==='UI Draft Lender'"), "persisted provider edit values");
  await evaluate(`(()=>{const input=document.getElementById('approved-provider-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Updated UI Draft Lender');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate("document.querySelector('form[aria-label=\"Finance configuration\"]').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('form[aria-label=\"Finance configuration\"]') && document.querySelector('tbody')?.textContent.includes('Updated UI Draft Lender')"), "provider update persisted");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='EMI plans').click()");
  await waitFor(() => evaluate("document.querySelector('tbody')?.textContent.includes('6 months')"), "persisted EMI plan list");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Add emi plans').click()");
  await waitFor(() => evaluate(`Boolean(document.querySelector('select#provider option[value="${fixture.lenderId}"]'))`), "real provider choices for plan creation");
  await evaluate(`(()=>{
    const provider=document.getElementById('provider');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(provider,${JSON.stringify(fixture.lenderId)});provider.dispatchEvent(new Event('change',{bubbles:true}));
    const tenure=document.getElementById('tenure-(months)');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(tenure,'3');tenure.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await evaluate("document.querySelector('form[aria-label=\"Finance configuration\"]').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('form[aria-label=\"Finance configuration\"]') && document.querySelector('tbody')?.textContent.includes('3 months')"), "draft EMI plan saved through admin form");
  for (const [label,section,text] of [['Product plans','product-emi-plans','Detail Treadmill'],['Flash sales','flash-sales','Synthetic Browser Flash Sale'],['Sale products','flash-sale-products','Detail Treadmill']]) {
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
    await waitFor(() => evaluate(`location.search.includes(${JSON.stringify(section)}) && document.querySelector('tbody')?.textContent.includes(${JSON.stringify(text)}) && ![...document.querySelectorAll('[role=status]')].some(e=>e.textContent.startsWith('Loading '))`), `${label} loads real configuration`);
  }
  await send("Page.reload");
  await waitFor(() => evaluate("location.search.includes('flash-sale-products') && document.querySelector('tbody')?.textContent.includes('Detail Treadmill')"), "finance tab direct reload");
  for (const width of [1440,390]) {
    await send("Emulation.setDeviceMetricsOverride", {width,height:1000,deviceScaleFactor:1,mobile:width===390});
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true,`finance workspace no overflow at ${width}px`);
  }
  await send("Emulation.setDeviceMetricsOverride", {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await startStorefront();
  await send("Page.navigate", {
    url: `http://127.0.0.1:15193/products/${fixture.slug}`,
  });
  await waitFor(
    () =>
      evaluate(
        "document.querySelector('.product-intro h1')?.textContent==='Detail Treadmill'",
      ),
    "persisted product detail",
  );
  await waitFor(() => evaluate("Boolean(document.querySelector('[aria-label=\"Price and availability\"] .product-price strong'))"), "current server price");
  assert.match(
    await evaluate(
      "document.querySelector('[aria-label=\"Price and availability\"] .product-price strong').textContent",
    ),
    /38,000/,
  );
  assert.equal(
    await evaluate("document.querySelector('.product-discount').textContent"),
    "24% off",
  );
  assert.match(
    await evaluate("document.querySelector('.availability').textContent"),
    /5 available/,
  );
  await waitFor(() => evaluate("document.querySelector('#emi-calculator')?.textContent.includes('₹6,333.33')"), "backend-calculated six-month EMI on flash price");
  await evaluate("[...document.querySelectorAll('#emi-calculator button')].find(b=>b.textContent.includes('12M')).click()");
  await waitFor(() => evaluate("document.querySelector('#emi-calculator')?.textContent.includes('₹3,166.67')"), "tenure change recalculates persisted price");
  assert.equal(await evaluate("Boolean(document.querySelector('[role=timer]'))"), true);
  await evaluate(`(()=>{
    const input=document.getElementById('emi-mobile');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'9876543210');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#emi-calculator input[type=checkbox]').click();
  })()`);
  await evaluate("document.querySelector('#emi-calculator form').requestSubmit()");
  await waitFor(() => evaluate("document.querySelector('#emi-calculator')?.textContent.includes('Your EMI enquiry has been recorded.')"), "consented enquiry persistence");
  assert.equal(await evaluate("document.querySelector('[aria-describedby=checkout-status]').disabled"), true);
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=product-highlights] dd').textContent",
    ),
    "3 Peak HP",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('[data-testid=product-highlights] > div').length"),
    2,
  );
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=product-highlights] .lucide-zap'))"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=product-highlights] .lucide-gauge'))"), true);
  assert.equal(await evaluate("document.querySelectorAll('[data-testid=product-highlights] dd')[1].textContent"), "18 km/h");
  assert.equal(
    await evaluate("document.querySelector('[data-testid=product-highlight-card] h1').textContent"),
    "Detail Treadmill",
  );
  assert.equal(
    await evaluate("document.querySelector('[data-testid=product-highlight-description]').textContent.trim()"),
    "Synthetic equipment description for browser verification.",
  );
  await waitFor(() => evaluate("document.querySelectorAll('[data-testid=product-offer]').length===2"), "published product and category offers");
  assert.equal(await evaluate("document.querySelector('[data-testid=offer-code]').textContent"), "DETAIL100");
  assert.equal(await evaluate("document.querySelectorAll('[data-testid=product-offer] button').length"), 1, "code-free promotion has no copy button");
  assert.doesNotMatch(await evaluate("document.querySelector('[data-testid=product-offers]').textContent"), /Hidden draft/);
  await evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedOfferCode=value;}}})");
  await evaluate("document.querySelector('[aria-label=\"Copy coupon code DETAIL100\"]').click()");
  await waitFor(() => evaluate("window.__copiedOfferCode==='DETAIL100' && document.querySelector('[data-testid=product-offers] [role=status]')?.textContent.includes('copied')"), "copy-code success feedback");
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
  await evaluate("document.querySelector('[aria-label=\"Zoom in product image\"]').click()");
  await waitFor(() => evaluate("document.querySelector('[aria-label=\"Zoom out product image\"]')?.getAttribute('aria-pressed')==='true' && document.querySelector('#product-image-viewport').scrollWidth > document.querySelector('#product-image-viewport').clientWidth"), "image zoom supports panning");
  await evaluate("document.querySelector('[aria-label=\"Zoom out product image\"]').click()");
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
  assert.equal(await evaluate("document.querySelectorAll('[role=tablist][aria-label=\"Product information\"]').length"), 1, "background refresh keeps one information section");
  assert.match(await evaluate("document.querySelector('[data-testid=product-declarations]').textContent"), /DETAIL-MODEL-001/);
  assert.match(await evaluate("document.querySelector('[data-testid=product-benefits]').textContent"), /Synthetic warranty benefit/);
  assert.doesNotMatch(await evaluate("document.querySelector('[data-testid=product-benefits]').textContent"), /Unpublished test benefit/);
  assert.match(await evaluate("document.querySelector('#product-details').textContent"), /Persisted feature information/);
  await evaluate("document.querySelector('#product-specifications-tab').focus(); document.querySelector('#product-specifications-tab').click()");
  try {
    await waitFor(() => evaluate("!document.querySelector('#product-specifications').hidden && document.querySelector('#product-details').hidden"), "specification tab displays persisted data");
  } catch (error) {
    const state = await evaluate("({href:location.href,tabs:[...document.querySelectorAll('[role=tab]')].map(tab=>({id:tab.id,selected:tab.getAttribute('aria-selected')})),panels:[...document.querySelectorAll('[role=tabpanel]')].map(panel=>({id:panel.id,hidden:panel.hidden})),error:document.querySelector('[role=alert]')?.textContent})");
    throw new Error(`${error.message}: ${JSON.stringify(state)}`);
  }
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
  await waitFor(() => evaluate("document.querySelector('#product-details-tab').getAttribute('aria-selected')==='true' && document.activeElement.id==='product-details-tab'"), "tabs support arrow-key navigation");
  await evaluate("document.querySelector('a[href=\"#product-specifications\"]').click()");
  await waitFor(() => evaluate("!document.querySelector('#product-specifications').hidden"), "summary specification link activates matching panel");
  await evaluate("document.querySelector('#product-details-tab').click()");
  await waitFor(() => evaluate("Boolean(document.querySelector('[data-testid=product-comparison]'))"), "persisted category comparison configuration");
  assert.match(await evaluate("document.querySelector('[data-testid=product-comparison]').textContent"), /Motor output/);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-testid=product-comparison] tbody td')].map(cell=>cell.textContent)"), ["3 Peak HP", "Not provided"]);
  await waitFor(
    () =>
      evaluate(
        `Boolean(document.querySelector('[aria-label="Related equipment"] a[href="/products/${fixture.otherId}"]'))`,
      ),
    "persisted combo recommendation",
  );
  assert.equal(
    await evaluate("Boolean([...document.querySelectorAll('button')].find(button => button.textContent.includes('Share product')))"),
    true,
  );
  await waitFor(
    () =>
      evaluate(
        `Boolean(document.querySelector('[aria-label="Bestsellers"] a[href="/products/${fixture.otherId}"]'))`,
      ),
    "persisted bestseller placement",
  );
  await waitFor(() => evaluate("Boolean(document.querySelector('[data-testid=product-faqs] details'))"), "published category FAQ");
  await evaluate("document.querySelector('[data-testid=product-faqs] summary').click()");
  assert.match(await evaluate("document.querySelector('[data-testid=product-faqs]').textContent"), /Use the stored test manual/);
  assert.doesNotMatch(await evaluate("document.querySelector('[data-testid=product-faqs]').textContent"), /Unpublished test question/);
  await waitFor(() => evaluate("Boolean(document.querySelector('[data-testid=shop-benefits] li'))"), "published shop benefit");
  assert.match(await evaluate("document.querySelector('[data-testid=shop-benefits]').textContent"), /Verified test shopping information/);
  assert.doesNotMatch(await evaluate("document.querySelector('[data-testid=shop-benefits]').textContent"), /Unpublished shopping claim/);
  assert.match(await evaluate("document.querySelector('#product-support').textContent"), /Synthetic support contact/);
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
    await evaluate("document.activeElement?.blur(); history.replaceState({},'',location.pathname+location.search); window.scrollTo({top:0,behavior:'instant'})");
    try {
      await waitFor(() => evaluate("new Promise(resolve=>{window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>resolve(Math.abs(window.scrollY)<1 && !document.querySelector('[data-testid=product-detail] > [role=status]')));})"), "stable product screenshot");
    } catch (error) {
      const state = await evaluate("({scrollY,scrollTop:document.scrollingElement.scrollTop,width:innerWidth,hash:location.hash,status:[...document.querySelectorAll('[data-testid=product-detail] > [role=status]')].map(e=>e.textContent)})");
      throw new Error(`${error.message}: ${JSON.stringify(state)}`);
    }
    await evaluate("Promise.all([...document.images].filter(image=>image.complete && image.naturalWidth>0).map(image=>image.decode().catch(()=>{})))");
    const metrics = await send("Page.getLayoutMetrics");
    const capture = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(metrics.cssContentSize.height), scale: 1 } });
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
    await apiRequest('/products/${fixture.id}','PUT',{edit_token:p.edit_token,name:p.name,sku:p.sku,brand_id:p.brand.id,category_id:p.category.id,product_type_id:p.product_type.id,mrp_price:'50000.00',sale_price:'35000.00',short_description:null,description:'<p>Updated persisted description.</p>',is_active:true});
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
  await waitFor(() => evaluate("document.querySelector('[aria-label=\"Price and availability\"] .product-price strong')?.textContent.includes('35,000')"), "updated server price");
  assert.equal(
    await evaluate(
      "document.querySelector('[data-testid=product-highlights] dd').textContent",
    ),
    "4 Peak HP",
  );
  assert.match(
    await evaluate(
      "document.querySelector('[aria-label=\"Price and availability\"] .product-price strong').textContent",
    ),
    /35,000/,
  );
  assert.equal(await evaluate("Boolean(document.querySelector('[role=timer]'))"), false);
  assert.match(
    await evaluate(
      "document.querySelector('.product-description').textContent",
    ),
    /Updated persisted description/,
  );
  assert.equal(
    await evaluate("document.querySelector('[data-testid=product-highlight-description]').textContent.trim()"),
    "Updated persisted description.",
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
  assert.equal(await evaluate("Boolean(document.querySelector('[role=tablist][aria-label=\"Product information\"]'))"), false, "empty detail cards are hidden from customers");
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=product-declarations]'))"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=product-highlights]'))"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=product-highlight-description]'))"), false);
  await send("Page.navigate", { url: "http://127.0.0.1:15191/products" });
  await waitFor(() => evaluate("Boolean(document.querySelector('main'))"), "admin fallback-specification context");
  await evaluate(`(async()=>{
    const {apiRequest}=await import('/src/api/client.ts');
    await apiRequest('/products/${fixture.otherId}/attributes','POST',{attribute_id:${JSON.stringify(fixture.attributeId)},value:'2 Peak',sort_order:0});
  })()`);
  await send("Page.navigate", { url: `http://127.0.0.1:15193/products/${fixture.otherId}` });
  await waitFor(() => evaluate("document.querySelector('[data-testid=product-highlights] dd')?.textContent==='2 Peak HP'"), "specification fallback without selected highlights");
  await send("Page.navigate", { url: "http://127.0.0.1:15191/finance?section=emi-enquiries" });
  await waitFor(() => evaluate("document.querySelector('tbody')?.textContent.includes('******3210')"), "consented enquiry appears in admin with masked contact");
  assert.doesNotMatch(await evaluate("document.querySelector('tbody').textContent"),/9876543210/);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='View contact').click()");
  await waitFor(() => evaluate("document.querySelector('[aria-label=\"Enquiry contact\"]')?.textContent.includes('9876543210')"), "authorized contact reveal");
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
    "Product detail: real Admin/API persistence, gallery zoom/pan, keyboard tabs, pricing, specifications/highlights, benefits, legal declarations, aligned comparison, recommendations, reload, empty/error states and responsive widths passed (isolated SQLite).",
  );
  console.log(`Product detail screenshots: ${screenshots}`);
}
