<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'order_number', 'customer_id', 'warehouse_id', 'status', 'payment_status', 'fulfillment_status',
    'subtotal_amount', 'discount_amount', 'total_amount', 'placed_at',
    'warehouse_allocated_at', 'warehouse_allocated_by',
])]
class Order extends Model
{
    use HasUuids;

    protected function status(): Attribute
    {
        return Attribute::make(get: static fn (string $value): string => $value === 'PENDING_PAYMENT' ? 'pending' : $value);
    }

    protected function paymentStatus(): Attribute
    {
        return Attribute::make(get: static fn (string $value): string => $value === 'PENDING' ? 'pending' : $value);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'subtotal_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'placed_at' => 'datetime',
            'warehouse_allocated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** @return HasMany<OrderAddress, $this> */
    public function addresses(): HasMany
    {
        return $this->hasMany(OrderAddress::class);
    }

    /** @return HasOne<OrderAddress, $this> */
    public function billingAddress(): HasOne
    {
        return $this->hasOne(OrderAddress::class)->where('address_type', OrderAddress::Billing);
    }

    /** @return HasOne<OrderAddress, $this> */
    public function shippingAddress(): HasOne
    {
        return $this->hasOne(OrderAddress::class)->where('address_type', OrderAddress::Shipping);
    }

    /** @return HasMany<OrderStatusHistory, $this> */
    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasMany<Shipment, $this> */
    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    public function stockReservations(): HasMany
    {
        return $this->hasMany(StockReservation::class);
    }
}
