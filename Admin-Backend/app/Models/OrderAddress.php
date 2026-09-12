<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable(['order_id', 'address_type', 'name', 'phone', 'email', 'address', 'state', 'city', 'postal_code'])]
class OrderAddress extends Model
{
    use HasUuids;

    public const string Billing = 'billing';

    public const string Shipping = 'shipping';

    /**
     * Order addresses are immutable transaction snapshots.
     *
     * @var bool
     */
    public $timestamps = false;

    protected static function booted(): void
    {
        static::creating(static function (OrderAddress $orderAddress): void {
            if (! in_array($orderAddress->address_type, [self::Billing, self::Shipping], true)) {
                throw new LogicException('Order address types must be billing or shipping.');
            }
        });

        static::updating(static function (): void {
            throw new LogicException('Order address snapshots are immutable.');
        });

        static::deleting(static function (): void {
            throw new LogicException('Order address snapshots cannot be deleted.');
        });
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
