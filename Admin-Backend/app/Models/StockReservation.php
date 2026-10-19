<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable([
    'order_id', 'order_item_id', 'warehouse_id', 'product_id', 'quantity', 'status',
    'reserved_at', 'expires_at', 'released_at', 'committed_at', 'restored_at',
])]
class StockReservation extends Model
{
    use HasUuids;

    public const Active = 'ACTIVE';

    public const Released = 'RELEASED';

    public const Committed = 'COMMITTED';

    public const Expired = 'EXPIRED';

    public const Restored = 'RESTORED';

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'reserved_at' => 'datetime',
            'expires_at' => 'datetime',
            'released_at' => 'datetime',
            'committed_at' => 'datetime',
            'restored_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(static function (StockReservation $reservation): void {
            if ($reservation->quantity < 1) {
                throw new LogicException('Reservation quantity must be positive.');
            }
            if (! in_array($reservation->status, [self::Active, self::Released, self::Committed, self::Expired, self::Restored], true)) {
                throw new LogicException('Unknown stock reservation status.');
            }
            if ($reservation->exists && $reservation->isDirty([
                'order_id', 'order_item_id', 'warehouse_id', 'product_id', 'quantity', 'reserved_at', 'expires_at',
            ])) {
                throw new LogicException('Stock reservation ownership and quantity are immutable.');
            }
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
