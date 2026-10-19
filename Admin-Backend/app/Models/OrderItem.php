<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use LogicException;

#[Fillable(['order_id', 'product_id', 'product_name', 'product_sku', 'quantity', 'unit_price', 'discount_amount', 'tax_amount', 'line_total'])]
class OrderItem extends Model
{
    use HasUuids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(static function (OrderItem $orderItem): void {
            if ($orderItem->quantity < 1) {
                throw new LogicException('Order item quantities must be positive.');
            }
        });

        static::updating(static function (): void {
            throw new LogicException('Order item snapshots are immutable.');
        });

        static::deleting(static function (): void {
            throw new LogicException('Order item snapshots cannot be deleted.');
        });
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function stockReservation(): HasOne
    {
        return $this->hasOne(StockReservation::class);
    }
}
