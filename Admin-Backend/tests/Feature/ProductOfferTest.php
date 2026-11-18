<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\Role;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductOfferTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_product_offers_match_scope_and_active_date_window_in_display_order(): void
    {
        $product = $this->availableProduct(['slug' => 'offer-treadmill']);
        $sameCategory = $this->availableProduct([
            'category_id' => $product->category_id,
            'product_type_id' => $product->product_type_id,
        ]);
        $other = $this->availableProduct();
        $direct = ProductOffer::query()->create($this->offer([
            'scope_type' => 'product', 'product_id' => $product->id,
            'title' => 'Product code', 'coupon_code' => 'PRODUCT100', 'sort_order' => 2,
        ]));
        $category = ProductOffer::query()->create($this->offer([
            'scope_type' => 'category', 'product_id' => null, 'category_id' => $product->category_id,
            'title' => 'Category promotion', 'offer_type' => 'promotion', 'coupon_code' => null,
            'sort_order' => 1,
        ]));
        $type = ProductOffer::query()->create($this->offer([
            'scope_type' => 'product_type', 'product_id' => null, 'product_type_id' => $product->product_type_id,
            'title' => 'Type code', 'coupon_code' => 'TYPE100', 'sort_order' => 3,
        ]));
        foreach ([
            ['title' => 'Draft', 'coupon_code' => 'DRAFT100', 'is_active' => false],
            ['title' => 'Future', 'coupon_code' => 'FUTURE100', 'starts_at' => now()->addDay()],
            ['title' => 'Expired', 'coupon_code' => 'EXPIRED100', 'ends_at' => now()->subDay()],
            ['title' => 'Other product', 'coupon_code' => 'OTHER100', 'product_id' => $other->id],
        ] as $data) {
            ProductOffer::query()->create($this->offer(array_merge(['product_id' => $product->id], $data)));
        }

        $this->getJson('/api/v1/products/'.$product->slug.'/offers')->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.id', $category->id)
            ->assertJsonPath('data.1.id', $direct->id)
            ->assertJsonPath('data.2.id', $type->id)
            ->assertJsonPath('data.1.coupon_code', 'PRODUCT100')
            ->assertJsonPath('data.1.discount_type', 'percent')
            ->assertJsonPath('data.1.discount_value', '10.00');
        $this->getJson('/api/v1/products/'.$sameCategory->id.'/offers')->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('data.0.id', $category->id)
            ->assertJsonPath('data.1.id', $type->id);
        $this->getJson('/api/v1/products/'.$other->id.'/offers')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Other product');

        $product->update(['is_active' => false]);
        $this->getJson('/api/v1/products/'.$product->id.'/offers')->assertNotFound();
    }

    public function test_admin_can_publish_edit_and_remove_a_coupon_with_normalized_unique_code(): void
    {
        $product = Product::factory()->create();
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 1]);
        $this->actingAs($this->manager());
        $created = $this->postJson('/api/v1/admin/product-offers', [
            'scope_type' => 'product', 'product_id' => $product->id,
            'title' => 'Approved coupon', 'offer_type' => 'coupon', 'coupon_code' => ' test-100 ',
            'discount_type' => 'percent', 'discount_value' => 10,
            'minimum_order_amount' => 1000, 'is_active' => false,
        ])->assertCreated()->assertJsonPath('data.coupon_code', 'TEST-100');
        $id = $created->json('data.id');
        $this->getJson('/api/v1/admin/product-offers')->assertOk()->assertJsonPath('data.0.id', $id);
        $this->getJson('/api/v1/products/'.$product->id.'/offers')->assertJsonCount(0, 'data');

        $this->putJson('/api/v1/admin/product-offers/'.$id, ['is_active' => true, 'discount_value' => 15])
            ->assertOk()->assertJsonPath('data.discount_value', '15.00');
        $this->getJson('/api/v1/products/'.$product->id.'/offers')->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.discount_value', '15.00');
        $this->postJson('/api/v1/admin/product-offers', [
            'scope_type' => 'product', 'product_id' => $product->id,
            'title' => 'Duplicate coupon', 'offer_type' => 'coupon', 'coupon_code' => 'test-100',
        ])->assertUnprocessable()->assertJsonValidationErrors('coupon_code', 'error.details');

        $this->deleteJson('/api/v1/admin/product-offers/'.$id)->assertOk();
        $this->getJson('/api/v1/products/'.$product->id.'/offers')->assertJsonCount(0, 'data');
    }

    public function test_offer_validation_requires_one_matching_scope_and_consistent_terms(): void
    {
        $product = Product::factory()->create();
        $this->actingAs($this->manager());
        $base = [
            'scope_type' => 'product', 'product_id' => $product->id,
            'title' => 'Test coupon', 'offer_type' => 'coupon', 'coupon_code' => 'TEST100',
        ];

        $this->postJson('/api/v1/admin/product-offers', array_merge($base, ['category_id' => $product->category_id]))
            ->assertUnprocessable()->assertJsonValidationErrors('category_id', 'error.details');
        $this->postJson('/api/v1/admin/product-offers', array_merge($base, ['product_id' => null]))
            ->assertUnprocessable()->assertJsonValidationErrors('product_id', 'error.details');
        $this->postJson('/api/v1/admin/product-offers', array_merge($base, ['discount_type' => 'percent', 'discount_value' => 150]))
            ->assertUnprocessable()->assertJsonValidationErrors('discount_value', 'error.details');
        $this->postJson('/api/v1/admin/product-offers', array_merge($base, ['starts_at' => now()->addDay()->toIso8601String(), 'ends_at' => now()->toIso8601String()]))
            ->assertUnprocessable()->assertJsonValidationErrors('ends_at', 'error.details');
        $this->postJson('/api/v1/admin/product-offers', array_merge($base, ['discount_type' => 'fixed']))
            ->assertUnprocessable()->assertJsonValidationErrors('discount_value', 'error.details');
        $this->assertDatabaseCount('product_offers', 0);
    }

    public function test_offer_writes_require_catalog_permission_and_foreign_keys(): void
    {
        $this->postJson('/api/v1/admin/product-offers', [])->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/product-offers')->assertForbidden();
        $this->postJson('/api/v1/admin/product-offers', [])->assertForbidden();

        $this->actingAs($this->manager());
        $this->postJson('/api/v1/admin/product-offers', [
            'scope_type' => 'product', 'product_id' => '00000000-0000-4000-8000-000000000001',
            'title' => 'Invalid target', 'offer_type' => 'coupon', 'coupon_code' => 'INVALID100',
        ])->assertUnprocessable()->assertJsonValidationErrors('product_id', 'error.details');
        $this->assertDatabaseCount('product_offers', 0);
    }

    public function test_offer_migration_can_rollback_and_recreate_its_table(): void
    {
        $migration = require database_path('migrations/2026_10_21_100000_create_product_offers_table.php');
        $this->assertTrue(Schema::hasTable('product_offers'));
        $migration->down();
        $this->assertFalse(Schema::hasTable('product_offers'));
        $migration->up();
        $this->assertTrue(Schema::hasTable('product_offers'));
    }

    public function test_product_offer_database_rejects_an_unknown_target(): void
    {
        try {
            DB::table('product_offers')->insert([
                'id' => '00000000-0000-4000-8000-000000000002',
                'scope_type' => 'product',
                'product_id' => '00000000-0000-4000-8000-000000000001',
                'title' => 'Invalid target',
                'offer_type' => 'coupon',
                'coupon_code' => 'INVALID-FK',
            ]);
            $this->fail('The product foreign key must reject a missing product.');
        } catch (QueryException) {
            $this->assertDatabaseCount('product_offers', 0);
        }
    }

    private function availableProduct(array $attributes = []): Product
    {
        $product = Product::factory()->create($attributes);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);

        return $product;
    }

    private function offer(array $attributes = []): array
    {
        return array_merge([
            'scope_type' => 'product', 'product_id' => $attributes['product_id'] ?? null,
            'title' => 'Default coupon', 'offer_type' => 'coupon', 'coupon_code' => 'DEFAULT100',
            'discount_type' => 'percent', 'discount_value' => '10.00',
            'is_active' => true, 'sort_order' => 0,
        ], $attributes);
    }

    private function manager(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $user->roles()->attach($role);

        return $user;
    }
}
