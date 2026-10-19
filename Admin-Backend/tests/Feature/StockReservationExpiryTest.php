<?php

namespace Tests\Feature;

use App\Actions\AllocateOrderWarehouse;
use App\Actions\CreateOrder;
use App\Actions\ExpireStockReservations;
use App\Actions\ReserveOrderStock;
use App\Actions\SetWarehouseStock;
use App\Actions\TransitionOrderPayment;
use App\Actions\TransitionOrderStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockReservation;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class StockReservationExpiryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['inventory.reservation_ttl_minutes' => 7]);
        $this->freezeSecond();
    }

    public function test_reservation_deadline_uses_configured_ttl_and_retry_does_not_extend_it(): void
    {
        [$order, $stock] = $this->reserve();
        $reservation = $order->stockReservations()->sole();
        $this->assertTrue($reservation->expires_at->equalTo($reservation->reserved_at->addMinutes(7)));
        $deadline = $reservation->expires_at->toISOString();
        $this->travel(2)->minutes();
        app(ReserveOrderStock::class)->execute($order);
        $this->assertSame($deadline, $reservation->fresh()->expires_at->toISOString());
        $this->assertSame(2, $stock->fresh()->reserved_quantity);
        $this->assertSame(1, $stock->movements()->where('movement_type', 'RESERVE')->count());
    }

    public function test_expiry_at_deadline_releases_once_and_preserves_other_orders_holds(): void
    {
        [$order, $stock] = $this->reserve();
        $this->travel(1)->minutes();
        $other = $this->order($stock, 3);
        app(ReserveOrderStock::class)->execute($other);
        $this->travel(6)->minutes();

        $this->artisan('inventory:expire-reservations')->expectsOutput('Expired 1 reservation(s); 0 order(s) failed.')->assertSuccessful();
        $this->artisan('inventory:expire-reservations')->expectsOutput('Expired 0 reservation(s); 0 order(s) failed.')->assertSuccessful();
        $this->assertSame(0, app(ExpireStockReservations::class)->execute($order));
        $this->assertSame(20, $stock->fresh()->quantity);
        $this->assertSame(3, $stock->fresh()->reserved_quantity);
        $this->assertSame(17, $stock->fresh()->available_quantity);
        $reservation = $order->stockReservations()->sole();
        $this->assertSame(StockReservation::Expired, $reservation->status);
        $this->assertNotNull($reservation->released_at);
        $this->assertSame(StockReservation::Active, $other->stockReservations()->sole()->status);
        $movement = $stock->movements()->where('movement_type', 'RELEASE')->sole();
        $this->assertSame(0, $movement->quantity_delta);
        $this->assertSame(2, $movement->quantity);
        $this->assertSame($order->id, $movement->order_id);
    }

    public function test_future_hold_is_not_expired_and_invalid_ttl_cannot_reserve(): void
    {
        [$order, $stock] = $this->reserve();
        $this->assertSame(0, app(ExpireStockReservations::class)->execute($order));
        config(['inventory.reservation_ttl_minutes' => 0]);
        try {
            app(ReserveOrderStock::class)->execute($this->order($stock));
            $this->fail('A zero TTL must be rejected.');
        } catch (InvalidArgumentException) {
            $this->assertSame(2, $stock->fresh()->reserved_quantity);
            $this->assertDatabaseCount('stock_reservations', 1);
        }
    }

    public function test_payment_cannot_commit_after_deadline_even_before_scheduler_runs(): void
    {
        [$order, $stock] = $this->reserve();
        $payment = $order->payments()->create($this->payment());
        $this->travel(7)->minutes();
        try {
            app(TransitionOrderPayment::class)->execute($order, $payment, 'paid');
            $this->fail('An overdue active hold must not commit.');
        } catch (InvalidArgumentException $exception) {
            $this->assertStringContainsString('deadline', $exception->getMessage());
            $this->assertSame('authorized', $payment->fresh()->status);
            $this->assertSame('pending', $order->fresh()->status);
            $this->assertSame(20, $stock->fresh()->quantity);
        }
        app(ExpireStockReservations::class)->execute($order);
        try {
            app(TransitionOrderPayment::class)->execute($order, $payment, 'paid');
            $this->fail('An expired hold must not commit.');
        } catch (InvalidArgumentException) {
            $this->assertSame(0, $stock->fresh()->reserved_quantity);
            $this->assertSame(0, $stock->movements()->where('movement_type', 'COMMIT')->count());
            $this->assertSame('authorized', $payment->fresh()->status);
        }
    }

    public function test_paid_committed_stock_cannot_expire(): void
    {
        [$order, $stock] = $this->reserve();
        app(TransitionOrderPayment::class)->execute($order, $order->payments()->create($this->payment()), 'paid');
        $this->travel(8)->minutes();
        $this->assertSame(0, app(ExpireStockReservations::class)->execute($order));
        $this->assertSame(StockReservation::Committed, $order->stockReservations()->sole()->status);
        $this->assertSame(18, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertSame(0, $stock->movements()->where('movement_type', 'RELEASE')->count());
    }

    public function test_failed_payment_and_cancellation_release_once_even_when_expiry_runs_later(): void
    {
        foreach (['failed', 'cancelled'] as $operation) {
            [$order, $stock] = $this->reserve();
            if ($operation === 'failed') {
                app(TransitionOrderPayment::class)->execute($order, $order->payments()->create($this->payment()), 'failed');
            } else {
                app(TransitionOrderStatus::class)->execute($order, 'cancelled');
            }
            $this->travel(8)->minutes();
            $this->assertSame(0, app(ExpireStockReservations::class)->execute($order));
            $this->assertSame(20, $stock->fresh()->quantity);
            $this->assertSame(0, $stock->fresh()->reserved_quantity);
            $this->assertSame(StockReservation::Released, $order->stockReservations()->sole()->status);
            $this->assertSame(1, $stock->movements()->where('movement_type', 'RELEASE')->count());
        }
    }

    public function test_expiry_does_not_turn_an_inconsistent_balance_negative(): void
    {
        [$order, $stock] = $this->reserve();
        // Simulate pre-existing corruption to verify the safety check and transaction rollback.
        $stock->refresh()->update(['reserved_quantity' => 0]);
        $this->travel(7)->minutes();
        $this->assertTrue($order->stockReservations()->sole()->expires_at->lte(now()));
        $exit = \Illuminate\Support\Facades\Artisan::call('inventory:expire-reservations');
        $this->assertSame(1, $exit, \Illuminate\Support\Facades\Artisan::output());
        $this->assertSame(StockReservation::Active, $order->stockReservations()->sole()->status);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertSame(0, $stock->movements()->where('movement_type', 'RELEASE')->count());
    }

    public function test_allocation_remains_stock_neutral_and_reservation_shortage_blocks_payment(): void
    {
        $stock = app(SetWarehouseStock::class)->execute(Warehouse::factory()->create(), Product::factory()->create(), 20);
        $order = $this->order($stock, 2, false);
        app(AllocateOrderWarehouse::class)->execute($order, $stock->warehouse);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertSame(20, $stock->fresh()->quantity);
        // Another real order takes the remaining stock before reservation.
        app(ReserveOrderStock::class)->execute($this->order($stock, 20));
        try {
            app(ReserveOrderStock::class)->execute($order);
            $this->fail('Insufficient stock must fail safely.');
        } catch (InvalidArgumentException) {
            $this->assertSame(0, $order->stockReservations()->count());
            $this->assertSame('pending', $order->fresh()->status);
            $this->assertSame(20, $stock->fresh()->reserved_quantity);
        }
        $payment = $order->payments()->create($this->payment());
        try {
            app(TransitionOrderPayment::class)->execute($order, $payment, 'paid');
            $this->fail('Missing reservations must block payment commitment.');
        } catch (InvalidArgumentException) {
            $this->assertSame('authorized', $payment->fresh()->status);
            $this->assertSame(20, $stock->fresh()->quantity);
        }
    }

    public function test_api_returns_persisted_expiry_balances_and_timeline_after_reload(): void
    {
        [$order, $stock] = $this->reserve();
        $user = User::factory()->create();
        $role = Role::factory()->create();
        foreach (['orders.view', 'orders.manage', 'inventory.manage'] as $permission) {
            $role->permissions()->attach(Permission::factory()->create(['name' => $permission]));
        }
        $user->roles()->attach($role);
        $this->actingAs($user);
        $url = "/api/v1/admin/orders/{$order->id}";
        $payment = $order->payments()->create($this->payment());
        $expires = $order->stockReservations()->sole()->expires_at->toISOString();
        $activeResponse = $this->getJson($url)->assertOk()->assertJsonPath('data.inventory.items.0.expires_at', $expires)
            ->assertJsonPath('data.stock_reservations.0.expires_at', $expires)
            ->assertJsonPath('data.inventory.items.0.reserved', 2);
        $this->travel(7)->minutes();
        $before = $this->getJson($url)->assertOk()->json('data.allowed_actions.payment_statuses');
        $this->assertNotContains('paid', $before[$payment->id]);
        $this->artisan('inventory:expire-reservations')->assertSuccessful();
        $response = $this->getJson($url)->assertOk()->assertJsonPath('data.inventory.status', 'EXPIRED')
            ->assertJsonPath('data.inventory.items.0.physical', 20)
            ->assertJsonPath('data.inventory.items.0.reserved', 0)
            ->assertJsonPath('data.inventory.items.0.available', 20);
        $labels = array_column($response->json('data.inventory.timeline'), 'label');
        $this->assertContains('Reservation expired', $labels);
        $this->assertContains('Stock released', $labels);
        $this->getJson('/api/v1/admin/warehouse-stocks?view=matrix')->assertOk()
            ->assertJsonPath('data.0.warehouses.0.available', 20)
            ->assertJsonMissingPath('data.0.warehouses.0.physical')
            ->assertJsonMissingPath('data.0.warehouses.0.reserved');
        $this->getJson("/api/v1/admin/warehouses/{$stock->warehouse_id}/products/{$stock->product_id}/stock")
            ->assertOk()->assertJsonPath('data.reservations.0.status', 'EXPIRED')
            ->assertJsonPath('data.reservations.0.expires_at', $expires);

        [$paidOrder] = $this->reserve();
        app(TransitionOrderPayment::class)->execute($paidOrder, $paidOrder->payments()->create($this->payment()), 'paid');
        $paidResponse = $this->getJson('/api/v1/admin/orders/'.$paidOrder->id)->assertOk()
            ->assertJsonPath('data.inventory.items.0.reservation_status', 'COMMITTED')
            ->assertJsonPath('data.inventory.items.0.physical', 18)
            ->assertJsonPath('data.inventory.items.0.reserved', 0)
            ->assertJsonPath('data.inventory.items.0.available', 18);
        [$releasedOrder] = $this->reserve();
        app(TransitionOrderStatus::class)->execute($releasedOrder, 'cancelled');
        $releasedResponse = $this->getJson('/api/v1/admin/orders/'.$releasedOrder->id)->assertOk()
            ->assertJsonPath('data.inventory.status', 'RELEASED');
        if ($path = getenv('DURAFIT_INVENTORY_UI_FIXTURES')) {
            file_put_contents($path, json_encode([
                $activeResponse->json('data'), $response->json('data'),
                $paidResponse->json('data'), $releasedResponse->json('data'),
            ], JSON_THROW_ON_ERROR));
        }
    }

    public function test_migration_backfills_existing_active_deadlines_without_extending_them(): void
    {
        [$order] = $this->reserve();
        [$paidOrder] = $this->reserve();
        app(TransitionOrderPayment::class)->execute($paidOrder, $paidOrder->payments()->create($this->payment()), 'paid');
        $expected = $order->stockReservations()->sole()->expires_at->toISOString();
        $this->travel(8)->minutes();
        $migration = require database_path('migrations/2026_09_27_100000_add_stock_reservation_expiry.php');
        $migration->down();
        $migration->up();
        $this->assertSame($expected, $order->stockReservations()->sole()->expires_at->toISOString());
        $this->assertNull($paidOrder->stockReservations()->sole()->expires_at);
        $this->assertSame(1, app(ExpireStockReservations::class)->execute($order));
        $this->assertSame(0, app(ExpireStockReservations::class)->execute($paidOrder));
    }

    public function test_scheduler_runs_expiry_every_minute_without_overlapping(): void
    {
        $events = collect(app(Schedule::class)->events())->filter(fn ($event) => str_contains($event->command ?? '', 'inventory:expire-reservations'));
        $event = $events->sole();
        $this->assertSame('* * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
    }

    private function reserve(): array
    {
        $stock = app(SetWarehouseStock::class)->execute(Warehouse::factory()->create(), Product::factory()->create(), 20);
        $order = $this->order($stock);
        app(ReserveOrderStock::class)->execute($order);

        return [$order, $stock];
    }

    private function order(WarehouseStock $stock, int $quantity = 2, bool $allocated = true): Order
    {
        $address = ['name' => 'Expiry test', 'address' => 'Test address'];

        return app(CreateOrder::class)->execute(Customer::factory()->create(), fake()->unique()->uuid(), [
            ['product' => $stock->product, 'quantity' => $quantity, 'unit_price' => '100.00'],
        ], $address, $address, $allocated ? $stock->warehouse : null);
    }

    private function payment(): array
    {
        return ['provider' => 'test', 'provider_transaction_reference' => fake()->unique()->uuid(), 'amount' => '200.00', 'currency' => 'INR', 'status' => 'authorized'];
    }
}
