<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\HsnCode;
use App\Models\Media;
use App\Models\Order;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductImage;
use App\Models\ProductType;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\ProductTypeArtworkSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_warehouse_location_is_saved_and_returned_through_admin_api(): void
    {
        $this->actingAs($this->catalogManager());
        $url = '/api/v1/admin/warehouses';
        $location = [
            'name' => 'Trichy', 'address' => 'Verified warehouse address',
            'city' => 'Tiruchirappalli', 'state' => 'Tamil Nadu', 'postal_code' => '620015',
            'latitude' => 10.7629, 'longitude' => 78.7143,
        ];
        $warehouse = $this->postJson($url, $location)->assertCreated()
            ->assertJsonPath('data.postal_code', '620015')->json('data');
        $this->assertDatabaseHas('warehouses', ['id' => $warehouse['id'], 'postal_code' => '620015']);
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.latitude', '10.7629000');
        $this->putJson("{$url}/{$warehouse['id']}", array_merge($location, ['city' => 'Changed']))
            ->assertOk()->assertJsonPath('data.city', 'Changed');
        $this->postJson($url, ['name' => 'Invalid', 'latitude' => 91, 'longitude' => 78])->assertUnprocessable();
    }

    public function test_returns_401_when_an_admin_catalogue_request_is_unauthenticated(): void
    {
        $this->postJson('/api/v1/admin/product-types', ['name' => 'Treadmills'])
            ->assertUnauthorized();
    }

    public function test_returns_403_when_an_admin_lacks_catalogue_permission(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/api/v1/admin/product-types', ['name' => 'Treadmills'])
            ->assertForbidden();
    }

    public function test_catalogue_manager_creates_and_deactivates_a_product_type_through_the_admin_api(): void
    {
        $manager = $this->catalogManager();

        $created = $this->actingAs($manager)
            ->postJson('/api/v1/admin/product-types', [
                'name' => 'Walkpads',
                'description' => 'Compact walking machines.',
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Walkpads')
            ->assertJsonPath('data.is_active', true)
            ->json('data');

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/product-types/{$created['id']}", [
                'name' => 'Walkpads',
                'slug' => 'walkpads',
                'description' => 'Compact walking machines.',
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->actingAs($manager)
            ->getJson('/api/v1/admin/product-types')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'walkpads')
            ->assertJsonPath('data.0.is_active', false);
    }

    public function test_product_type_artwork_is_saved_and_returned_to_the_storefront(): void
    {
        $this->actingAs($this->catalogManager());
        $media = Media::factory()->create([
            'disk' => 'public', 'path' => 'product-types/treadmills.webp', 'mime_type' => 'image/webp',
        ]);

        $type = $this->postJson('/api/v1/admin/product-types', [
            'name' => 'Treadmills', 'slug' => 'treadmills', 'image_media_id' => $media->id,
            'sort_order' => 2, 'is_active' => true,
        ])->assertCreated()->assertJsonPath('data.image_media_id', $media->id)->json('data');

        $this->getJson('/api/v1/admin/product-types')->assertOk()
            ->assertJsonPath('data.0.image_media.original_filename', $media->original_filename);

        $this->getJson('/api/v1/product-types')->assertOk()
            ->assertJsonPath('data.0.name', 'Treadmills');
        $this->assertStringEndsWith('/storage/product-types/treadmills.webp',
            $this->getJson('/api/v1/product-types')->json('data.0.image_url'));
        $this->assertTrue($media->isReferenced());

        $this->putJson('/api/v1/admin/product-types/'.$type['id'], [
            'name' => 'Treadmills', 'slug' => 'treadmills', 'image_media_id' => null,
            'sort_order' => 2, 'is_active' => true,
        ])->assertOk()->assertJsonPath('data.image_url', null);
        $this->assertFalse($media->isReferenced());
        $this->postJson('/api/v1/admin/product-types', [
            'name' => 'Invalid artwork', 'image_media_id' => '00000000-0000-0000-0000-000000000000',
        ])->assertUnprocessable();
    }

    public function test_bundled_artwork_import_is_idempotent_and_does_not_replace_selected_images(): void
    {
        Storage::fake('public');
        $type = ProductType::factory()->create(['slug' => 'treadmills', 'image_media_id' => null]);

        $this->seed(ProductTypeArtworkSeeder::class);
        $firstMediaId = $type->fresh()->image_media_id;
        $this->assertNotNull($firstMediaId);
        Storage::disk('public')->assertExists('product-types/cat-treadmill.webp');

        $this->seed(ProductTypeArtworkSeeder::class);
        $this->assertSame($firstMediaId, $type->fresh()->image_media_id);
        $this->assertSame(1, Media::query()->where('path', 'product-types/cat-treadmill.webp')->count());
    }

    public function test_catalogue_manager_creates_and_updates_an_hsn_code_through_the_admin_api(): void
    {
        $manager = $this->catalogManager();

        $hsnCode = $this->actingAs($manager)
            ->postJson('/api/v1/admin/hsn-codes', [
                'title' => 'Fitness equipment',
                'type' => 'Goods',
                'hsn_code' => '95069190',
                'sgst_tax_multiplier' => '9.00',
                'igst_tax_multiplier' => '18.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.sgst_tax_multiplier', '9.00')
            ->json('data');

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/hsn-codes/{$hsnCode['id']}", [
                'title' => 'Fitness equipment and accessories',
                'type' => 'Goods',
                'hsn_code' => '95069190',
                'sgst_tax_multiplier' => '6.00',
                'igst_tax_multiplier' => '12.00',
            ])
            ->assertOk()
            ->assertJsonPath('data.igst_tax_multiplier', '12.00');

        $this->actingAs($manager)
            ->getJson('/api/v1/admin/hsn-codes')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Fitness equipment and accessories');
    }

    public function test_catalogue_manager_creates_updates_and_deactivates_a_flat_category_through_the_admin_api(): void
    {
        $manager = $this->catalogManager();

        $category = $this->actingAs($manager)
            ->postJson('/api/v1/admin/categories', [
                'name' => 'Home Fitness',
                'description' => 'Equipment for home training.',
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'home-fitness')
            ->json('data');

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/categories/{$category['id']}", [
                'name' => 'Home Fitness Equipment',
                'slug' => 'home-fitness-equipment',
                'description' => 'Equipment for training at home.',
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->actingAs($manager)
            ->getJson('/api/v1/admin/categories')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Home Fitness Equipment')
            ->assertJsonPath('data.0.is_active', false);
    }

    public function test_category_image_and_order_flow_from_admin_to_public_list_without_changing_product_relationships(): void
    {
        $this->actingAs($this->catalogManager());
        $media = Media::factory()->create(['disk' => 'public', 'path' => 'categories/treadmills.jpg', 'mime_type' => 'image/jpeg']);

        $treadmills = $this->postJson('/api/v1/admin/categories', [
            'name' => 'Treadmills', 'slug' => 'treadmills', 'description' => 'Run at home.',
            'sort_order' => 20, 'image_media_id' => $media->id, 'is_active' => true,
        ])->assertCreated()->assertJsonPath('data.image_media_id', $media->id)
            ->assertJsonPath('data.sort_order', 20)->json('data');
        $this->getJson('/api/v1/admin/categories')->assertOk()
            ->assertJsonPath('data.0.image_media.original_filename', $media->original_filename);
        $this->postJson('/api/v1/admin/categories', [
            'name' => 'Walkpads', 'slug' => 'walkpads', 'sort_order' => 10, 'is_active' => true,
        ])->assertCreated();

        $public = $this->getJson('/api/v1/categories')->assertOk()
            ->assertJsonPath('data.0.slug', 'walkpads')
            ->assertJsonPath('data.1.slug', 'treadmills');
        $this->assertStringEndsWith('/storage/categories/treadmills.jpg', $public->json('data.1.image_url'));
        $this->assertTrue($media->isReferenced());

        $this->putJson('/api/v1/admin/categories/'.$treadmills['id'], [
            'name' => 'Treadmills', 'slug' => 'treadmills', 'description' => 'Run at home.',
            'sort_order' => 0, 'image_media_id' => null, 'is_active' => true,
        ])->assertOk()->assertJsonPath('data.image_url', null);
        $this->assertFalse($media->isReferenced());
        $this->postJson('/api/v1/admin/categories', [
            'name' => 'Invalid image', 'image_media_id' => '00000000-0000-0000-0000-000000000000',
        ])->assertUnprocessable();
    }

    public function test_creates_a_catalogue_product_and_exposes_it_after_stock_is_set(): void
    {
        $manager = $this->catalogManager();
        $brand = Brand::factory()->create();
        $category = Category::factory()->create(['name' => 'Fitness', 'slug' => 'fitness']);
        $productType = ProductType::factory()->create(['name' => 'Treadmills', 'slug' => 'treadmills']);
        $hsnCode = HsnCode::factory()->create();
        $warehouse = Warehouse::factory()->create();

        $response = $this->actingAs($manager)->postJson('/api/v1/admin/products', [
            'brand_id' => $brand->id,
            'category_id' => $category->id,
            'product_type_id' => $productType->id,
            'hsn_code_id' => $hsnCode->id,
            'name' => 'Apex 1100',
            'group_name' => 'Treadmills',
            'sku' => 'DFI-APEX-1100',
            'mrp_price' => '122999.00',
            'sale_price' => '98355.00',
            'sort_order' => 10,
            'is_trade_product' => true,
            'is_active' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Apex 1100')
            ->assertJsonPath('data.group_name', 'Treadmills')
            ->assertJsonPath('data.sort_order', 10)
            ->assertJsonPath('data.is_trade_product', true);
        $product = Product::query()->where('sku', 'DFI-APEX-1100')->sole();
        $this->assertDatabaseCount('product_prices', 2);

        $this->getJson('/api/v1/products')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/warehouses/{$warehouse->id}/products/{$product->id}/stock", ['quantity' => 7])
            ->assertOk()
            ->assertJsonPath('data.quantity', 7);

        $this->assertDatabaseHas('stock_movements', ['quantity_delta' => 7, 'movement_type' => 'manual_set']);
        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonPath('data.0.sku', 'DFI-APEX-1100')
            ->assertJsonPath('data.0.available_stock', 7);
        $this->getJson("/api/v1/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.price.sale', '98355.00');
    }

    public function test_product_content_persists_from_admin_create_through_public_detail_and_edit(): void
    {
        $this->actingAs($this->catalogManager());
        $brand = Brand::factory()->create();
        $category = Category::factory()->create(['is_active' => true]);
        $type = ProductType::factory()->create(['is_active' => true]);
        $warehouse = Warehouse::factory()->create();
        $payload = [
            'brand_id' => $brand->id, 'category_id' => $category->id,
            'product_type_id' => $type->id, 'name' => 'Synthetic Runner',
            'sku' => 'SYN-RUNNER-1', 'mrp_price' => '25000.00',
            'sale_price' => '22000.00', 'is_active' => true,
            'slug' => 'synthetic-runner', 'short_description' => 'Compact home equipment.',
            'details' => [
                ['title' => 'What is included', 'content' => '<p>One machine</p>', 'sort_order' => 2, 'is_active' => true],
                ['title' => 'Internal draft', 'content' => '<p>Not published</p>', 'sort_order' => 3, 'is_active' => false],
            ],
            'additional_details' => ['model_number' => 'SYN-R-1', 'country_of_origin' => 'India'],
        ];

        $created = $this->postJson('/api/v1/admin/products', $payload)->assertCreated()
            ->assertJsonPath('data.short_description', 'Compact home equipment.')
            ->assertJsonCount(2, 'data.details')->json('data');
        $id = $created['id'];
        $this->assertDatabaseCount('product_details', 2);
        $this->assertDatabaseHas('product_additional_details', ['product_id' => $id, 'model_number' => 'SYN-R-1']);
        $this->putJson("/api/v1/admin/warehouses/{$warehouse->id}/products/{$id}/stock", ['quantity' => 3])->assertOk();

        $this->getJson("/api/v1/products/{$id}")->assertOk()
            ->assertJsonCount(1, 'data.details')
            ->assertJsonPath('data.details.0.title', 'What is included')
            ->assertJsonPath('data.additional_details.model_number', 'SYN-R-1');

        $detailId = $created['details'][0]['id'];
        $this->putJson("/api/v1/admin/products/{$id}", array_replace($payload, [
            'edit_token' => $created['edit_token'],
            'short_description' => 'Updated home equipment.',
            'details' => [[
                'id' => $detailId, 'title' => 'Box contents', 'content' => '<p>One machine and manual</p>',
                'sort_order' => 1, 'is_active' => true,
            ]],
        ]))->assertOk()->assertJsonPath('data.details.0.title', 'Box contents');
        $this->getJson("/api/v1/admin/products/{$id}")->assertOk()
            ->assertJsonCount(1, 'data.details')
            ->assertJsonPath('data.short_description', 'Updated home equipment.');
        $this->getJson("/api/v1/products/{$id}")->assertOk()
            ->assertJsonPath('data.details.0.title', 'Box contents');

        $this->putJson("/api/v1/admin/products/{$id}", array_replace($payload, [
            'name' => 'Should not persist',
            'details' => [[
                'id' => '00000000-0000-0000-0000-000000000001',
                'title' => 'Wrong owner', 'content' => 'Rejected', 'is_active' => true,
            ]],
        ]))->assertUnprocessable();
        $this->assertDatabaseHas('products', ['id' => $id, 'name' => 'Synthetic Runner']);
        $this->assertDatabaseCount('product_details', 1);
    }

    public function test_inventory_operations_persist_stock_and_immutable_movement_history(): void
    {
        $manager = $this->catalogManager();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $endpoint = "/api/v1/admin/warehouses/{$warehouse->id}/products/{$product->id}/stock";

        $this->actingAs($manager)
            ->putJson($endpoint, ['operation' => 'adjustment', 'quantity' => 10])
            ->assertOk()
            ->assertJsonPath('data.quantity', 10)
            ->assertJsonPath('data.movements.0.movement_type', 'manual_set')
            ->assertJsonPath('data.movements.0.quantity_delta', 10);

        $this->actingAs($manager)
            ->putJson($endpoint, ['operation' => 'adjustment', 'quantity' => 10])
            ->assertOk()
            ->assertJsonPath('data.quantity', 10)
            ->assertJsonCount(1, 'data.movements');

        $this->actingAs($manager)
            ->putJson($endpoint, ['operation' => 'stock_in', 'quantity' => 4])
            ->assertOk()
            ->assertJsonPath('data.quantity', 14)
            ->assertJsonPath('data.movements.0.movement_type', 'stock_in')
            ->assertJsonPath('data.movements.0.quantity_delta', 4);

        $this->actingAs($manager)
            ->putJson($endpoint, ['operation' => 'stock_out', 'quantity' => 3])
            ->assertOk()
            ->assertJsonPath('data.quantity', 11)
            ->assertJsonPath('data.movements.0.movement_type', 'stock_out')
            ->assertJsonPath('data.movements.0.quantity_delta', -3);

        $this->actingAs($manager)
            ->putJson($endpoint, ['operation' => 'stock_out', 'quantity' => 12])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation.failed');

        $this->actingAs($manager)
            ->getJson($endpoint)
            ->assertOk()
            ->assertJsonPath('data.quantity', 11)
            ->assertJsonCount(3, 'data.movements');

        $this->assertDatabaseHas('warehouse_stocks', [
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'quantity' => 11,
        ]);
        $this->assertDatabaseCount('stock_movements', 3);
    }

    public function test_admin_product_list_exposes_real_warehouse_balances_and_refreshes_after_stock_update(): void
    {
        $product = Product::factory()->create(['sku' => 'DFISE003']);
        $trichy = Warehouse::factory()->create(['name' => 'Trichy']);
        $por = Warehouse::factory()->create(['name' => 'Por']);
        WarehouseStock::factory()->create([
            'warehouse_id' => $trichy->id, 'product_id' => $product->id,
            'quantity' => 20, 'reserved_quantity' => 2,
        ]);
        WarehouseStock::factory()->create([
            'warehouse_id' => $por->id, 'product_id' => $product->id,
            'quantity' => 5, 'reserved_quantity' => 1,
        ]);
        $this->actingAs($this->catalogManager());

        $this->getJson('/api/v1/admin/products?search=DFISE003')->assertOk()
            ->assertJsonPath('data.0.inventory.physical', 25)
            ->assertJsonPath('data.0.inventory.reserved', 3)
            ->assertJsonPath('data.0.inventory.available', 22)
            ->assertJsonPath('data.0.inventory.warehouses.0.warehouse_name', 'Por')
            ->assertJsonPath('data.0.inventory.warehouses.0.available', 4)
            ->assertJsonPath('data.0.inventory.warehouses.1.warehouse_name', 'Trichy')
            ->assertJsonPath('data.0.inventory.warehouses.1.available', 18);
        $this->getJson('/api/v1/products')->assertOk()
            ->assertJsonPath('data.0.available_stock', 22)
            ->assertJsonMissingPath('data.0.inventory');

        $this->putJson("/api/v1/admin/warehouses/{$trichy->id}/products/{$product->id}/stock", [
            'operation' => 'adjustment', 'quantity' => 25,
        ])->assertOk()->assertJsonPath('data.available_quantity', 23);
        $this->getJson('/api/v1/admin/products?search=DFISE003')->assertOk()
            ->assertJsonPath('data.0.inventory.physical', 30)
            ->assertJsonPath('data.0.inventory.reserved', 3)
            ->assertJsonPath('data.0.inventory.available', 27)
            ->assertJsonPath('data.0.inventory.warehouses.1.available', 23);
    }

    public function test_product_management_vertical_slice_creates_catalogue_masters_then_a_public_product(): void
    {
        Storage::fake('public');
        $manager = $this->catalogManager();
        $brand = Brand::factory()->create(['name' => 'Durafit', 'slug' => 'durafit']);
        $warehouse = Warehouse::factory()->create(['name' => 'Por']);

        $productType = $this->actingAs($manager)
            ->postJson('/api/v1/admin/product-types', [
                'name' => 'Treadmills',
                'description' => 'Motorized treadmills.',
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Treadmills')
            ->json('data');

        $category = $this->actingAs($manager)
            ->postJson('/api/v1/admin/categories', [
                'name' => 'Home Fitness',
                'description' => 'Home fitness equipment.',
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Home Fitness')
            ->json('data');

        $hsnCode = $this->actingAs($manager)
            ->postJson('/api/v1/admin/hsn-codes', [
                'title' => 'Fitness equipment',
                'hsn_code' => '95069190',
                'sgst_tax_multiplier' => '9.00',
                'igst_tax_multiplier' => '18.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.hsn_code', '95069190')
            ->json('data');

        $product = $this->actingAs($manager)
            ->postJson('/api/v1/admin/products', [
                'brand_id' => $brand->id,
                'category_id' => $category['id'],
                'product_type_id' => $productType['id'],
                'hsn_code_id' => $hsnCode['id'],
                'name' => 'Durafit Sprint X',
                'sku' => 'DF-SPRINT-X',
                'mrp_price' => '55999.00',
                'sale_price' => '44999.00',
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.sku', 'DF-SPRINT-X')
            ->json('data');

        $this->actingAs($manager)
            ->post("/api/v1/admin/products/{$product['id']}/images", [
                'image' => UploadedFile::fake()->image('sprint-x.jpg', 1200, 800),
                'is_primary' => true,
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/warehouses/{$warehouse->id}/products/{$product['id']}/stock", ['quantity' => 4])
            ->assertOk()
            ->assertJsonPath('data.quantity', 4);

        $this->getJson('/api/v1/products?category_id='.$category['id'])
            ->assertOk()
            ->assertJsonPath('data.0.sku', 'DF-SPRINT-X')
            ->assertJsonPath('data.0.images.0.is_primary', true)
            ->assertJsonPath('data.0.available_stock', 4);
    }

    public function test_product_create_flow_persists_drafted_specification_highlight_media_and_stock(): void
    {
        Storage::fake('public');
        $manager = $this->catalogManager();
        $brand = Brand::factory()->create();
        $category = Category::factory()->create();
        $productType = ProductType::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $attribute = Attribute::query()->create([
            'name' => 'Maximum user weight',
            'slug' => 'maximum-user-weight',
            'data_type' => 'number',
            'unit' => 'kg',
            'is_filterable' => true,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $product = $this->actingAs($manager)
            ->postJson('/api/v1/admin/products', [
                'brand_id' => $brand->id,
                'category_id' => $category->id,
                'product_type_id' => $productType->id,
                'name' => 'Flow verification treadmill',
                'sku' => 'FLOW-VERIFY-001',
                'mrp_price' => '50000.00',
                'sale_price' => '45000.00',
                'description' => 'Complete create-flow verification product.',
                'is_active' => true,
            ])
            ->assertCreated()
            ->json('data');

        $specification = $this->actingAs($manager)
            ->postJson("/api/v1/admin/products/{$product['id']}/attributes", [
                'attribute_id' => $attribute->id,
                'value' => '120',
                'sort_order' => 0,
            ])
            ->assertCreated()
            ->json('data');

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/products/{$product['id']}/highlights", [
                'highlights' => [[
                    'product_attribute_id' => $specification['id'],
                    'sort_order' => 0,
                    'is_active' => true,
                ]],
            ])
            ->assertOk();

        $this->actingAs($manager)
            ->post("/api/v1/admin/products/{$product['id']}/images", [
                'image' => UploadedFile::fake()->image('flow.jpg', 1200, 800),
                'is_primary' => true,
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/warehouses/{$warehouse->id}/products/{$product['id']}/stock", [
                'operation' => 'adjustment',
                'quantity' => 8,
            ])
            ->assertOk();

        $this->actingAs($manager)
            ->getJson("/api/v1/admin/products/{$product['id']}")
            ->assertOk()
            ->assertJsonPath('data.specifications.0.value', '120')
            ->assertJsonPath('data.highlights.0.specification.attribute.unit', 'kg')
            ->assertJsonPath('data.images.0.is_primary', true)
            ->assertJsonPath('data.available_stock', 8);
    }

    public function test_rejects_a_sale_price_above_mrp_without_creating_a_product(): void
    {
        $manager = $this->catalogManager();

        $this->actingAs($manager)->postJson('/api/v1/admin/products', [
            'brand_id' => Brand::factory()->create()->id,
            'category_id' => Category::factory()->create()->id,
            'product_type_id' => ProductType::factory()->create()->id,
            'name' => 'Invalid price product',
            'sku' => 'INVALID-PRICE',
            'mrp_price' => '100.00',
            'sale_price' => '101.00',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'validation.failed');

        $this->assertDatabaseMissing('products', ['sku' => 'INVALID-PRICE']);
    }

    public function test_updates_a_product_and_preserves_price_history(): void
    {
        $manager = $this->catalogManager();
        $product = Product::factory()->create([
            'mrp_price' => '100.00',
            'sale_price' => '80.00',
            'is_active' => true,
        ]);
        $product->prices()->createMany([
            ['price_type' => 'mrp', 'currency' => 'INR', 'amount' => '100.00', 'effective_at' => now()->subDay()],
            ['price_type' => 'sale', 'currency' => 'INR', 'amount' => '80.00', 'effective_at' => now()->subDay()],
        ]);

        $this->actingAs($manager)->putJson("/api/v1/admin/products/{$product->id}", [
            'brand_id' => $product->brand_id,
            'category_id' => $product->category_id,
            'product_type_id' => $product->product_type_id,
            'hsn_code_id' => $product->hsn_code_id,
            'name' => 'Updated product name',
            'sku' => $product->sku,
            'mrp_price' => '120.00',
            'sale_price' => '90.00',
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.price.sale', '90.00');

        $this->assertDatabaseHas('products', ['id' => $product->id, 'name' => 'Updated product name', 'mrp_price' => '120.00']);
        $this->assertDatabaseCount('product_prices', 4);
        $this->assertSame(2, $product->prices()->whereNotNull('ends_at')->count());
        $this->assertSame(2, $product->prices()->whereNull('ends_at')->count());
    }

    public function test_catalogue_manager_reads_a_product_with_its_catalogue_relationships(): void
    {
        $manager = $this->catalogManager();
        $product = Product::factory()->create();

        $this->actingAs($manager)
            ->getJson("/api/v1/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $product->id)
            ->assertJsonPath('data.brand.id', $product->brand_id)
            ->assertJsonPath('data.category.id', $product->category_id)
            ->assertJsonPath('data.product_type.id', $product->product_type_id);
    }

    public function test_updates_a_product_type_for_a_catalogue_manager(): void
    {
        $manager = $this->catalogManager();
        $productType = ProductType::factory()->create(['name' => 'Treadmill', 'slug' => 'treadmill']);

        $this->actingAs($manager)->putJson("/api/v1/admin/product-types/{$productType->id}", [
            'name' => 'Treadmills',
            'slug' => 'treadmills',
            'description' => 'Motorized home treadmills.',
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.name', 'Treadmills');

        $this->assertDatabaseHas('product_types', ['id' => $productType->id, 'slug' => 'treadmills']);
    }

    public function test_catalogue_manager_assigns_a_specification_and_highlight_to_a_product(): void
    {
        $manager = $this->catalogManager();
        $product = Product::factory()->create(['is_active' => true]);
        WarehouseStock::factory()->create([
            'product_id' => $product->id,
            'quantity' => 3,
        ]);
        $attribute = Attribute::query()->create([
            'name' => 'Motor',
            'slug' => 'motor',
            'data_type' => 'text',
            'unit' => 'HP',
            'is_filterable' => true,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $specification = $this->actingAs($manager)
            ->postJson("/api/v1/admin/products/{$product->id}/attributes", [
                'attribute_id' => $attribute->id,
                'value' => '3 Peak',
                'sort_order' => 0,
            ])
            ->assertCreated()
            ->assertJsonPath('data.attribute.name', 'Motor')
            ->json('data');

        $this->actingAs($manager)
            ->postJson("/api/v1/admin/products/{$product->id}/attributes", [
                'attribute_id' => $attribute->id,
                'value' => '4 Peak',
            ])
            ->assertUnprocessable();

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/products/{$product->id}/highlights", [
                'highlights' => [[
                    'product_attribute_id' => $specification['id'],
                    'sort_order' => 0,
                    'is_active' => true,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.0.specification.value', '3 Peak');

        $this->getJson('/api/v1/filters')
            ->assertOk()
            ->assertJsonPath('data.0.id', $attribute->id)
            ->assertJsonPath('data.0.values.0', '3 Peak');

        $this->getJson("/api/v1/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.specifications.0.attribute.unit', 'HP')
            ->assertJsonPath('data.highlights.0.specification.value', '3 Peak');

        $this->actingAs($manager)
            ->putJson("/api/v1/admin/products/{$product->id}/attributes/{$specification['id']}", [
                'attribute_id' => $attribute->id,
                'value' => '4 Peak',
                'sort_order' => 1,
                'show_on_top' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.value', '4 Peak');

        $this->getJson("/api/v1/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.specifications.0.value', '4 Peak')
            ->assertJsonPath('data.highlights.0.product_attribute_id', $specification['id'])
            ->assertJsonPath('data.highlights.0.specification.value', '4 Peak');

        $this->actingAs($manager)
            ->deleteJson("/api/v1/admin/products/{$product->id}/attributes/{$specification['id']}")
            ->assertNoContent();

        $this->actingAs($manager)
            ->getJson("/api/v1/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonCount(0, 'data.specifications')
            ->assertJsonCount(0, 'data.highlights');

        $attribute->update(['is_active' => false]);
        $this->actingAs($manager)
            ->postJson("/api/v1/admin/products/{$product->id}/attributes", [
                'attribute_id' => $attribute->id,
                'value' => '5 Peak',
            ])
            ->assertUnprocessable();
    }

    public function test_public_filters_return_distinct_values_only_from_available_products(): void
    {
        $attribute = Attribute::query()->create([
            'name' => 'Motor',
            'slug' => 'motor',
            'data_type' => 'text',
            'is_filterable' => true,
            'is_active' => true,
            'sort_order' => 0,
        ]);
        $unfilterable = Attribute::query()->create([
            'name' => 'Internal Code',
            'slug' => 'internal-code',
            'data_type' => 'text',
            'is_filterable' => false,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        foreach (['3 HP', '3 HP', '5 HP'] as $value) {
            $product = Product::factory()->create(['is_active' => true]);
            WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
            ProductAttribute::query()->create([
                'product_id' => $product->id,
                'attribute_id' => $attribute->id,
                'value' => $value,
            ]);
        }

        $inactive = Product::factory()->create(['is_active' => false]);
        WarehouseStock::factory()->create(['product_id' => $inactive->id, 'quantity' => 2]);
        ProductAttribute::query()->create([
            'product_id' => $inactive->id,
            'attribute_id' => $attribute->id,
            'value' => '9 HP',
        ]);

        $outOfStock = Product::factory()->create(['is_active' => true]);
        ProductAttribute::query()->create([
            'product_id' => $outOfStock->id,
            'attribute_id' => $attribute->id,
            'value' => '7 HP',
        ]);
        ProductAttribute::query()->create([
            'product_id' => $outOfStock->id,
            'attribute_id' => $unfilterable->id,
            'value' => 'Hidden',
        ]);

        $this->getJson('/api/v1/filters')->assertOk()->assertExactJson([
            'data' => [[
                'id' => $attribute->id,
                'name' => 'Motor',
                'slug' => 'motor',
                'unit' => null,
                'values' => ['3 HP', '5 HP'],
            ]],
        ]);
    }

    public function test_uploads_a_primary_product_image_for_a_catalogue_manager(): void
    {
        Storage::fake('public');
        $manager = $this->catalogManager();
        $product = Product::factory()->create();

        $this->actingAs($manager)
            ->post("/api/v1/admin/products/{$product->id}/images", [
                'image' => UploadedFile::fake()->image('apex.jpg', 1200, 800),
                'is_primary' => true,
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.images.0.is_primary', true);

        $image = $product->images()->with('media')->sole();
        Storage::disk('public')->assertExists($image->media->path);
        $this->assertDatabaseHas('product_images', ['id' => $image->id, 'is_primary' => true]);
        $this->getJson('/api/v1/admin/products')->assertOk()
            ->assertJsonPath('data.0.images.0.is_primary', true);
    }

    public function test_ordered_360_frames_flow_from_admin_upload_to_public_product_without_becoming_primary(): void
    {
        Storage::fake('public');
        $this->actingAs($this->catalogManager());
        $product = Product::factory()->create(['is_active' => true]);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 3]);
        $url = "/api/v1/admin/products/{$product->id}/images";

        $this->post($url, [
            'image' => UploadedFile::fake()->image('front.jpg'),
            'type' => 'gallery', 'is_primary' => true,
        ], ['Accept' => 'application/json'])->assertOk();

        foreach (range(0, 7) as $angle) {
            $this->post($url, [
                'image' => UploadedFile::fake()->image("angle-{$angle}.jpg"),
                'type' => '360_frame', 'sort_order' => $angle + 1,
                'is_primary' => false,
            ], ['Accept' => 'application/json'])->assertOk();
        }

        $this->post($url, [
            'image' => UploadedFile::fake()->image('invalid-primary.jpg'),
            'type' => '360_frame', 'is_primary' => true,
        ], ['Accept' => 'application/json'])->assertUnprocessable();

        $this->getJson("/api/v1/products/{$product->id}")
            ->assertOk()->assertJsonCount(9, 'data.images')
            ->assertJsonPath('data.has_360_view', true)
            ->assertJsonPath('data.images.0.type', 'gallery')
            ->assertJsonPath('data.images.0.is_primary', true)
            ->assertJsonPath('data.images.1.type', '360_frame')
            ->assertJsonPath('data.images.8.sort_order', 8);

        $this->getJson('/api/v1/products')
            ->assertOk()->assertJsonCount(1, 'data.0.images')
            ->assertJsonPath('data.0.has_360_view', true);
    }

    public function test_product_image_can_be_reordered_replaced_and_removed_without_orphaning_media(): void
    {
        Storage::fake('public');
        $this->actingAs($this->catalogManager());
        $product = Product::factory()->create();
        $base = "/api/v1/admin/products/{$product->id}/images";

        $this->post($base, ['image' => UploadedFile::fake()->image('first.jpg'), 'is_primary' => true], ['Accept' => 'application/json'])->assertOk();
        $this->post($base, ['image' => UploadedFile::fake()->image('second.jpg')], ['Accept' => 'application/json'])->assertOk();
        $first = $product->images()->where('is_primary', true)->sole();
        $second = $product->images()->where('id', '!=', $first->id)->firstOrFail();

        $this->putJson("{$base}/{$second->id}", ['sort_order' => 7, 'is_primary' => true])
            ->assertOk()->assertJsonPath('data.images.1.is_primary', true);
        $this->assertDatabaseHas('product_images', ['id' => $first->id, 'is_primary' => false]);
        $this->assertDatabaseHas('product_images', ['id' => $second->id, 'sort_order' => 7, 'is_primary' => true]);

        $oldMedia = $first->media;
        $this->post("{$base}/{$first->id}/replace", ['image' => UploadedFile::fake()->image('replacement.png')], ['Accept' => 'application/json'])
            ->assertOk();
        $first->refresh();
        $this->assertNotSame($oldMedia->id, $first->media_id);
        $this->assertDatabaseMissing('media', ['id' => $oldMedia->id]);
        Storage::disk('public')->assertMissing($oldMedia->path);
        Storage::disk('public')->assertExists($first->media->path);

        $this->deleteJson("{$base}/{$second->id}")->assertOk();
        $this->assertDatabaseMissing('product_images', ['id' => $second->id]);
        $this->assertDatabaseHas('product_images', ['id' => $first->id, 'is_primary' => true]);
    }

    public function test_product_image_operations_reject_an_image_from_another_product(): void
    {
        Storage::fake('public');
        $this->actingAs($this->catalogManager());
        $owner = Product::factory()->create();
        $other = Product::factory()->create();
        $this->post("/api/v1/admin/products/{$owner->id}/images", ['image' => UploadedFile::fake()->image('owned.jpg')], ['Accept' => 'application/json'])->assertOk();
        $image = $owner->images()->sole();

        $this->deleteJson("/api/v1/admin/products/{$other->id}/images/{$image->id}")->assertUnprocessable();
        $this->assertDatabaseHas('product_images', ['id' => $image->id, 'product_id' => $owner->id]);
    }

    public function test_rejected_replacement_keeps_the_existing_product_image(): void
    {
        Storage::fake('public');
        $this->actingAs($this->catalogManager());
        $product = Product::factory()->create();
        $base = "/api/v1/admin/products/{$product->id}/images";
        $this->post($base, ['image' => UploadedFile::fake()->image('original.jpg')], ['Accept' => 'application/json'])->assertOk();
        $image = $product->images()->with('media')->sole();

        $this->post("{$base}/{$image->id}/replace", ['image' => UploadedFile::fake()->create('invalid.txt', 1, 'text/plain')], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->assertDatabaseHas('product_images', ['id' => $image->id, 'media_id' => $image->media_id]);
        Storage::disk('public')->assertExists($image->media->path);
    }

    public function test_product_image_changes_require_catalogue_permission(): void
    {
        $image = ProductImage::factory()->create();
        $url = "/api/v1/admin/products/{$image->product_id}/images/{$image->id}";

        $this->putJson($url, ['sort_order' => 2])->assertUnauthorized();
        $this->actingAs(User::factory()->create())
            ->deleteJson($url)->assertForbidden();
        $this->assertDatabaseHas('product_images', ['id' => $image->id]);
    }

    public function test_inventory_manager_can_create_rename_list_and_delete_an_unused_warehouse(): void
    {
        $this->actingAs($this->catalogManager());

        $id = $this->postJson('/api/v1/admin/warehouses', ['name' => 'North depot'])
            ->assertCreated()->json('data.id');

        $this->putJson("/api/v1/admin/warehouses/{$id}", ['name' => 'North distribution'])
            ->assertOk()->assertJsonPath('data.name', 'North distribution');
        $this->getJson('/api/v1/admin/warehouses')
            ->assertOk()->assertJsonFragment(['id' => $id, 'name' => 'North distribution']);
        $this->assertDatabaseHas('warehouses', ['id' => $id, 'name' => 'North distribution']);

        $this->deleteJson("/api/v1/admin/warehouses/{$id}")->assertOk();
        $this->assertDatabaseMissing('warehouses', ['id' => $id]);
    }

    public function test_warehouse_writes_require_inventory_permission(): void
    {
        $warehouse = Warehouse::factory()->create();
        $this->postJson('/api/v1/admin/warehouses', ['name' => 'Restricted'])->assertUnauthorized();
        $this->actingAs(User::factory()->create());

        $this->postJson('/api/v1/admin/warehouses', ['name' => 'Restricted'])->assertForbidden();
        $this->putJson("/api/v1/admin/warehouses/{$warehouse->id}", ['name' => 'Restricted'])->assertForbidden();
        $this->deleteJson("/api/v1/admin/warehouses/{$warehouse->id}")->assertForbidden();
        $this->assertDatabaseHas('warehouses', ['id' => $warehouse->id, 'name' => $warehouse->name]);
        $this->assertDatabaseCount('warehouses', 1);
    }

    public function test_warehouse_name_validation_preserves_existing_data(): void
    {
        $warehouse = Warehouse::factory()->create();
        $other = Warehouse::factory()->create();
        $this->actingAs($this->catalogManager());

        $this->postJson('/api/v1/admin/warehouses', [])->assertUnprocessable();
        $this->postJson('/api/v1/admin/warehouses', ['name' => $warehouse->name])->assertUnprocessable();
        $this->postJson('/api/v1/admin/warehouses', ['name' => str_repeat('a', 256)])->assertUnprocessable();
        $this->putJson("/api/v1/admin/warehouses/{$other->id}", ['name' => $warehouse->name])->assertUnprocessable();
        $this->putJson("/api/v1/admin/warehouses/{$warehouse->id}", ['name' => $warehouse->name])->assertOk();
        $this->assertDatabaseCount('warehouses', 2);
        $this->assertDatabaseHas('warehouses', ['id' => $other->id, 'name' => $other->name]);
    }

    public function test_warehouse_delete_preserves_zero_stock_records_and_order_references(): void
    {
        $stock = WarehouseStock::factory()->create(['quantity' => 0]);
        $order = Order::query()->create([
            'order_number' => 'WAREHOUSE-RETENTION-TEST',
            'customer_id' => Customer::factory()->create()->id,
            'warehouse_id' => Warehouse::factory()->create()->id,
            'status' => 'pending',
            'subtotal_amount' => 100,
            'total_amount' => 100,
        ]);
        $this->actingAs($this->catalogManager());

        $this->deleteJson("/api/v1/admin/warehouses/{$stock->warehouse_id}")->assertUnprocessable();
        $this->deleteJson("/api/v1/admin/warehouses/{$order->warehouse_id}")->assertUnprocessable();
        $this->assertDatabaseHas('warehouse_stocks', ['id' => $stock->id]);
        $this->assertDatabaseHas('warehouses', ['id' => $order->warehouse_id]);
    }

    public function test_invalid_opening_stock_out_rolls_back_new_stock_and_ledger(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $this->actingAs($this->catalogManager())
            ->putJson("/api/v1/admin/warehouses/{$warehouse->id}/products/{$product->id}/stock", [
                'operation' => 'stock_out', 'quantity' => 1,
            ])->assertUnprocessable();

        $this->assertDatabaseMissing('warehouse_stocks', ['warehouse_id' => $warehouse->id, 'product_id' => $product->id]);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_stock_overflow_leaves_quantity_and_history_unchanged(): void
    {
        $stock = WarehouseStock::factory()->create(['quantity' => 2147483647]);
        $this->actingAs($this->catalogManager())
            ->putJson("/api/v1/admin/warehouses/{$stock->warehouse_id}/products/{$stock->product_id}/stock", [
                'operation' => 'stock_in', 'quantity' => 1,
            ])->assertUnprocessable();

        $this->assertDatabaseHas('warehouse_stocks', ['id' => $stock->id, 'quantity' => 2147483647]);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_product_delete_removes_it_from_catalogue_but_retains_stock_history(): void
    {
        $product = Product::factory()->create(['is_active' => true]);
        $stock = WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 5]);
        $movement = $stock->movements()->create(['movement_type' => 'manual_set', 'quantity_delta' => 5]);
        $this->actingAs($this->catalogManager());

        $this->deleteJson("/api/v1/admin/products/{$product->id}")
            ->assertOk()->assertJsonPath('data.id', $product->id)->assertJsonPath('data.is_active', false);

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertDatabaseHas('warehouse_stocks', ['id' => $stock->id, 'quantity' => 5]);
        $this->assertDatabaseHas('stock_movements', ['id' => $movement->id, 'quantity_delta' => 5]);
        $this->getJson('/api/v1/admin/products')->assertOk()->assertJsonMissing(['id' => $product->id]);
        $this->getJson("/api/v1/admin/products/{$product->id}")->assertNotFound();
        $this->getJson("/api/v1/products/{$product->id}")->assertNotFound();
    }

    public function test_product_delete_requires_catalogue_permission(): void
    {
        $product = Product::factory()->create(['is_active' => true]);
        $this->deleteJson("/api/v1/admin/products/{$product->id}")->assertUnauthorized();
        $this->actingAs(User::factory()->create())
            ->deleteJson("/api/v1/admin/products/{$product->id}")->assertForbidden();

        $this->assertDatabaseHas('products', ['id' => $product->id, 'deleted_at' => null, 'is_active' => true]);
    }

    private function catalogManager(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $permissions = Permission::factory()->createMany([
            ['name' => 'catalog.manage'],
            ['name' => 'inventory.manage'],
        ]);
        $role->permissions()->attach($permissions->pluck('id'));
        $user->roles()->attach($role);

        return $user;
    }
}
