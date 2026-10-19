<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shipment;
use App\Models\Warehouse;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OrderDatabaseContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_order_creation_preserves_unknown_item_amounts(): void
    {
        $item = $this->order()->items()->firstOrFail();

        $this->assertNull($item->discount_amount);
        $this->assertNull($item->tax_amount);
        $this->assertSame('100.00', $item->unit_price);
        $this->assertSame('100.00', $item->line_total);
        $this->assertNotEmpty($item->product_sku);
    }

    public function test_payments_and_shipments_load_through_real_relationships(): void
    {
        $order = $this->order();
        $payment = $order->payments()->create($this->paymentData());
        $warehouse = Warehouse::factory()->create();
        $shipment = $order->shipments()->create([
            'warehouse_id' => $warehouse->id,
            'carrier' => 'Test carrier',
            'status' => 'pending',
        ]);

        $this->assertTrue($payment->order->is($order));
        $this->assertTrue($shipment->order->is($order));
        $this->assertTrue($shipment->warehouse->is($warehouse));
        $this->assertSame('100.00', $payment->fresh()->amount);
        $this->assertNull($shipment->fresh()->tracking_reference);
        $this->assertNull($shipment->fresh()->shipped_at);
        $this->assertNull($shipment->fresh()->delivered_at);
        $this->assertCount(1, $order->fresh()->payments);
        $this->assertCount(1, $order->fresh()->shipments);
        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_provider_transaction_reference_is_unique_per_provider(): void
    {
        $order = $this->order();
        $order->payments()->create($this->paymentData());
        $order->payments()->create(array_replace($this->paymentData(), ['provider' => 'another-provider']));

        $this->expectException(QueryException::class);
        $order->payments()->create($this->paymentData());
    }

    public function test_payment_requires_an_existing_order(): void
    {
        $this->expectException(QueryException::class);
        Payment::query()->create($this->paymentData() + ['order_id' => '00000000-0000-4000-8000-000000000001']);
    }

    public function test_shipment_requires_an_existing_order(): void
    {
        $this->expectException(QueryException::class);
        Shipment::query()->create([
            'order_id' => '00000000-0000-4000-8000-000000000001',
            'carrier' => 'Test carrier',
            'status' => 'pending',
        ]);
    }

    public function test_shipment_warehouse_is_optional_but_cannot_be_deleted_when_referenced(): void
    {
        $shipment = $this->order()->shipments()->create(['carrier' => 'Test carrier', 'status' => 'pending']);
        $this->assertNull($shipment->fresh()->warehouse_id);
        $warehouse = Warehouse::factory()->create();
        $shipment->update(['warehouse_id' => $warehouse->id]);

        $this->expectException(QueryException::class);
        DB::table('warehouses')->where('id', $warehouse->id)->delete();
    }

    private function order(): Order
    {
        $address = ['name' => 'Test customer', 'address' => 'Test address'];

        return app(CreateOrder::class)->execute(
            Customer::factory()->create(),
            'ORD-SCHEMA-TEST',
            [['product' => Product::factory()->create(), 'quantity' => 1, 'unit_price' => '100.00']],
            $address,
            $address,
        );
    }

    /** @return array<string, string> */
    private function paymentData(): array
    {
        return [
            'provider' => 'test-provider',
            'provider_transaction_reference' => 'test-transaction',
            'amount' => '100.00',
            'currency' => 'INR',
            'status' => 'pending',
        ];
    }
}
