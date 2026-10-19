<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderAdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_roles_keep_catalog_and_sales_permissions_separate(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(RolesAndPermissionsSeeder::class);

        $catalogManager = Role::query()->where('slug', 'catalog-manager')->sole();
        $salesManager = Role::query()->where('slug', 'sales-manager')->sole();

        $this->assertEqualsCanonicalizing(
            ['catalog.manage', 'inventory.manage'],
            $catalogManager->permissions()->pluck('name')->all(),
        );
        $this->assertEqualsCanonicalizing(
            ['orders.view', 'orders.manage'],
            $salesManager->permissions()->pluck('name')->all(),
        );
    }

    public function test_catalog_manager_is_forbidden_while_sales_manager_can_operate_orders(): void
    {
        $order = $this->createOrder('ORD-ROLE-BOUNDARY');
        $this->seed(RolesAndPermissionsSeeder::class);
        $catalogUser = User::factory()->create();
        $catalogUser->roles()->attach(Role::query()->where('slug', 'catalog-manager')->sole());

        $this->actingAs($catalogUser)->getJson('/api/v1/admin/orders')->assertForbidden();
        $this->postJson("/api/v1/admin/orders/{$order->id}/status", [
            'current_status' => 'pending', 'status' => 'cancelled',
        ])->assertForbidden();

        $salesUser = User::factory()->create();
        $salesUser->roles()->attach(Role::query()->where('slug', 'sales-manager')->sole());
        $this->actingAs($salesUser)->getJson('/api/v1/admin/orders')->assertOk();
        $this->postJson("/api/v1/admin/orders/{$order->id}/status", [
            'current_status' => 'pending', 'status' => 'cancelled',
        ])->assertOk()->assertJsonPath('data.status', 'cancelled');
    }

    public function test_orders_endpoints_require_authentication_and_orders_permission(): void
    {
        $order = $this->createOrder('ORD-SECURITY');

        foreach (['/api/v1/admin/orders', '/api/v1/admin/orders/abandoned', "/api/v1/admin/orders/{$order->id}"] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->postJson("/api/v1/admin/orders/{$order->id}/status", ['current_status' => 'pending', 'status' => 'confirmed'])
            ->assertUnauthorized();

        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/orders')->assertForbidden();
        $this->getJson('/api/v1/admin/orders/abandoned')->assertForbidden();
        $this->getJson("/api/v1/admin/orders/{$order->id}")->assertForbidden();
        $this->postJson("/api/v1/admin/orders/{$order->id}/status", ['current_status' => 'pending', 'status' => 'confirmed'])
            ->assertForbidden();
        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_order_read_permission_does_not_grant_status_updates(): void
    {
        $order = $this->createOrder('ORD-READ-ONLY');
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'orders.view']));
        $user->roles()->attach($role);

        $this->actingAs($user)->getJson("/api/v1/admin/orders/{$order->id}")->assertOk();
        $this->postJson("/api/v1/admin/orders/{$order->id}/status", ['current_status' => 'pending', 'status' => 'confirmed'])
            ->assertForbidden();
    }

    public function test_index_filters_searches_sorts_and_paginates_with_stable_metadata(): void
    {
        $first = $this->createOrder('ORD-1001', 'Alice Runner');
        $second = $this->createOrder('ORD-1002', 'Bob Lifter');
        $third = $this->createOrder('ORD-1003', 'Carol Runner');
        $first->update(['placed_at' => '2026-09-20 12:00:00']);
        $second->update(['placed_at' => '2026-09-21 12:00:00']);
        $third->update(['placed_at' => '2026-09-22 12:00:00']);
        $this->manager();

        $this->getJson('/api/v1/admin/orders?per_page=1&sort=order_number&direction=asc')
            ->assertOk()
            ->assertJsonPath('data.0.order_number', 'ORD-1001')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.per_page', 1);
        $this->getJson('/api/v1/admin/orders?search=Bob')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.order_number', 'ORD-1002');
        $this->getJson('/api/v1/admin/orders?search=ORD-1003')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/orders?payment_status=pending&status=pending&date_from=2026-09-21&date_to=2026-09-21')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.order_number', 'ORD-1002');
        $this->getJson('/api/v1/admin/orders?per_page=101')->assertUnprocessable();
        $this->getJson('/api/v1/admin/orders?sort=customer_name')->assertUnprocessable();
        $this->getJson('/api/v1/admin/orders?date_from=2026-09-23&date_to=2026-09-20')->assertUnprocessable();
    }

    public function test_show_returns_snapshots_payments_shipments_and_history(): void
    {
        $order = $this->createOrder('ORD-DETAIL');
        $item = $order->items->first();
        $order->payments()->create([
            'provider' => 'test', 'provider_transaction_reference' => 'PAY-DETAIL',
            'amount' => '100.00', 'currency' => 'INR', 'status' => 'pending',
        ]);
        $order->shipments()->create(['carrier' => 'Test carrier', 'status' => 'pending']);
        $item->product->update(['name' => 'Changed live product']);
        $order->customer->delete();
        $this->manager();

        $this->getJson("/api/v1/admin/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.customer.name', 'Test Customer')
            ->assertJsonPath('data.items.0.product_name', $item->product_name)
            ->assertJsonPath('data.items.0.product_sku', $item->product_sku)
            ->assertJsonPath('data.items.0.discount_amount', null)
            ->assertJsonPath('data.billing_address.name', 'Billing Customer')
            ->assertJsonPath('data.shipping_address.name', 'Shipping Customer')
            ->assertJsonPath('data.payments.0.provider_transaction_reference', 'PAY-DETAIL')
            ->assertJsonPath('data.shipments.0.carrier', 'Test carrier')
            ->assertJsonPath('data.status_history.0.to_status', 'pending')
            ->assertJsonPath('data.allowed_actions.order_statuses.0', 'cancelled')
            ->assertJsonPath('data.allowed_actions.payment_statuses.'.$order->payments->first()->id.'.0', 'authorized')
            ->assertJsonPath('data.total_amount', '100.00');
        $this->getJson('/api/v1/admin/orders/not-a-uuid')->assertNotFound();
    }

    public function test_status_update_uses_existing_action_and_rejects_stale_or_invalid_requests(): void
    {
        $order = $this->createOrder('ORD-STATUS');
        $manager = $this->manager();
        $endpoint = "/api/v1/admin/orders/{$order->id}/status";

        $this->postJson($endpoint, ['current_status' => 'pending', 'status' => 'hold'])
            ->assertOk()->assertJsonPath('data.status', 'hold')
            ->assertJsonPath('data.allowed_actions.order_statuses.0', 'pending')
            ->assertJsonPath('data.status_history.1.changed_by', $manager->id);
        $this->postJson($endpoint, ['current_status' => 'pending', 'status' => 'hold'])
            ->assertOk()->assertJsonPath('data.status', 'hold');
        $this->postJson($endpoint, ['current_status' => 'pending', 'status' => 'processing'])
            ->assertStatus(409)->assertJsonPath('error.code', 'order.status_conflict');
        $this->postJson($endpoint, ['current_status' => 'hold', 'status' => 'completed'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'validation.failed');
        $this->postJson($endpoint, ['status' => 'processing'])->assertUnprocessable();
        $this->postJson($endpoint, ['current_status' => 'hold', 'status' => 'shipped'])->assertUnprocessable();
        $this->postJson($endpoint, ['current_status' => 'hold', 'status' => 'hold'])
            ->assertOk()->assertJsonPath('data.status', 'hold');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'hold']);
        $this->assertSame(2, $order->statusHistories()->count());
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_abandoned_endpoint_lists_only_explicitly_abandoned_orders(): void
    {
        $abandoned = $this->createOrder('ORD-ABANDONED');
        $this->createOrder('ORD-PENDING');
        $this->manager();
        $this->postJson("/api/v1/admin/orders/{$abandoned->id}/status", ['current_status' => 'pending', 'status' => 'abandoned'])
            ->assertOk();

        $this->getJson('/api/v1/admin/orders/abandoned?status=pending')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', 'ORD-ABANDONED')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_allocation_reservation_and_payment_are_separate_persisted_operations(): void
    {
        $order = $this->createOrder('ORD-INVENTORY', 'Test Customer', 2);
        $warehouse = Warehouse::factory()->create();
        $stock = WarehouseStock::factory()->create([
            'warehouse_id' => $warehouse->id, 'product_id' => $order->items()->first()->product_id,
            'quantity' => 20, 'reserved_quantity' => 0,
        ]);
        $this->manager();
        $url = "/api/v1/admin/orders/{$order->id}";
        $this->assertSame(20, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->postJson("{$url}/reserve")->assertUnprocessable();
        $this->putJson("{$url}/warehouse", ['warehouse_id' => $warehouse->id])->assertOk()
            ->assertJsonPath('data.inventory.items.0.physical', 20)
            ->assertJsonPath('data.inventory.items.0.reserved', 0)
            ->assertJsonPath('data.inventory.items.0.available', 20);
        $payment = $order->payments()->create([
            'provider' => 'test', 'provider_transaction_reference' => 'inventory-test',
            'amount' => '200.00', 'currency' => 'INR', 'status' => 'authorized',
        ]);
        $this->postJson("{$url}/payments/{$payment->id}/status", ['status' => 'paid'])->assertUnprocessable();
        $this->postJson("{$url}/reserve")->assertOk()
            ->assertJsonPath('data.inventory.items.0.reserved', 2)
            ->assertJsonPath('data.inventory.items.0.available', 18);
        $this->postJson("{$url}/reserve")->assertOk();
        $this->postJson("{$url}/payments/{$payment->id}/status", ['status' => 'paid'])->assertOk()
            ->assertJsonPath('data.inventory.items.0.physical', 18)
            ->assertJsonPath('data.inventory.items.0.reserved', 0)
            ->assertJsonPath('data.inventory.items.0.available', 18)
            ->assertJsonPath('data.inventory.items.0.commit_status', 'COMPLETED');
        $this->postJson("{$url}/payments/{$payment->id}/status", ['status' => 'paid'])->assertOk();
        foreach (['processing', 'picked', 'packed', 'invoiced', 'ready_to_ship', 'completed'] as $status) {
            $previous = $order->fresh()->status;
            $this->postJson("{$url}/status", ['current_status' => $previous, 'status' => $status])
                ->assertOk()->assertJsonPath('data.status', $status);
        }
        $shipment = $order->shipments()->create(['warehouse_id' => $warehouse->id, 'carrier' => 'Test carrier', 'status' => 'pending']);
        foreach (['processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'] as $status) {
            $this->postJson("{$url}/shipments/{$shipment->id}/status", ['status' => $status])
                ->assertOk()->assertJsonPath('data.inventory.items.0.physical', 18)
                ->assertJsonPath('data.inventory.items.0.available', 18);
        }
        $this->assertSame(18, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_movements', 2);
        foreach ($stock->movements as $movement) {
            $this->assertSame($warehouse->id, $movement->warehouse_id);
            $this->assertSame($order->items()->first()->product_id, $movement->product_id);
            $this->assertSame($order->id, $movement->order_id);
            $this->assertSame($order->items()->first()->id, $movement->order_item_id);
            $this->assertNotEmpty($movement->idempotency_key);
        }
    }

    public function test_existing_pending_payment_order_can_allocate_reserve_and_commit(): void
    {
        $order = $this->createOrder('ORD-LEGACY-INVENTORY', 'Test Customer', 2);
        $order->update(['status' => 'PENDING_PAYMENT', 'payment_status' => 'PENDING']);
        $warehouse = Warehouse::factory()->create();
        $stock = WarehouseStock::factory()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $order->items()->sole()->product_id,
            'quantity' => 20,
            'reserved_quantity' => 0,
        ]);
        $this->manager();
        $url = "/api/v1/admin/orders/{$order->id}";

        $this->getJson('/api/v1/admin/orders?status=pending&payment_status=pending')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'pending');
        $this->getJson($url)->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.payment_status', 'pending')
            ->assertJsonPath('data.inventory.can_allocate', true);
        $this->putJson("{$url}/warehouse", ['warehouse_id' => $warehouse->id])->assertOk()
            ->assertJsonPath('data.inventory.items.0.physical', 20);
        $this->postJson("{$url}/reserve")->assertOk()
            ->assertJsonPath('data.inventory.items.0.reserved', 2)
            ->assertJsonPath('data.inventory.items.0.available', 18);
        $payment = $order->payments()->create([
            'provider' => 'test', 'provider_transaction_reference' => 'legacy-inventory-test',
            'amount' => '200.00', 'currency' => 'INR', 'status' => 'authorized',
        ]);
        $this->postJson("{$url}/payments/{$payment->id}/status", ['status' => 'paid'])->assertOk()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.inventory.items.0.physical', 18)
            ->assertJsonPath('data.inventory.items.0.reserved', 0);

        $this->assertSame(18, $stock->fresh()->quantity);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'confirmed', 'payment_status' => 'paid']);
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_allocation_rejects_insufficient_warehouse_stock_without_reserving(): void
    {
        $order = $this->createOrder('ORD-ALLOCATION-STOCK', 'Test Customer', 2);
        $empty = Warehouse::factory()->create();
        $insufficient = Warehouse::factory()->create();
        $eligible = Warehouse::factory()->create();
        $productId = $order->items()->sole()->product_id;
        $lowStock = WarehouseStock::factory()->create([
            'warehouse_id' => $insufficient->id, 'product_id' => $productId,
            'quantity' => 2, 'reserved_quantity' => 1,
        ]);
        $readyStock = WarehouseStock::factory()->create([
            'warehouse_id' => $eligible->id, 'product_id' => $productId,
            'quantity' => 3, 'reserved_quantity' => 1,
        ]);
        $this->manager();
        $url = "/api/v1/admin/orders/{$order->id}/warehouse";

        $this->putJson($url, ['warehouse_id' => $empty->id])->assertUnprocessable();
        $this->putJson($url, ['warehouse_id' => $insufficient->id])->assertUnprocessable();
        $this->assertNull($order->fresh()->warehouse_id);
        $this->assertSame(2, $lowStock->fresh()->quantity);
        $this->assertSame(1, $lowStock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_reservations', 0);

        $this->putJson($url, ['warehouse_id' => $eligible->id])->assertOk()
            ->assertJsonPath('data.warehouse.id', $eligible->id);
        $this->putJson($url, ['warehouse_id' => $eligible->id])->assertOk();
        $this->assertSame(3, $readyStock->fresh()->quantity);
        $this->assertSame(1, $readyStock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_movements', 0);
        $this->assertDatabaseCount('stock_reservations', 0);
    }

    public function test_nearest_eligible_warehouse_allocation_uses_persisted_coordinates_and_stock(): void
    {
        $order = $this->createLocatedOrder('ORD-NEAREST', 2);
        $near = Warehouse::factory()->create([
            'name' => 'Near', 'address' => 'Verified near address', 'city' => 'Tiruchirappalli',
            'state' => 'Tamil Nadu', 'postal_code' => '620015', 'latitude' => 10.7630, 'longitude' => 78.7144,
        ]);
        $far = Warehouse::factory()->create([
            'name' => 'Far', 'address' => 'Verified far address', 'city' => 'Vadodara',
            'state' => 'Gujarat', 'postal_code' => '391243', 'latitude' => 22.3072, 'longitude' => 73.1812,
        ]);
        $productId = $order->items()->sole()->product_id;
        $nearStock = WarehouseStock::factory()->create(['warehouse_id' => $near->id, 'product_id' => $productId, 'quantity' => 20]);
        WarehouseStock::factory()->create(['warehouse_id' => $far->id, 'product_id' => $productId, 'quantity' => 20]);
        $this->manager();
        $url = "/api/v1/admin/orders/{$order->id}";

        $this->putJson("{$url}/warehouse", [])->assertOk()->assertJsonPath('data.warehouse.id', $near->id)
            ->assertJsonPath('data.inventory.items.0.available', 20);
        $this->putJson("{$url}/warehouse", [])->assertOk();
        $this->assertSame(20, $nearStock->fresh()->quantity);
        $this->assertSame(0, $nearStock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_movements', 0);
        $this->postJson("{$url}/reserve")->assertOk()->assertJsonPath('data.inventory.items.0.available', 18);
        $this->postJson("{$url}/reserve")->assertOk();
        $payment = $order->payments()->create([
            'provider' => 'test', 'provider_transaction_reference' => 'nearest-payment',
            'amount' => '200.00', 'currency' => 'INR', 'status' => 'authorized',
        ]);
        $this->postJson("{$url}/payments/{$payment->id}/status", ['status' => 'paid'])
            ->assertOk()->assertJsonPath('data.inventory.items.0.available', 18);
        $this->postJson("{$url}/payments/{$payment->id}/status", ['status' => 'paid'])->assertOk();
        $this->assertSame(18, $nearStock->fresh()->quantity);
        $this->assertSame(0, $nearStock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_nearest_allocation_skips_insufficient_warehouse_and_never_guesses_missing_location(): void
    {
        $order = $this->createLocatedOrder('ORD-NEXT-ELIGIBLE', 2);
        $near = Warehouse::factory()->create([
            'address' => 'Near address', 'city' => 'Tiruchirappalli', 'state' => 'Tamil Nadu',
            'postal_code' => '620015', 'latitude' => 10.7630, 'longitude' => 78.7144,
        ]);
        $far = Warehouse::factory()->create([
            'address' => 'Far address', 'city' => 'Vadodara', 'state' => 'Gujarat',
            'postal_code' => '391243', 'latitude' => 22.3072, 'longitude' => 73.1812,
        ]);
        $productId = $order->items()->sole()->product_id;
        $nearStock = WarehouseStock::factory()->create(['warehouse_id' => $near->id, 'product_id' => $productId, 'quantity' => 2, 'reserved_quantity' => 1]);
        $farStock = WarehouseStock::factory()->create(['warehouse_id' => $far->id, 'product_id' => $productId, 'quantity' => 3, 'reserved_quantity' => 1]);
        $this->manager();
        $this->putJson("/api/v1/admin/orders/{$order->id}/warehouse", [])->assertOk()->assertJsonPath('data.warehouse.id', $far->id);
        $this->assertSame(2, $nearStock->fresh()->quantity);
        $this->assertSame(1, $farStock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_reservations', 0);

        $unavailable = $this->createLocatedOrder('ORD-NO-ELIGIBLE', 3);
        $this->putJson("/api/v1/admin/orders/{$unavailable->id}/warehouse", [])->assertUnprocessable();
        $this->assertNull($unavailable->fresh()->warehouse_id);
        $this->assertDatabaseCount('stock_reservations', 0);

        $missingAddress = $this->createOrder('ORD-NO-ADDRESS');
        $this->putJson("/api/v1/admin/orders/{$missingAddress->id}/warehouse", [])->assertUnprocessable()
            ->assertJsonPath('error.details.warehouse_id.0', 'A shipping address with state, city, postal code and coordinates is required for automatic allocation.');
        $this->assertNull($missingAddress->fresh()->warehouse_id);
    }

    public function test_nearest_allocation_rejects_warehouses_without_verified_location(): void
    {
        $order = $this->createLocatedOrder('ORD-NO-WAREHOUSE-LOCATION', 1);
        $warehouse = Warehouse::factory()->create(['name' => 'Legacy location']);
        WarehouseStock::factory()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $order->items()->sole()->product_id,
            'quantity' => 20,
        ]);
        $this->manager();
        $this->putJson("/api/v1/admin/orders/{$order->id}/warehouse", [])->assertUnprocessable()
            ->assertJsonPath('error.details.warehouse_id.0', 'No warehouse has complete location data for automatic allocation.');
        $this->assertNull($order->fresh()->warehouse_id);
        $this->assertDatabaseCount('stock_reservations', 0);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    private function createLocatedOrder(string $number, int $quantity): Order
    {
        return app(CreateOrder::class)->execute(
            Customer::factory()->create(), $number,
            [['product' => Product::factory()->create(), 'quantity' => $quantity, 'unit_price' => '100.00']],
            ['name' => 'Billing Customer', 'address' => 'Billing Road'],
            ['name' => 'Shipping Customer', 'address' => 'Delivery Road', 'state' => 'Tamil Nadu',
                'city' => 'Tiruchirappalli', 'postal_code' => '620015', 'latitude' => '10.7629', 'longitude' => '78.7143'],
        );
    }

    private function createOrder(string $number, string $customerName = 'Test Customer', int $quantity = 1): Order
    {
        return app(CreateOrder::class)->execute(
            Customer::factory()->create(['name' => $customerName]),
            $number,
            [['product' => Product::factory()->create(['name' => 'Snapshot Product']), 'quantity' => $quantity, 'unit_price' => '100.00']],
            ['name' => 'Billing Customer', 'address' => 'Billing Road'],
            ['name' => 'Shipping Customer', 'address' => 'Shipping Road'],
        );
    }

    private function manager(): User
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', 'sales-manager')->sole();
        $user->roles()->attach($role);
        $this->actingAs($user);

        return $user;
    }
}
