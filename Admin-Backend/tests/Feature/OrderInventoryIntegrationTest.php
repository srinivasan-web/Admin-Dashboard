<?php

namespace Tests\Feature;

use App\Actions\AllocateOrderWarehouse;
use App\Actions\CreateOrder;
use App\Actions\ReserveOrderStock;
use App\Actions\TransitionOrderPayment;
use App\Actions\TransitionOrderShipment;
use App\Actions\TransitionOrderStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockReservation;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class OrderInventoryIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_retry_after_order_processing_preserves_progress_and_audit_records(): void
    {
        [$order, $stock] = $this->stockedOrder(1);
        $payment = $order->payments()->create($this->paymentData());
        $payments = app(TransitionOrderPayment::class);
        $payments->execute($order, $payment, 'authorized');
        $paid = $payments->execute($order, $payment, 'paid');
        $paidAt = $paid->paid_at->toISOString();
        app(TransitionOrderStatus::class)->execute($order, 'processing');
        $histories = $order->statusHistories()->count();

        $this->travel(1)->hours();
        $retry = $payments->execute($order, $payment, 'paid');

        $this->assertSame('processing', $order->fresh()->status);
        $this->assertSame($paidAt, $retry->paid_at->toISOString());
        $this->assertSame($histories, $order->statusHistories()->count());
        $this->assertSame(9, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_warehouse_order_reserves_and_paid_payment_commits_stock_exactly_once(): void
    {
        [$order, $stock] = $this->stockedOrder(3);

        $this->assertSame(10, $stock->fresh()->quantity);
        $this->assertSame(3, $stock->fresh()->reserved_quantity);
        $this->assertSame(7, $stock->fresh()->available_quantity);
        $this->assertDatabaseHas('stock_reservations', ['order_id' => $order->id, 'status' => StockReservation::Active]);

        $payment = $order->payments()->create($this->paymentData());
        $action = app(TransitionOrderPayment::class);
        $action->execute($order, $payment, 'authorized');
        $paid = $action->execute($order, $payment, 'paid');
        $action->execute($order, $paid, 'paid');

        $this->assertSame(7, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertSame('confirmed', $order->fresh()->status);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertNotNull($paid->fresh()->paid_at);
        $this->assertDatabaseCount('stock_movements', 2);
        $this->assertDatabaseHas('stock_reservations', ['order_id' => $order->id, 'status' => StockReservation::Committed]);
    }

    public function test_failed_payment_releases_reservation_without_changing_physical_stock(): void
    {
        [$order, $stock] = $this->stockedOrder(2);
        $payment = $order->payments()->create($this->paymentData());

        app(TransitionOrderPayment::class)->execute($order, $payment, 'failed');

        $this->assertSame(10, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertDatabaseHas('stock_reservations', ['order_id' => $order->id, 'status' => StockReservation::Released]);
    }

    public function test_pre_shipment_cancellation_restores_committed_stock_once(): void
    {
        [$order, $stock] = $this->stockedOrder(4);
        $payment = $order->payments()->create($this->paymentData());
        $payments = app(TransitionOrderPayment::class);
        $payments->execute($order, $payment, 'authorized');
        $payments->execute($order, $payment, 'paid');

        $statuses = app(TransitionOrderStatus::class);
        $statuses->execute($order, 'cancelled');
        $statuses->execute($order, 'cancelled');

        $this->assertSame(10, $stock->fresh()->quantity);
        $this->assertDatabaseCount('stock_movements', 3);
        $this->assertDatabaseHas('stock_movements', [
            'order_id' => $order->id,
            'movement_type' => 'RESTORE',
            'quantity_delta' => 4,
        ]);
    }

    public function test_shipment_never_deducts_again_and_shipped_order_cannot_be_cancelled(): void
    {
        [$order, $stock] = $this->stockedOrder(1);
        $payment = $order->payments()->create($this->paymentData());
        $payments = app(TransitionOrderPayment::class);
        $payments->execute($order, $payment, 'authorized');
        $payments->execute($order, $payment, 'paid');
        $shipment = $order->shipments()->create([
            'warehouse_id' => $order->warehouse_id,
            'carrier' => 'Test courier',
            'tracking_reference' => 'AWB-1',
            'status' => 'pending',
        ]);
        $shipments = app(TransitionOrderShipment::class);
        $shipments->execute($order, $shipment, 'processing');
        $shipments->execute($order, $shipment, 'shipped');

        $this->assertSame(9, $stock->fresh()->quantity);
        $this->assertDatabaseCount('stock_movements', 2);
        $this->expectException(InvalidArgumentException::class);
        app(TransitionOrderStatus::class)->execute($order, 'cancelled');
    }

    /** @return array{0: Order, 1: WarehouseStock} */
    private function stockedOrder(int $quantity): array
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $stock = WarehouseStock::factory()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);
        $address = ['name' => 'Customer', 'address' => 'Address'];
        $order = app(CreateOrder::class)->execute(
            Customer::factory()->create(),
            fake()->unique()->bothify('ORD-INV-####'),
            [['product' => $product, 'quantity' => $quantity, 'unit_price' => '100.00']],
            $address,
            $address,
            $warehouse,
        );
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        app(ReserveOrderStock::class)->execute($order);

        return [$order, $stock];
    }

    private function paymentData(): array
    {
        return [
            'method' => 'card',
            'provider' => 'test',
            'provider_transaction_reference' => fake()->unique()->uuid(),
            'amount' => '100.00',
            'currency' => 'INR',
            'status' => 'pending',
        ];
    }

    public function test_insufficient_stock_rejects_a_second_order_without_partial_mutation(): void
    {
        [$first, $stock] = $this->stockedOrder(10);
        $address = ['name' => 'Customer', 'address' => 'Address'];
        $second = app(CreateOrder::class)->execute(Customer::factory()->create(), 'SECOND-REQUEST', [
            ['product' => $stock->product, 'quantity' => 1, 'unit_price' => '100.00'],
        ], $address, $address, $stock->warehouse);
        try {
            app(ReserveOrderStock::class)->execute($second);
            $this->fail('Unavailable stock must be rejected.');
        } catch (InvalidArgumentException) {
            $this->assertSame(10, $stock->fresh()->quantity);
            $this->assertSame(10, $stock->fresh()->reserved_quantity);
            $this->assertSame(0, $stock->fresh()->available_quantity);
            $this->assertDatabaseMissing('stock_reservations', ['order_id' => $second->id]);
            $this->assertDatabaseCount('stock_movements', 1);
        }
    }

    public function test_cancel_before_commit_releases_and_prevents_reservation_reuse(): void
    {
        [$order, $stock] = $this->stockedOrder(2);
        app(TransitionOrderStatus::class)->execute($order, 'cancelled');
        $this->assertSame(10, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertDatabaseHas('stock_movements', ['order_id' => $order->id, 'movement_type' => 'RELEASE', 'quantity_delta' => 0]);
        $this->expectException(InvalidArgumentException::class);
        app(ReserveOrderStock::class)->execute($order);
    }

    public function test_warehouse_cannot_change_after_reservation(): void
    {
        [$order] = $this->stockedOrder(1);
        $this->expectException(InvalidArgumentException::class);
        app(AllocateOrderWarehouse::class)->execute($order, Warehouse::factory()->create());
    }

    public function test_fulfillment_milestones_never_deduct_committed_stock_again(): void
    {
        [$order, $stock] = $this->stockedOrder(2);
        $payment = $order->payments()->create($this->paymentData());
        app(TransitionOrderPayment::class)->execute($order, $payment, 'authorized');
        app(TransitionOrderPayment::class)->execute($order, $payment, 'paid');
        foreach (['processing', 'picked', 'packed', 'invoiced', 'ready_to_ship', 'completed'] as $status) {
            app(TransitionOrderStatus::class)->execute($order, $status);
        }
        $shipment = $order->shipments()->create(['warehouse_id' => $order->warehouse_id, 'carrier' => 'Test', 'status' => 'pending']);
        foreach (['processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'] as $status) {
            app(TransitionOrderShipment::class)->execute($order, $shipment, $status);
        }
        $this->assertSame(8, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
        $this->assertSame('delivered', $order->fresh()->fulfillment_status);
        $this->assertNotNull($shipment->fresh()->in_transit_at);
        $this->assertNotNull($shipment->fresh()->out_for_delivery_at);
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_multi_item_shortage_rolls_back_every_reservation_and_movement(): void
    {
        $warehouse = Warehouse::factory()->create();
        $first = Product::factory()->create(['id' => '10000000-0000-4000-8000-000000000001']);
        $second = Product::factory()->create(['id' => '20000000-0000-4000-8000-000000000002']);
        $stock = WarehouseStock::factory()->create(['warehouse_id' => $warehouse->id, 'product_id' => $first->id, 'quantity' => 5]);
        WarehouseStock::factory()->create(['warehouse_id' => $warehouse->id, 'product_id' => $second->id, 'quantity' => 0]);
        $address = ['name' => 'Test', 'address' => 'Test'];
        $order = app(CreateOrder::class)->execute(Customer::factory()->create(), 'ROLLBACK', [
            ['product' => $first, 'quantity' => 1, 'unit_price' => '10.00'],
            ['product' => $second, 'quantity' => 1, 'unit_price' => '10.00'],
        ], $address, $address, $warehouse);
        try {
            app(ReserveOrderStock::class)->execute($order);
            $this->fail('Expected insufficient stock.');
        } catch (InvalidArgumentException) {
            $this->assertSame(0, $stock->fresh()->reserved_quantity);
            $this->assertDatabaseCount('stock_reservations', 0);
            $this->assertDatabaseCount('stock_movements', 0);
        }
    }
}
