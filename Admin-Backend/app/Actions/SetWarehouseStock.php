<?php

namespace App\Actions;

use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class SetWarehouseStock
{
    public function execute(Warehouse $warehouse, Product $product, int $quantity, string $operation = 'adjustment', ?User $actor = null, ?string $idempotencyKey = null): WarehouseStock
    {
        if ($quantity < 0) {
            throw new InvalidArgumentException('Stock quantity cannot be negative.');
        }

        if (! in_array($operation, ['adjustment', 'stock_in', 'stock_out'], true)) {
            throw new InvalidArgumentException('Unsupported stock operation.');
        }

        if ($operation !== 'adjustment' && $quantity === 0) {
            throw new InvalidArgumentException('Stock in and stock out quantities must be positive.');
        }

        try {
            return DB::transaction(function () use ($warehouse, $product, $quantity, $operation, $actor, $idempotencyKey): WarehouseStock {
                Warehouse::query()->lockForUpdate()->findOrFail($warehouse->getKey());

                if ($idempotencyKey !== null) {
                    $receipt = DB::table('inventory_operation_receipts')->where('idempotency_key', $idempotencyKey)->first();
                    if ($receipt) {
                        abort_unless($receipt->warehouse_id === $warehouse->id && $receipt->product_id === $product->id && $receipt->actor_id === $actor?->id && $receipt->operation === $operation && (int) $receipt->quantity === $quantity, 409, 'This stock request key has already been used with different details.');

                        return WarehouseStock::query()->whereBelongsTo($warehouse)->whereBelongsTo($product)->firstOrFail()->load(['warehouse', 'product']);
                    }
                }

                $stock = WarehouseStock::query()
                    ->whereBelongsTo($warehouse)
                    ->whereBelongsTo($product)
                    ->lockForUpdate()
                    ->first();

                if ($stock === null) {
                    $stock = WarehouseStock::query()->create([
                        'warehouse_id' => $warehouse->getKey(),
                        'product_id' => $product->getKey(),
                        'quantity' => 0,
                    ]);
                }

                [$nextQuantity, $movementType] = match ($operation) {
                    'stock_in' => [$stock->quantity + $quantity, 'stock_in'],
                    'stock_out' => [$stock->quantity - $quantity, 'stock_out'],
                    default => [$quantity, 'manual_set'],
                };

                if ($nextQuantity < 0) {
                    throw new InvalidArgumentException('Stock out quantity exceeds the available warehouse stock.');
                }

                if ($nextQuantity < $stock->reserved_quantity) {
                    throw new InvalidArgumentException('Stock quantity cannot be reduced below the reserved quantity.');
                }

                if ($nextQuantity > 2147483647) {
                    throw new InvalidArgumentException('Stock quantity exceeds the supported movement range.');
                }

                $delta = $nextQuantity - $stock->quantity;

                if ($delta !== 0) {
                    $stock->update(['quantity' => $nextQuantity]);
                    $stock->movements()->create([
                        'warehouse_id' => $warehouse->getKey(),
                        'product_id' => $product->getKey(),
                        'movement_type' => $movementType,
                        'quantity_delta' => $delta,
                        'quantity' => abs($delta),
                        'created_by' => $actor?->getKey(),
                        'idempotency_key' => $idempotencyKey !== null ? 'manual:'.$idempotencyKey : null,
                    ]);
                }

                if ($idempotencyKey !== null) {
                    DB::table('inventory_operation_receipts')->insert([
                        'idempotency_key' => $idempotencyKey,
                        'warehouse_id' => $warehouse->id,
                        'product_id' => $product->id,
                        'actor_id' => $actor?->id,
                        'operation' => $operation,
                        'quantity' => $quantity,
                        'created_at' => now(),
                    ]);
                }

                return $stock->fresh(['warehouse', 'product']);
            });
        } catch (UniqueConstraintViolationException $exception) {
            // A colliding key on a different warehouse cannot bypass its own
            // lock; rollback the entire stock write and expose a conflict.
            if ($idempotencyKey !== null) {
                abort(409, 'This stock request key was already used. Review the saved operation.');
            }
            throw $exception;
        }
    }
}
