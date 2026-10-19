<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Actions\ReserveOrderStock;
use App\Actions\SetWarehouseStock;
use App\Actions\TransitionOrderPayment;
use App\Actions\TransitionOrderShipment;
use App\Actions\TransitionOrderStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use LogicException;
use RuntimeException;
use Tests\TestCase;

class OrderDomainTest extends TestCase
{
    use RefreshDatabase;

    public function test_retries_use_persisted_state_without_duplicate_history_or_inventory_changes(): void
    {
        $order = $this->order(true);
        $stock = $order->warehouse->stocks()->where('product_id', $order->items->first()->product_id)->firstOrFail();
        $payment = $order->payments()->create($this->paymentData());
        $action = app(TransitionOrderPayment::class);
        $action->execute($order, $payment, 'authorized');
        $action->execute($order, $payment, 'paid');
        $movementsBeforeRetry = $stock->movements()->count();
        $action->execute($order, $payment, 'paid');
        $this->assertSame(2, $order->statusHistories()->count());
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $order->id, 'from_status' => 'pending', 'to_status' => 'confirmed']);
        $this->assertSame(9, $stock->fresh()->quantity);
        $this->assertSame(3, $movementsBeforeRetry); // Opening stock + reservation + commit.
        $this->assertSame($movementsBeforeRetry, $stock->movements()->count());
    }

    public function test_invalid_combined_transition_leaves_all_state_unchanged(): void
    {
        $order = $this->order(true);
        try {
            app(TransitionOrderStatus::class)->execute($order, 'confirmed', 'paid');
            $this->fail('Pending payment cannot jump directly to paid.');
        } catch (InvalidArgumentException) {
            $this->assertSame('pending', $order->fresh()->status);
            $this->assertSame('pending', $order->fresh()->payment_status);
            $this->assertSame(1, $order->statusHistories()->count());
        }
    }

    public function test_history_failure_rolls_back_the_order_update(): void
    {
        $order = $this->order();
        $dispatcher = OrderStatusHistory::getEventDispatcher();
        OrderStatusHistory::setEventDispatcher(clone $dispatcher);
        OrderStatusHistory::creating(static function (): void {
            throw new RuntimeException('Simulated history write failure');
        });
        try {
            app(TransitionOrderStatus::class)->execute($order, 'cancelled');
            $this->fail('Expected history write failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated history write failure', $exception->getMessage());
            $this->assertSame('pending', $order->fresh()->status);
            $this->assertSame(1, $order->statusHistories()->count());
        } finally {
            OrderStatusHistory::setEventDispatcher($dispatcher);
        }
    }

    public function test_payment_transitions_are_owned_idempotent_and_reconcile_paid_order_inventory(): void
    {
        $order = $this->order(true);
        $payment = $order->payments()->create($this->paymentData());
        $action = app(TransitionOrderPayment::class);
        $action->execute($order, $payment, 'authorized');
        $action->execute($order, $payment, 'authorized');
        $paid = $action->execute($order, $payment, 'paid');
        $this->assertTrue($paid->order->is($order));
        $this->assertSame('paid', $paid->status);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame('confirmed', $order->fresh()->status);
        $this->assertSame(1, $order->payments()->count());

        $this->expectException(InvalidArgumentException::class);
        $action->execute($this->order(), $payment, 'refunded');
    }

    public function test_invalid_payment_data_is_rejected_without_state_changes(): void
    {
        foreach ([['amount' => '-1.00'], ['currency' => 'bad'], ['provider' => ''], ['provider_transaction_reference' => '']] as $invalid) {
            $order = $this->order();
            $payment = $order->payments()->create(array_replace($this->paymentData(), $invalid));
            try {
                app(TransitionOrderPayment::class)->execute($order, $payment, 'authorized');
                $this->fail('Invalid payment data must be rejected.');
            } catch (InvalidArgumentException) {
                $this->assertSame('pending', $payment->fresh()->status);
            }
        }
    }

    public function test_shipment_delivery_requires_paid_completed_order_and_preserves_metadata_on_retry(): void
    {
        $order = $this->order(true);
        $payment = $order->payments()->create($this->paymentData());
        $payments = app(TransitionOrderPayment::class);
        $payments->execute($order, $payment, 'authorized');
        $payments->execute($order, $payment, 'paid');
        $shipment = $order->shipments()->create(['warehouse_id' => $order->warehouse_id, 'carrier' => 'Test carrier', 'status' => 'pending', 'tracking_reference' => 'TRACK-1']);
        $action = app(TransitionOrderShipment::class);
        $action->execute($order, $shipment, 'processing');
        $shipped = $action->execute($order, $shipment, 'shipped');
        $this->assertNotNull($shipped->shipped_at);
        try {
            $action->execute($order, $shipment, 'delivered');
            $this->fail('An incomplete order cannot be delivered.');
        } catch (InvalidArgumentException) {
            $this->assertSame('shipped', $shipment->fresh()->status);
            $this->assertNull($shipment->fresh()->delivered_at);
        }
        $transition = app(TransitionOrderStatus::class);
        $transition->execute($order, 'processing');
        $transition->execute($order, 'completed');
        $delivered = $action->execute($order, $shipment, 'delivered');
        $retry = $action->execute($order, $shipment, 'delivered');
        $this->assertSame($delivered->delivered_at->toISOString(), $retry->delivered_at->toISOString());
        $this->assertSame($shipped->shipped_at->toISOString(), $retry->shipped_at->toISOString());
        $this->assertSame($order->warehouse_id, $retry->warehouse_id);
        $this->assertSame('TRACK-1', $retry->tracking_reference);
        $this->assertSame(1, $order->shipments()->count());
        $this->assertSame('delivered', $order->fresh()->fulfillment_status);
        $this->assertDatabaseCount('stock_movements', 3); // Includes opening stock.
    }

    public function test_shipment_cannot_be_transitioned_through_another_order(): void
    {
        $shipment = $this->order()->shipments()->create(['carrier' => 'Test carrier', 'status' => 'pending']);
        $this->expectException(InvalidArgumentException::class);
        app(TransitionOrderShipment::class)->execute($this->order(), $shipment, 'processing');
    }

    public function test_order_total_overflow_rolls_back_all_snapshots(): void
    {
        $this->expectException(InvalidArgumentException::class);
        try {
            $product = Product::factory()->create();
            $address = ['name' => 'Customer', 'address' => 'Address'];
            app(CreateOrder::class)->execute(Customer::factory()->create(), 'OVERFLOW', [
                ['product' => $product, 'quantity' => 1, 'unit_price' => '9999999999.99'],
                ['product' => $product, 'quantity' => 1, 'unit_price' => '0.01'],
            ], $address, $address);
        } finally {
            $this->assertDatabaseCount('orders', 0);
            $this->assertDatabaseCount('order_items', 0);
            $this->assertDatabaseCount('order_status_histories', 0);
        }
    }

    public function test_live_product_changes_do_not_modify_order_snapshots(): void
    {
        $item = $this->order()->items->first();
        $originalName = $item->product_name;
        $originalSku = $item->product_sku;
        $item->product->update(['name' => 'Changed name', 'sku' => 'CHANGED-SKU']);
        $this->assertSame($originalName, $item->fresh()->product_name);
        $this->assertSame($originalSku, $item->fresh()->product_sku);
        $this->assertSame('100.00', $item->fresh()->line_total);
        $this->assertNull($item->fresh()->tax_amount);
        $this->expectException(LogicException::class);
        $item->delete();
    }

    private function order(bool $withInventory = false): Order
    {
        $address = ['name' => 'Customer', 'address' => 'Address'];
        $product = Product::factory()->create();
        $warehouse = $withInventory ? Warehouse::factory()->create() : null;
        if ($warehouse !== null) {
            app(SetWarehouseStock::class)->execute($warehouse, $product, 10);
        }

        $order = app(CreateOrder::class)->execute(Customer::factory()->create(), fake()->unique()->uuid(), [
            ['product' => $product, 'quantity' => 1, 'unit_price' => '100.00'],
        ], $address, $address, $warehouse);
        if ($withInventory) {
            app(ReserveOrderStock::class)->execute($order);
        }

        return $order;
    }

    private function paymentData(): array
    {
        return ['provider' => 'test', 'provider_transaction_reference' => fake()->unique()->uuid(), 'amount' => '100.00', 'currency' => 'INR', 'status' => 'pending'];
    }
}
