<?php

namespace App\Services;

use App\Models\Order;
use App\Models\StockMovement;
use App\Models\StockReservation;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class OrderInventoryService
{
    public function reserve(Order $order, ?User $actor = null): Order
    {
        return DB::transaction(function () use ($order, $actor): Order {
            $order = $this->lockedOrder($order);
            if (! in_array($order->status, ['pending', 'confirmed'], true)) {
                throw new InvalidArgumentException('This order cannot reserve stock in its current state.');
            }
            if ($order->warehouse_id === null) {
                throw new InvalidArgumentException('A warehouse must be assigned before stock can be reserved.');
            }

            if (! $order->items()->exists()) {
                throw new InvalidArgumentException('An order requires items before reservation.');
            }
            $ttl = (int) config('inventory.reservation_ttl_minutes');
            if ($ttl < 1) {
                throw new InvalidArgumentException('Inventory reservation TTL must be a positive number of minutes.');
            }
            $reservedAt = now();
            foreach ($order->items()->orderBy('product_id')->orderBy('id')->get() as $item) {
                if ($item->product_id === null) {
                    throw new InvalidArgumentException("Order item {$item->id} no longer references a product.");
                }

                $existing = StockReservation::query()->where('order_item_id', $item->id)->lockForUpdate()->first();
                if ($existing !== null) {
                    if ($existing->warehouse_id !== $order->warehouse_id || $existing->product_id !== $item->product_id || $existing->quantity !== $item->quantity) {
                        throw new InvalidArgumentException('Reservation allocation does not match the order item.');
                    }
                    if (in_array($existing->status, [StockReservation::Active, StockReservation::Committed], true)) {
                        if ($existing->status === StockReservation::Active && ($existing->expires_at === null || $existing->expires_at->lte(now()))) {
                            throw new InvalidArgumentException('The stock reservation deadline has passed. Refresh the order.');
                        }
                        continue;
                    }
                    throw new InvalidArgumentException('Released or expired reservations cannot be reused.');
                }

                $stock = $this->lockedStock($order->warehouse_id, $item->product_id);
                if ($stock->available_quantity < $item->quantity) {
                    throw new InvalidArgumentException("Insufficient available stock for {$item->product_sku}.");
                }

                $stock->increment('reserved_quantity', $item->quantity);
                $reservation = StockReservation::query()->create([
                    'order_id' => $order->id,
                    'order_item_id' => $item->id,
                    'warehouse_id' => $order->warehouse_id,
                    'product_id' => $item->product_id,
                    'quantity' => $item->quantity,
                    'status' => StockReservation::Active,
                    'reserved_at' => $reservedAt,
                    'expires_at' => $reservedAt->copy()->addMinutes($ttl),
                ]);
                $this->movement($order, $stock, $reservation, 'RESERVE', 0, 'RESERVE', $actor);
            }

            return $order->load('stockReservations');
        });
    }

    public function release(Order $order, ?User $actor = null): Order
    {
        return DB::transaction(function () use ($order, $actor): Order {
            $order = $this->lockedOrder($order);
            foreach ($this->lockedReservations($order, StockReservation::Active) as $reservation) {
                $this->releaseReservation($order, $reservation, StockReservation::Released, $actor);
            }

            return $order->load('stockReservations');
        });
    }

    public function expire(Order $order): int
    {
        return DB::transaction(function () use ($order): int {
            // Same lock order as payment/cancellation: order -> reservations -> stock.
            $order = $this->lockedOrder($order);
            $expired = 0;
            foreach ($this->lockedReservations($order, StockReservation::Active) as $reservation) {
                if ($reservation->expires_at === null || $reservation->expires_at->isFuture()) {
                    continue;
                }
                $this->releaseReservation($order, $reservation, StockReservation::Expired);
                $expired++;
            }

            return $expired;
        });
    }

    private function releaseReservation(Order $order, StockReservation $reservation, string $status, ?User $actor = null): void
    {
        $stock = $this->lockedStock($reservation->warehouse_id, $reservation->product_id);
        if ($stock->reserved_quantity < $reservation->quantity) {
            throw new InvalidArgumentException('Reserved stock is inconsistent with the active reservation.');
        }
        $stock->decrement('reserved_quantity', $reservation->quantity);
        $reservation->update(['status' => $status, 'released_at' => now()]);
        // RELEASE also represents expiry, preserving existing movement API/filter semantics.
        $this->movement($order, $stock, $reservation, 'RELEASE', 0, 'RELEASE', $actor);
    }

    public function commit(Order $order, ?User $actor = null): Order
    {
        return DB::transaction(function () use ($order, $actor): Order {
            $order = $this->lockedOrder($order);
            if (! in_array($order->status, ['pending', 'confirmed'], true) || ! $order->payments()->where('status', 'paid')->exists()) {
                throw new InvalidArgumentException('Successful payment is required before inventory commitment.');
            }
            $items = $order->items()->get();
            $reservations = $order->stockReservations()->get()->keyBy('order_item_id');
            if ($items->isEmpty()) {
                throw new InvalidArgumentException('There are no items to commit.');
            }
            foreach ($items as $item) {
                $reservation = $reservations->get($item->id);
                if (! $reservation || ! in_array($reservation->status, [StockReservation::Active, StockReservation::Committed], true)
                    || $reservation->warehouse_id !== $order->warehouse_id || $reservation->product_id !== $item->product_id || $reservation->quantity !== $item->quantity) {
                    throw new InvalidArgumentException('Every item requires a matching active reservation before payment can commit stock.');
                }
                if ($reservation->status === StockReservation::Active && ($reservation->expires_at === null || $reservation->expires_at->lte(now()))) {
                    throw new InvalidArgumentException('The stock reservation deadline has passed. Payment cannot commit expired stock.');
                }
            }
            foreach ($this->lockedReservations($order, StockReservation::Active) as $reservation) {
                $stock = $this->lockedStock($reservation->warehouse_id, $reservation->product_id);
                if ($stock->reserved_quantity < $reservation->quantity || $stock->quantity < $reservation->quantity) {
                    throw new InvalidArgumentException('Reserved stock cannot be committed because inventory is inconsistent.');
                }
                $stock->decrement('reserved_quantity', $reservation->quantity);
                $stock->decrement('quantity', $reservation->quantity);
                $reservation->update(['status' => StockReservation::Committed, 'committed_at' => now()]);
                $this->movement($order, $stock, $reservation, 'COMMIT', -$reservation->quantity, 'COMMIT', $actor);
            }

            return $order->load('stockReservations');
        });
    }

    public function restoreCancellation(Order $order, ?User $actor = null): Order
    {
        return DB::transaction(function () use ($order, $actor): Order {
            $order = $this->lockedOrder($order);
            if ($order->shipments()->whereNotNull('shipped_at')->exists()) {
                throw new InvalidArgumentException('Shipped stock requires inspected return or RTO handling.');
            }
            foreach ($this->lockedReservations($order, StockReservation::Committed) as $reservation) {
                $key = $this->key($order, $reservation, 'CANCEL_RESTORE');
                if (StockMovement::query()->where('idempotency_key', $key)->exists()) {
                    continue;
                }
                $stock = $this->lockedStock($reservation->warehouse_id, $reservation->product_id);
                if ($stock->quantity > 2147483647 - $reservation->quantity) {
                    throw new InvalidArgumentException('Restored stock exceeds the supported quantity.');
                }
                $stock->increment('quantity', $reservation->quantity);
                $reservation->update(['status' => StockReservation::Restored, 'restored_at' => now()]);
                $this->movement($order, $stock, $reservation, 'RESTORE', $reservation->quantity, 'CANCEL_RESTORE', $actor);
            }

            return $order->load('stockReservations');
        });
    }

    private function lockedOrder(Order $order): Order
    {
        return Order::query()->lockForUpdate()->findOrFail($order->getKey());
    }

    /** @return Collection<int, StockReservation> */
    private function lockedReservations(Order $order, string $status)
    {
        return StockReservation::query()
            ->where('order_id', $order->id)
            ->where('status', $status)
            ->orderBy('product_id')->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    private function lockedStock(string $warehouseId, string $productId): WarehouseStock
    {
        $stock = WarehouseStock::query()
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $productId)
            ->lockForUpdate()
            ->first();
        if ($stock === null) {
            throw new InvalidArgumentException('Warehouse stock does not exist for an ordered product.');
        }

        return $stock;
    }

    private function movement(Order $order, WarehouseStock $stock, StockReservation $reservation, string $type, int $delta, string $operation, ?User $actor = null): void
    {
        $key = $this->key($order, $reservation, $operation);
        if (StockMovement::query()->where('idempotency_key', $key)->exists()) {
            return;
        }
        $stock->movements()->create([
            'warehouse_id' => $reservation->warehouse_id,
            'product_id' => $reservation->product_id,
            'order_id' => $reservation->order_id,
            'order_item_id' => $reservation->order_item_id,
            'movement_type' => $type,
            'quantity_delta' => $delta,
            'quantity' => $reservation->quantity,
            'reference_type' => 'stock_reservation',
            'reference_id' => $reservation->id,
            'idempotency_key' => $key,
            'created_by' => $actor?->id,
        ]);
    }

    private function key(Order $order, StockReservation $reservation, string $operation): string
    {
        return "ORDER:{$order->order_number}:ITEM:{$reservation->order_item_id}:{$operation}";
    }
}
