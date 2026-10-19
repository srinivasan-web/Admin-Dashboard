<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Actions\ReserveOrderStock;
use App\Actions\SetWarehouseStock;
use App\Actions\TransitionOrderPayment;
use App\Actions\TransitionOrderStatus;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use LogicException;
use Tests\TestCase;

class TransitionOrderStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_enforces_order_payment_and_fulfillment_transitions_atomically(): void
    {
        $order = $this->createOrder(true);
        $action = app(TransitionOrderStatus::class);
        $payment = $order->payments()->create(['provider' => 'test', 'provider_transaction_reference' => fake()->uuid(), 'amount' => '100.00', 'currency' => 'INR', 'status' => 'pending']);
        app(TransitionOrderPayment::class)->execute($order, $payment, 'authorized');
        app(TransitionOrderPayment::class)->execute($order, $payment, 'paid');
        $action->execute($order, 'processing');
        $completed = $action->execute($order, 'completed');

        $this->assertSame('completed', $completed->status);
        $this->assertSame('paid', $completed->payment_status);
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $order->id, 'from_status' => 'processing', 'to_status' => 'completed']);
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $order->id, 'from_status' => 'pending', 'to_status' => 'confirmed']);
    }

    public function test_it_holds_and_resumes_an_order_only_to_its_prior_active_state(): void
    {
        $order = $this->createOrder(true);
        $action = app(TransitionOrderStatus::class);
        $payment = $order->payments()->create(['provider' => 'test', 'provider_transaction_reference' => fake()->uuid(), 'amount' => '100.00', 'currency' => 'INR', 'status' => 'pending']);
        app(TransitionOrderPayment::class)->execute($order, $payment, 'authorized');
        app(TransitionOrderPayment::class)->execute($order, $payment, 'paid');
        $action->execute($order, 'hold');

        try {
            $action->execute($order, 'processing');
            $this->fail('A held order must resume to its prior active state.');
        } catch (InvalidArgumentException) {
        } finally {
            $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'hold']);
        }

        $resumed = $action->execute($order, 'confirmed');

        $this->assertSame('confirmed', $resumed->status);
    }

    public function test_it_prevents_delivery_until_the_order_is_completed_and_paid(): void
    {
        $order = $this->createOrder();
        $action = app(TransitionOrderStatus::class);

        $action->execute($order, fulfillmentStatus: 'processing');
        $action->execute($order, fulfillmentStatus: 'shipped');

        $this->expectException(InvalidArgumentException::class);

        try {
            $action->execute($order, fulfillmentStatus: 'delivered');
        } finally {
            $this->assertDatabaseHas('orders', ['id' => $order->id, 'fulfillment_status' => 'shipped']);
        }
    }

    public function test_order_item_snapshots_cannot_be_updated_or_deleted(): void
    {
        $item = $this->createOrder()->items()->firstOrFail();

        $this->expectException(LogicException::class);
        $item->update(['product_name' => 'Changed']);
    }

    private function createOrder(bool $withInventory = false)
    {
        $product = Product::factory()->create();
        $warehouse = $withInventory ? Warehouse::factory()->create() : null;
        if ($warehouse !== null) {
            app(SetWarehouseStock::class)->execute($warehouse, $product, 10);
        }

        $order = app(CreateOrder::class)->execute(
            Customer::factory()->create(),
            fake()->unique()->bothify('ORD-####'),
            [['product' => $product, 'quantity' => 1, 'unit_price' => '100.00']],
            ['name' => 'Billing', 'address' => 'Billing road'],
            ['name' => 'Shipping', 'address' => 'Shipping road'],
            $warehouse,
        );
        if ($withInventory) {
            app(ReserveOrderStock::class)->execute($order);
        }

        return $order;
    }
}
