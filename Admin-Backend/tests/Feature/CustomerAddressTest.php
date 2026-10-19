<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Actions\SaveCustomerAddress;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\OrderAddress;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CustomerAddressTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_create_update_and_select_a_saved_address(): void
    {
        $customer = Customer::factory()->create();
        $otherCustomer = Customer::factory()->create();
        $saveAddress = app(SaveCustomerAddress::class);

        $address = $saveAddress->execute($customer, $this->validAddress());
        $updated = $saveAddress->execute($customer, $this->validAddress(['city' => 'Coimbatore']), $address->id);

        $this->assertSame('Coimbatore', $updated->city);
        $this->assertTrue($customer->addresses()->whereKey($updated->id)->exists());
        $this->assertFalse($otherCustomer->addresses()->whereKey($updated->id)->exists());
        $this->assertDatabaseHas('customer_addresses', ['id' => $updated->id, 'customer_id' => $customer->id]);
    }

    public function test_invalid_pincode_and_missing_required_location_fields_are_rejected(): void
    {
        $customer = Customer::factory()->create();

        foreach ([
            $this->validAddress(['postal_code' => '12A']),
            $this->validAddress(['city' => '']),
            $this->validAddress(['state' => '']),
            $this->validAddress(['address' => '']),
        ] as $input) {
            try {
                app(SaveCustomerAddress::class)->execute($customer, $input);
                $this->fail('Invalid address data should not be accepted.');
            } catch (ValidationException) {
                $this->assertDatabaseCount('customer_addresses', 0);
            }
        }
    }

    public function test_saved_customer_address_does_not_change_order_address_snapshot(): void
    {
        $customer = Customer::factory()->create();
        $saved = app(SaveCustomerAddress::class)->execute($customer, $this->validAddress());
        $product = Product::factory()->create();
        $snapshot = $this->validAddress(['city' => 'Chennai']);

        $order = app(CreateOrder::class)->execute(
            $customer,
            'ORD-ADDRESS-SNAPSHOT',
            [['product' => $product, 'quantity' => 1, 'unit_price' => '100.00']],
            $snapshot,
            $snapshot,
        );

        $saved->update(['city' => 'Madurai']);

        $this->assertSame('Chennai', $order->shippingAddress->city);
        $this->assertDatabaseHas('order_addresses', [
            'order_id' => $order->id,
            'address_type' => OrderAddress::Shipping,
            'city' => 'Chennai',
        ]);
        $this->assertInstanceOf(CustomerAddress::class, $customer->addresses()->first());
    }

    /** @return array{name: string, phone: string, email: string, address: string, state: string, city: string, postal_code: string} */
    private function validAddress(array $overrides = []): array
    {
        return array_replace([
            'name' => 'Durafit Customer',
            'phone' => '9876543210',
            'email' => 'customer@example.com',
            'address' => '12 Fitness Road',
            'state' => 'Tamil Nadu',
            'city' => 'Chennai',
            'postal_code' => '600001',
        ], $overrides);
    }
}
