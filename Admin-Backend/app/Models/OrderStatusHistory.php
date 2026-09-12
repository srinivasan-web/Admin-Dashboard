<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable(['order_id', 'from_status', 'to_status', 'changed_by'])]
class OrderStatusHistory extends Model
{
    use HasUuids;

    /**
     * Order status history has a database-generated creation timestamp only.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * Order status history is append-only.
     */
    protected static function booted(): void
    {
        static::updating(static function (): void {
            throw new LogicException('Order status history records are immutable.');
        });

        static::deleting(static function (): void {
            throw new LogicException('Order status history records cannot be deleted.');
        });
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<User, $this> */
    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
