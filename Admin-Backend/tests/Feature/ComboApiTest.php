<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComboApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalogue_manager_creates_updates_and_lists_a_combo_with_product_items(): void
    {
        $manager = $this->catalogManager();
        $first = Product::factory()->create(['name' => 'Treadmill Mat', 'sku' => 'MAT-001']);
        $second = Product::factory()->create(['name' => 'Pulse Monitor', 'sku' => 'MON-001']);

        $combo = $this->actingAs($manager)->postJson('/api/v1/admin/combos', [
            'name' => 'Home Fitness Bundle',
            'is_active' => true,
            'items' => [
                ['product_id' => $first->id, 'quantity' => 1],
                ['product_id' => $second->id, 'quantity' => 2],
            ],
        ])->assertCreated()
            ->assertJsonFragment(['product_id' => $second->id, 'quantity' => 2])
            ->json('data');

        $this->actingAs($manager)->putJson("/api/v1/admin/combos/{$combo['id']}", [
            'name' => 'Home Fitness Essentials',
            'is_active' => false,
            'items' => [
                ['product_id' => $first->id, 'quantity' => 3],
            ],
        ])->assertOk()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.quantity', 3);

        $this->assertDatabaseHas('combos', ['id' => $combo['id'], 'name' => 'Home Fitness Essentials', 'is_active' => false]);
        $this->assertDatabaseCount('combo_items', 1);
        $this->actingAs($manager)->getJson('/api/v1/admin/combos')
            ->assertOk()
            ->assertJsonPath('data.0.items.0.sku', 'MAT-001');
    }

    public function test_combo_item_product_ids_must_be_unique_and_quantities_positive(): void
    {
        $manager = $this->catalogManager();
        $product = Product::factory()->create();

        $this->actingAs($manager)->postJson('/api/v1/admin/combos', [
            'name' => 'Invalid Bundle',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
                ['product_id' => $product->id, 'quantity' => 0],
            ],
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation.failed');

        $this->assertDatabaseCount('combos', 0);
    }

    public function test_public_buy_it_with_returns_only_available_partners_from_active_combos(): void
    {
        $primary = Product::factory()->create();
        $available = Product::factory()->create();
        $unavailable = Product::factory()->create();
        WarehouseStock::factory()->create(['product_id' => $primary->id, 'quantity' => 2]);
        WarehouseStock::factory()->create(['product_id' => $available->id, 'quantity' => 2]);

        $this->actingAs($this->catalogManager());
        $combo = $this->postJson('/api/v1/admin/combos', [
            'name' => 'Workout partners',
            'is_active' => true,
            'items' => [
                ['product_id' => $primary->id, 'quantity' => 1],
                ['product_id' => $available->id, 'quantity' => 1],
                ['product_id' => $unavailable->id, 'quantity' => 1],
            ],
        ])->assertCreated()->json('data');

        $this->getJson("/api/v1/products/{$primary->id}/buy-it-with")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $available->id);

        $this->putJson("/api/v1/admin/combos/{$combo['id']}", [
            'name' => 'Workout partners',
            'is_active' => false,
        ])->assertOk();
        $this->getJson("/api/v1/products/{$primary->id}/buy-it-with")
            ->assertOk()->assertJsonCount(0, 'data');

        $primary->update(['is_active' => false]);
        $this->getJson("/api/v1/products/{$primary->id}/buy-it-with")->assertNotFound();
    }

    private function catalogManager(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $permission = Permission::factory()->create(['name' => 'catalog.manage']);
        $role->permissions()->attach($permission);
        $user->roles()->attach($role);

        return $user;
    }
}
