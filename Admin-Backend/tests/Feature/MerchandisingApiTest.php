<?php

namespace Tests\Feature;

use App\Models\MerchandisingSection;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchandisingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_assigns_featured_product_then_public_catalog_displays_the_same_record(): void
    {
        $product = Product::factory()->create(['name' => 'Featured Treadmill']);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 5]);
        $this->actingAs($this->manager());

        $this->postJson('/api/v1/admin/merchandising/featured/products', ['product_id' => $product->id, 'sort_order' => 2])
            ->assertCreated();
        $this->assertDatabaseHas('merchandising_products', ['product_id' => $product->id, 'sort_order' => 2]);
        $this->getJson('/api/v1/admin/merchandising/featured')
            ->assertOk()->assertJsonPath('data.items.0.product.id', $product->id);
        $this->getJson('/api/v1/merchandising/featured')
            ->assertOk()->assertJsonPath('data.0.id', $product->id);
    }

    public function test_duplicate_assignment_is_rejected_without_a_second_row(): void
    {
        $product = Product::factory()->create();
        $this->actingAs($this->manager());
        $url = '/api/v1/admin/merchandising/featured/products';
        $this->postJson($url, ['product_id' => $product->id])->assertCreated();

        $this->postJson($url, ['product_id' => $product->id])->assertUnprocessable();
        $this->assertDatabaseCount('merchandising_products', 1);
    }

    public function test_inactive_classification_cannot_be_assigned(): void
    {
        $product = Product::factory()->create();
        $product->category->update(['is_active' => false]);
        $this->actingAs($this->manager());

        $this->postJson('/api/v1/admin/merchandising/featured/products', ['product_id' => $product->id])
            ->assertUnprocessable();
        $this->assertDatabaseCount('merchandising_products', 0);
    }

    public function test_bestseller_order_status_and_removal_are_persisted(): void
    {
        $product = Product::factory()->create();
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 1]);
        $this->actingAs($this->manager());
        $url = "/api/v1/admin/merchandising/bestsellers/products/{$product->id}";
        $this->postJson('/api/v1/admin/merchandising/bestsellers/products', ['product_id' => $product->id])->assertCreated();

        $this->putJson($url, ['sort_order' => 7, 'is_active' => false])->assertOk();
        $this->assertDatabaseHas('merchandising_products', ['product_id' => $product->id, 'sort_order' => 7, 'is_active' => false]);
        $this->getJson('/api/v1/merchandising/bestsellers')->assertOk()->assertJsonCount(0, 'data');
        $this->deleteJson($url)->assertOk();
        $this->assertDatabaseCount('merchandising_products', 0);
        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    public function test_inactive_or_out_of_stock_products_are_hidden_from_public_placement(): void
    {
        $product = Product::factory()->create();
        $this->actingAs($this->manager());
        $this->postJson('/api/v1/admin/merchandising/featured/products', ['product_id' => $product->id])->assertCreated();
        $this->getJson('/api/v1/merchandising/featured')->assertOk()->assertJsonCount(0, 'data');

        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
        $product->update(['is_active' => false]);
        $this->getJson('/api/v1/merchandising/featured')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_public_placement_can_be_bounded_without_changing_the_default_feed(): void
    {
        $this->actingAs($this->manager());
        $products = collect(range(1, 3))->map(function (int $position): Product {
            $product = Product::factory()->create(['name' => "Bestseller {$position}"]);
            WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
            $this->postJson('/api/v1/admin/merchandising/bestsellers/products', [
                'product_id' => $product->id,
                'sort_order' => $position,
            ])->assertCreated();

            return $product;
        });

        $this->getJson('/api/v1/merchandising/bestsellers?limit=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $products[0]->id)
            ->assertJsonPath('data.1.id', $products[1]->id);
        $this->getJson('/api/v1/merchandising/bestsellers')->assertOk()->assertJsonCount(3, 'data');
        $this->getJson('/api/v1/merchandising/bestsellers?limit=0')->assertUnprocessable();
    }

    public function test_admin_placement_requires_catalog_permission(): void
    {
        $product = Product::factory()->create();
        $url = '/api/v1/admin/merchandising/featured/products';
        $this->postJson($url, ['product_id' => $product->id])->assertUnauthorized();

        $this->actingAs(User::factory()->create());
        $this->postJson($url, ['product_id' => $product->id])->assertForbidden();
        $this->assertDatabaseCount('merchandising_sections', 0);
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
