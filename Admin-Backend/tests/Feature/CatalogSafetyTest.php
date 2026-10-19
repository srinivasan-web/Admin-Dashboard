<?php

namespace Tests\Feature;

use App\Actions\AttachProductImage;
use App\Actions\ManageProductImage;
use App\Actions\SetWarehouseStock;
use App\Domain\Catalog\ProductDescription;
use App\Models\Attribute;
use App\Models\Banner;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class CatalogSafetyTest extends TestCase
{
    use RefreshDatabase;

    private function manager(): User
    {
        $role = Role::query()->create(['name' => 'Catalog safety', 'slug' => 'catalog-safety']);
        foreach (['catalog.manage', 'inventory.manage'] as $permission) {
            $role->permissions()->attach(Permission::query()->firstOrCreate(['name' => $permission]));
        }
        $user = User::factory()->create();
        $user->roles()->attach($role);
        $this->actingAs($user);

        return $user;
    }

    private function fields(Product $product): array
    {
        return $product->only(['brand_id', 'category_id', 'product_type_id', 'hsn_code_id', 'name', 'sku', 'mrp_price', 'sale_price', 'is_active', 'description', 'sort_order']);
    }

    public function test_core_edit_token_rejects_stale_updates_even_within_the_same_second(): void
    {
        $this->manager();
        $this->freezeTime();
        $product = Product::factory()->create(['mrp_price' => '100.00', 'sale_price' => '80.00']);
        $url = "/api/v1/admin/products/{$product->id}";
        $token = $this->getJson($url)->assertOk()->json('data.edit_token');
        $fields = [...$this->fields($product), 'edit_token' => $token, 'name' => 'First administrator'];
        $next = $this->putJson($url, $fields)->assertOk()->json('data.edit_token');
        $this->assertNotSame($token, $next);
        $this->putJson($url, [...$fields, 'name' => 'Stale overwrite'])->assertStatus(409);
        $this->assertSame('First administrator', $product->fresh()->name);
        $this->putJson($url, [...$fields, 'edit_token' => $next, 'name' => 'Reviewed update'])->assertOk();
    }

    public function test_description_is_sanitized_server_side_and_decimal_overflow_is_rejected(): void
    {
        $this->manager();
        $product = Product::factory()->create(['mrp_price' => '100.00', 'sale_price' => '80.00']);
        $fields = [...$this->fields($product), 'description' => '<p onclick="bad()">வணக்கம் <strong>Fitness</strong><script>bad()</script><a href="javascript:bad()">link</a></p>'];
        $this->putJson("/api/v1/admin/products/{$product->id}", $fields)->assertOk();
        $description = $product->fresh()->description;
        $this->assertStringContainsString('வணக்கம் <strong>Fitness</strong>', $description);
        foreach (['onclick', 'script', 'javascript:', 'bad()'] as $unsafe) {
            $this->assertStringNotContainsString($unsafe, $description);
        }
        $this->assertSame($description, ProductDescription::clean($description));
        $this->assertSame('Plain description', ProductDescription::clean('Plain description'));
        $this->putJson("/api/v1/admin/products/{$product->id}", [...$fields, 'mrp_price' => '10000000000.00'])->assertUnprocessable();
    }

    public function test_attribute_values_match_supported_types_without_rewriting_legacy_values(): void
    {
        $this->manager();
        $product = Product::factory()->create(['mrp_price' => '100.00', 'sale_price' => '80.00']);
        $attribute = Attribute::query()->create(['name' => 'Weight', 'slug' => 'weight', 'data_type' => 'number', 'is_active' => true]);
        $url = "/api/v1/admin/products/{$product->id}/attributes";
        $this->postJson($url, ['attribute_id' => $attribute->id, 'value' => '120 kg'])->assertUnprocessable();
        $spec = $this->postJson($url, ['attribute_id' => $attribute->id, 'value' => '120'])->assertCreated()->json('data');
        $this->putJson("/api/v1/admin/attributes/{$attribute->id}", ['name' => 'Weight', 'data_type' => 'boolean'])->assertUnprocessable();
        $this->postJson('/api/v1/admin/attributes', ['name' => 'Invented', 'data_type' => 'invented'])->assertUnprocessable();
        ProductAttribute::query()->whereKey($spec['id'])->update(['value' => 'legacy kg']);
        $this->putJson("{$url}/{$spec['id']}", ['attribute_id' => $attribute->id, 'value' => 'legacy kg', 'sort_order' => 2])->assertOk();
        $this->putJson("{$url}/{$spec['id']}", ['attribute_id' => $attribute->id, 'value' => 'new invalid'])->assertUnprocessable();
    }

    public function test_price_formatting_alone_does_not_create_history(): void
    {
        $this->manager();
        $product = Product::factory()->create(['mrp_price' => '100.00', 'sale_price' => '80.00']);
        $this->putJson("/api/v1/admin/products/{$product->id}", [...$this->fields($product), 'mrp_price' => '100', 'sale_price' => '80'])->assertOk();
        $this->assertSame(0, $product->prices()->count());
        $this->putJson("/api/v1/admin/products/{$product->id}", [...$this->fields($product), 'mrp_price' => '101'])->assertOk();
        $this->assertSame(1, $product->prices()->count());
    }

    public function test_manual_stock_replay_is_deduplicated_and_key_reuse_conflicts(): void
    {
        $user = $this->manager();
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $url = "/api/v1/admin/warehouses/{$warehouse->id}/products/{$product->id}/stock";
        $request = ['operation' => 'stock_in', 'quantity' => 4, 'idempotency_key' => (string) Str::uuid()];
        $this->putJson($url, $request)->assertOk()->assertJsonPath('data.quantity', 4);
        $this->putJson($url, $request)->assertOk()->assertJsonPath('data.quantity', 4);
        $this->assertSame(1, StockMovement::count());
        $this->assertDatabaseCount('inventory_operation_receipts', 1);
        $this->putJson($url, [...$request, 'quantity' => 5])->assertStatus(409);
        $this->assertSame(4, $product->warehouseStocks()->first()->quantity);

        // A no-op adjustment needs a receipt even though it has no movement.
        $noop = ['operation' => 'adjustment', 'quantity' => 4, 'idempotency_key' => (string) Str::uuid()];
        $this->putJson($url, $noop)->assertOk();
        app(SetWarehouseStock::class)->execute($warehouse, $product, 3, 'stock_in', $user);
        $this->putJson($url, $noop)->assertOk()->assertJsonPath('data.quantity', 7);
        $this->assertSame(2, StockMovement::count());

        $failed = ['operation' => 'stock_out', 'quantity' => 99, 'idempotency_key' => (string) Str::uuid()];
        $this->putJson($url, $failed)->assertUnprocessable();
        $this->assertFalse(DB::table('inventory_operation_receipts')->where('idempotency_key', $failed['idempotency_key'])->exists());
        $this->assertSame(7, $product->warehouseStocks()->first()->quantity);
    }

    public function test_public_visibility_and_highlight_flags_stay_consistent(): void
    {
        $user = $this->manager();
        $product = Product::factory()->create(['mrp_price' => '100.00', 'sale_price' => null]);
        app(SetWarehouseStock::class)->execute(Warehouse::factory()->create(), $product, 2, 'stock_in', $user);
        $attribute = Attribute::query()->create(['name' => 'Motor', 'slug' => 'motor', 'data_type' => 'number', 'is_active' => true, 'is_filterable' => true]);
        $url = "/api/v1/admin/products/{$product->id}";
        $specification = $this->postJson($url.'/attributes', ['attribute_id' => $attribute->id, 'value' => '3', 'show_on_top' => true])->assertCreated()->json('data');
        $this->assertSame(1, $product->highlights()->count());
        $this->getJson("/api/v1/products/{$product->id}")->assertOk()->assertJsonCount(1, 'data.highlights')->assertJsonCount(1, 'data.specifications')->assertJsonMissingPath('data.edit_token');
        $attribute->update(['is_active' => false]);
        $this->getJson("/api/v1/products/{$product->id}")->assertOk()->assertJsonCount(0, 'data.highlights')->assertJsonCount(0, 'data.specifications');
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'data.highlights')->assertJsonCount(1, 'data.specifications');
        $attribute->update(['is_active' => true]);
        $this->putJson($url.'/highlights', ['highlights' => [['product_attribute_id' => $specification['id'], 'is_active' => false]]])->assertOk();
        $this->getJson("/api/v1/products/{$product->id}")->assertOk()->assertJsonCount(0, 'data.highlights')->assertJsonCount(1, 'data.specifications');
        $this->putJson($url.'/highlights', ['highlights' => []])->assertOk();
        $this->assertFalse(ProductAttribute::findOrFail($specification['id'])->show_on_top);
        $foreign = ProductAttribute::query()->create(['product_id' => Product::factory()->create()->id, 'attribute_id' => $attribute->id, 'value' => '1']);
        $this->putJson($url.'/highlights', ['highlights' => [['product_attribute_id' => $foreign->id]]])->assertUnprocessable();
        $this->assertSame(0, $product->highlights()->count());
        ProductAttribute::findOrFail($specification['id'])->update(['value' => 'invalid legacy number']);
        $this->getJson("/api/v1/products/{$product->id}")->assertOk()->assertJsonCount(0, 'data.specifications');
        $this->getJson('/api/v1/filters')->assertOk()->assertExactJson(['data' => []]);
    }

    public function test_shared_banner_media_is_not_deleted_with_a_product_image(): void
    {
        Storage::fake('public');
        $this->manager();
        $product = Product::factory()->create();
        $image = app(AttachProductImage::class)->execute($product, UploadedFile::fake()->image('shared.jpg'));
        $media = $image->media;
        Banner::query()->create(['title' => 'Shared image', 'desktop_media_id' => $media->id, 'mobile_media_id' => $media->id]);
        $this->deleteJson("/api/v1/admin/products/{$product->id}/images/{$image->id}")->assertOk();
        $this->assertDatabaseHas('media', ['id' => $media->id]);
        Storage::disk('public')->assertExists($media->path);
    }

    public function test_outer_transaction_rollback_retains_old_media_and_cleans_new_file(): void
    {
        Storage::fake('public');
        $product = Product::factory()->create();
        $image = app(AttachProductImage::class)->execute($product, UploadedFile::fake()->image('original.jpg'));
        $old = $image->media;
        DB::beginTransaction();
        app(ManageProductImage::class)->replace($product, $image, UploadedFile::fake()->image('replacement.jpg'));
        $new = $image->fresh('media')->media;
        Storage::disk('public')->assertExists($old->path);
        DB::rollBack();
        $this->assertSame($old->id, $image->fresh()->media_id);
        Storage::disk('public')->assertExists($old->path);
        Storage::disk('public')->assertMissing($new->path);
    }

    public function test_balance_snapshot_can_skip_history_and_ledger_is_paginated(): void
    {
        $user = $this->manager();
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        for ($i = 0; $i < 25; $i++) {
            app(SetWarehouseStock::class)->execute($warehouse, $product, 1, 'stock_in', $user);
        }
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson("/api/v1/admin/warehouses/{$warehouse->id}/products/{$product->id}/stock?include_history=0")->assertOk()->assertJsonPath('data.quantity', 25)->assertJsonCount(0, 'data.movements')->assertJsonCount(0, 'data.reservations');
        $queries = implode(' ', array_column(DB::getQueryLog(), 'query'));
        $this->assertStringNotContainsString('stock_movements', $queries);
        $this->assertStringNotContainsString('stock_reservations', $queries);
        DB::disableQueryLog();
        $this->getJson("/api/v1/admin/stock-movements?product_id={$product->id}&warehouse_id={$warehouse->id}&page=2")->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('meta.total', 25);
    }
}
