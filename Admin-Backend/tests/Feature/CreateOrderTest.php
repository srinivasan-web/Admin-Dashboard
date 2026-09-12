<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Models\Customer;
use App\Models\OrderAddress;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class CreateOrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_snapshots_totals_and_initial_status_history(): void
    {
        $customer = Customer::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $firstProduct = Product::factory()->create(['name' => 'Treadmill Pro', 'sku' => 'TREAD-PRO']);
        $secondProduct = Product::factory()->create(['name' => 'Cycle Max', 'sku' => 'CYCLE-MAX']);

        $order = app(CreateOrder::class)->execute(
            $customer,
            'ORD-1001',
            [
                ['product' => $firstProduct, 'quantity' => 2, 'unit_price' => '12500.25'],
                ['product' => $secondProduct, 'quantity' => 1, 'unit_price' => '999.50'],
            ],
            $this->address('Billing Customer'),
            $this->address('Shipping Customer'),
            $warehouse,
            '100.75',
        );

        $this->assertSame('pending', $order->status);
        $this->assertSame('pending', $order->payment_status);
        $this->assertSame('pending', $order->fulfillment_status);
        $this->assertSame('26000.00', $order->subtotal_amount);
        $this->assertSame('100.75', $order->discount_amount);
        $this->assertSame('25899.25', $order->total_amount);
        $this->assertSame($warehouse->id, $order->warehouse_id);
        $this->assertCount(2, $order->items);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_id' => $firstProduct->id,
            'product_name' => 'Treadmill Pro',
            'product_sku' => 'TREAD-PRO',
            'quantity' => 2,
            'unit_price' => '12500.25',
            'line_total' => '25000.50',
        ]);
        $this->assertDatabaseHas('order_addresses', ['order_id' => $order->id, 'address_type' => OrderAddress::Billing]);
        $this->assertDatabaseHas('order_addresses', ['order_id' => $order->id, 'address_type' => OrderAddress::Shipping]);
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $order->id, 'from_status' => null, 'to_status' => 'pending']);
    }

    public function test_it_rejects_invalid_item_data_without_creating_an_order(): void
    {
        $this->expectException(InvalidArgumentException::class);

        try {
            app(CreateOrder::class)->execute(
                Customer::factory()->create(),
                'ORD-1002',
                [['product' => Product::factory()->create(), 'quantity' => 0, 'unit_price' => '99.99']],
                $this->address('Billing Customer'),
                $this->address('Shipping Customer'),
            );
        } finally {
            $this->assertDatabaseCount('orders', 0);
            $this->assertDatabaseCount('order_items', 0);
        }
    }

    public function test_it_rolls_back_all_writes_when_an_address_snapshot_is_invalid(): void
    {
        $this->expectException(InvalidArgumentException::class);

        try {
            app(CreateOrder::class)->execute(
                Customer::factory()->create(),
                'ORD-1003',
                [['product' => Product::factory()->create(), 'quantity' => 1, 'unit_price' => '99.99']],
                $this->address('Billing Customer'),
                ['name' => '', 'address' => 'Shipping address'],
            );
        } finally {
            $this->assertDatabaseCount('orders', 0);
            $this->assertDatabaseCount('order_items', 0);
            $this->assertDatabaseCount('order_addresses', 0);
            $this->assertDatabaseCount('order_status_histories', 0);
        }
    }

    /** @return array{name: string, phone: string, email: string, address: string, state: string, city: string, postal_code: string} */
    private function address(string $name): array
    {
        return [
            'name' => $name,
            'phone' => '9876543210',
            'email' => 'customer@example.com',
            'address' => '123 Fitness Road',
            'state' => 'Tamil Nadu',
            'city' => 'Chennai',
            'postal_code' => '600001',
        ];
    }
}
