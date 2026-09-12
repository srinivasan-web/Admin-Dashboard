<?php

namespace App\Actions;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderAddress;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class CreateOrder
{
    private const string InitialOrderStatus = 'pending';

    private const string InitialPaymentStatus = 'pending';

    private const string InitialFulfillmentStatus = 'pending';

    /**
     * @param  array<int, array{product: Product, quantity: int, unit_price: string}>  $items
     * @param  array<string, string|null>  $billingAddress
     * @param  array<string, string|null>  $shippingAddress
     */
    public function execute(Customer $customer, string $orderNumber, array $items, array $billingAddress, array $shippingAddress, ?Warehouse $warehouse = null, string $discountAmount = '0.00'): Order
    {
        $orderNumber = $this->requiredString($orderNumber, 'Order number');

        if ($items === []) {
            throw new InvalidArgumentException('An order requires at least one item.');
        }

        $discount = $this->toMinorUnits($discountAmount, 'Discount amount');

        if ($discount < 0) {
            throw new InvalidArgumentException('Discount amount cannot be negative.');
        }

        return DB::transaction(function () use ($customer, $orderNumber, $items, $billingAddress, $shippingAddress, $warehouse, $discount): Order {
            if (! $customer->exists || ($warehouse !== null && ! $warehouse->exists)) {
                throw new InvalidArgumentException('Customer and warehouse must be persisted.');
            }

            if (Order::query()->where('order_number', $orderNumber)->exists()) {
                throw new InvalidArgumentException('Order number already exists.');
            }

            $preparedItems = $this->prepareItems($items);
            $subtotal = array_sum(array_column($preparedItems, 'line_total'));

            if ($discount > $subtotal) {
                throw new InvalidArgumentException('Discount amount cannot exceed the order subtotal.');
            }

            $order = Order::query()->create([
                'order_number' => $orderNumber,
                'customer_id' => $customer->getKey(),
                'warehouse_id' => $warehouse?->getKey(),
                'status' => self::InitialOrderStatus,
                'payment_status' => self::InitialPaymentStatus,
                'fulfillment_status' => self::InitialFulfillmentStatus,
                'subtotal_amount' => $this->fromMinorUnits($subtotal),
                'discount_amount' => $this->fromMinorUnits($discount),
                'total_amount' => $this->fromMinorUnits($subtotal - $discount),
            ]);

            foreach ($preparedItems as $item) {
                $order->items()->create([
                    'product_id' => $item['product']->getKey(),
                    'product_name' => $item['product']->name,
                    'product_sku' => $item['product']->sku,
                    'quantity' => $item['quantity'],
                    'unit_price' => $this->fromMinorUnits($item['unit_price']),
                    'line_total' => $this->fromMinorUnits($item['line_total']),
                ]);
            }

            $order->addresses()->create($this->addressAttributes($billingAddress, OrderAddress::Billing));
            $order->addresses()->create($this->addressAttributes($shippingAddress, OrderAddress::Shipping));
            $order->statusHistories()->create(['from_status' => null, 'to_status' => self::InitialOrderStatus]);

            return $order->load(['items', 'billingAddress', 'shippingAddress', 'statusHistories']);
        });
    }

    /**
     * @param  array<int, array{product: Product, quantity: int, unit_price: string}>  $items
     * @return array<int, array{product: Product, quantity: int, unit_price: int, line_total: int}>
     */
    private function prepareItems(array $items): array
    {
        $preparedItems = [];

        foreach ($items as $item) {
            $product = $item['product'] ?? null;
            $quantity = $item['quantity'] ?? null;
            $unitPrice = $item['unit_price'] ?? null;

            if (! $product instanceof Product || ! $product->exists) {
                throw new InvalidArgumentException('Order items must reference persisted products.');
            }

            if (! is_int($quantity) || $quantity < 1) {
                throw new InvalidArgumentException('Order item quantities must be positive integers.');
            }

            if (! is_string($unitPrice)) {
                throw new InvalidArgumentException('Order item prices must be decimal strings.');
            }

            $minorUnits = $this->toMinorUnits($unitPrice, 'Order item price');

            if ($minorUnits < 0) {
                throw new InvalidArgumentException('Order item prices cannot be negative.');
            }

            $lineTotal = $minorUnits * $quantity;

            if ($lineTotal > 999999999999) {
                throw new InvalidArgumentException('Order item total exceeds the supported money range.');
            }

            $preparedItems[] = compact('product', 'quantity', 'lineTotal') + ['unit_price' => $minorUnits, 'line_total' => $lineTotal];
        }

        return $preparedItems;
    }

    /** @param array<string, string|null> $address */
    private function addressAttributes(array $address, string $addressType): array
    {
        return [
            'address_type' => $addressType,
            'name' => $this->requiredString($address['name'] ?? null, 'Address name'),
            'phone' => $this->nullableString($address['phone'] ?? null),
            'email' => $this->nullableString($address['email'] ?? null),
            'address' => $this->requiredString($address['address'] ?? null, 'Address'),
            'state' => $this->nullableString($address['state'] ?? null),
            'city' => $this->nullableString($address['city'] ?? null),
            'postal_code' => $this->nullableString($address['postal_code'] ?? null),
        ];
    }

    private function requiredString(mixed $value, string $field): string
    {
        if (! is_string($value) || trim($value) === '') {
            throw new InvalidArgumentException($field.' is required.');
        }

        return trim($value);
    }

    private function nullableString(mixed $value): ?string
    {
        return $value === null ? null : $this->requiredString($value, 'Address field');
    }

    private function toMinorUnits(string $amount, string $field): int
    {
        if (! preg_match('/^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]{1,2})?$/', $amount)) {
            throw new InvalidArgumentException($field.' must have at most two decimal places.');
        }

        $negative = str_starts_with($amount, '-');
        [$whole, $fraction] = array_pad(explode('.', ltrim($amount, '-'), 2), 2, '0');
        $minorUnits = ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');

        if ($minorUnits > 999999999999) {
            throw new InvalidArgumentException($field.' exceeds the supported money range.');
        }

        return $negative ? -$minorUnits : $minorUnits;
    }

    private function fromMinorUnits(int $minorUnits): string
    {
        return intdiv($minorUnits, 100).'.'.str_pad((string) ($minorUnits % 100), 2, '0', STR_PAD_LEFT);
    }
}
