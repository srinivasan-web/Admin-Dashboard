<?php

namespace App\Models;

use Database\Factories\StockMovementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable(['warehouse_stock_id', 'movement_type', 'quantity_delta', 'created_by'])]
class StockMovement extends Model
{
    /** @use HasFactory<StockMovementFactory> */
    use HasFactory;

    use HasUuids;

    /**
     * Stock movement audit records have a database-generated creation timestamp only.
     *
     * @var bool
     */
    public $timestamps = false;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity_delta' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Prevent Eloquent updates and deletes of immutable audit records.
     */
    protected static function booted(): void
    {
        static::creating(static function (StockMovement $stockMovement): void {
            if ($stockMovement->quantity_delta === 0) {
                throw new LogicException('Stock movement quantity deltas cannot be zero.');
            }
        });

        static::updating(static function (): void {
            throw new LogicException('Stock movements are immutable.');
        });

        static::deleting(static function (): void {
            throw new LogicException('Stock movements cannot be deleted.');
        });
    }

    /** @return BelongsTo<WarehouseStock, $this> */
    public function warehouseStock(): BelongsTo
    {
        return $this->belongsTo(WarehouseStock::class);
    }

    /** @return BelongsTo<User, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
