<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Actions\ReserveOrderStock;
use App\Models\Customer;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryReadApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_balances_movements_and_reservations_share_persisted_values(): void
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'inventory.manage']));
        $user->roles()->attach($role);
        $warehouse = Warehouse::factory()->create(['name' => 'Trichy']);
        $emptyWarehouse = Warehouse::factory()->create(['name' => 'Por']);
        $product = Product::factory()->create();
        WarehouseStock::factory()->create(['warehouse_id' => $warehouse->id, 'product_id' => $product->id, 'quantity' => 20]);
        $address = ['name' => 'Test', 'address' => 'Test'];
        $order = app(CreateOrder::class)->execute(Customer::factory()->create(), 'INV-READ', [['product' => $product, 'quantity' => 2, 'unit_price' => '100.00']], $address, $address, $warehouse);
        app(ReserveOrderStock::class)->execute($order, $user);
        $this->actingAs($user);
        $this->getJson('/api/v1/admin/warehouse-stocks?warehouse_id='.$warehouse->id)
            ->assertOk()->assertJsonPath('data.0.physical', 20)->assertJsonPath('data.0.reserved', 2)->assertJsonPath('data.0.available', 18);
        $this->getJson('/api/v1/admin/warehouse-stocks?view=matrix&search='.$product->sku)
            ->assertOk()->assertJsonPath('data.0.id', $product->id)
            ->assertJsonPath('data.0.warehouses.0.warehouse_id', $warehouse->id)
            ->assertJsonPath('data.0.warehouses.0.available', 18)
            ->assertJsonMissingPath('data.0.warehouses.0.physical')
            ->assertJsonMissingPath('data.0.warehouses.0.reserved')
            ->assertJsonMissing(['warehouse_id' => $emptyWarehouse->id]);
        $this->getJson('/api/v1/admin/warehouse-stocks?view=matrix&warehouse_id='.$emptyWarehouse->id)
            ->assertOk()->assertJsonPath('data.0.id', $product->id)->assertJsonCount(0, 'data.0.warehouses');
        $this->getJson('/api/v1/admin/stock-movements?movement_type=RESERVE&order=INV-READ')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.product.id', $product->id)
            ->assertJsonPath('data.0.quantity_delta', 0)->assertJsonPath('data.0.reservation_delta', 2)
            ->assertJsonPath('data.0.created_by.id', $user->id);
        $this->getJson("/api/v1/admin/warehouses/{$warehouse->id}/products/{$product->id}/stock")
            ->assertOk()->assertJsonPath('data.reservations.0.status', 'ACTIVE')->assertJsonPath('data.available_quantity', 18);
        $this->getJson('/api/v1/admin/stock-movements?movement_type=COMMIT')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/warehouse-stocks?per_page=1000')->assertUnprocessable();
    }

    public function test_inventory_reads_require_inventory_permission(): void
    {
        $this->getJson('/api/v1/admin/warehouse-stocks')->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/v1/admin/stock-movements')->assertForbidden();
    }

    public function test_stock_detail_history_is_bounded_and_can_be_paged_without_loading_it_for_balance_reads(): void
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'inventory.manage']));
        $user->roles()->attach($role);
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $stock = WarehouseStock::factory()->create(['warehouse_id' => $warehouse->id, 'product_id' => $product->id]);
        StockMovement::factory()->count(55)->create(['warehouse_stock_id' => $stock->id, 'created_by' => $user->id]);
        $url = "/api/v1/admin/warehouses/{$warehouse->id}/products/{$product->id}/stock";

        $this->actingAs($user)->getJson($url)
            ->assertOk()->assertJsonCount(50, 'data.movements')
            ->assertJsonPath('data.history.movements_has_more', true);
        $this->getJson($url.'?history_page=2')
            ->assertOk()->assertJsonCount(5, 'data.movements')
            ->assertJsonPath('data.history.movements_has_more', false);
        $this->getJson($url.'?include_history=0')
            ->assertOk()->assertJsonCount(0, 'data.movements')
            ->assertJsonPath('data.history', null);
        $this->getJson($url.'?history_per_page=101')->assertUnprocessable();
    }
}
