<?php

namespace App\Actions;

use App\Models\Order;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AllocateOrderWarehouse
{
    public function execute(Order $order, ?Warehouse $warehouse = null, ?User $actor = null): Order
    {
        return DB::transaction(function () use ($order, $warehouse, $actor): Order {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            if ($order->warehouse_id !== null && ($warehouse === null || $order->warehouse_id === $warehouse->id)) {
                return $order;
            }
            if ($order->status !== 'pending' || $order->stockReservations()->exists() || $order->shipments()->exists()) {
                throw new InvalidArgumentException('Warehouse allocation cannot change after reservation or fulfillment begins.');
            }
            $items = $order->items()->get();
            if ($items->isEmpty()) {
                throw new InvalidArgumentException('An order requires items before warehouse allocation.');
            }
            $requiredByProduct = $items->groupBy('product_id');
            foreach ($requiredByProduct as $productId => $lines) {
                if (! $productId) {
                    throw new InvalidArgumentException('An order item no longer references a product.');
                }
            }
            $warehouse ??= $this->nearestEligible($order, $requiredByProduct);
            $this->assertStockAvailable($warehouse, $requiredByProduct);
            $order->update(['warehouse_id' => $warehouse->id, 'warehouse_allocated_at' => now(), 'warehouse_allocated_by' => $actor?->id]);

            return $order;
        });
    }

    private function nearestEligible(Order $order, mixed $requiredByProduct): Warehouse
    {
        $address = $order->shippingAddress()->first();
        if ($address === null || ! $address->state || ! $address->city || ! $address->postal_code
            || $address->latitude === null || $address->longitude === null) {
            throw new InvalidArgumentException('A shipping address with state, city, postal code and coordinates is required for automatic allocation.');
        }

        $warehouses = Warehouse::query()
            ->whereNotNull('address')->whereNotNull('city')->whereNotNull('state')
            ->whereNotNull('postal_code')->whereNotNull('latitude')->whereNotNull('longitude')
            ->orderBy('id')->get();
        if ($warehouses->isEmpty()) {
            throw new InvalidArgumentException('No warehouse has complete location data for automatic allocation.');
        }

        $productIds = $requiredByProduct->keys()->all();
        $stocks = WarehouseStock::query()->whereIn('warehouse_id', $warehouses->pluck('id'))
            ->whereIn('product_id', $productIds)->orderBy('warehouse_id')->orderBy('product_id')
            ->lockForUpdate()->get()->groupBy('warehouse_id');

        $eligible = $warehouses->filter(function (Warehouse $candidate) use ($stocks, $requiredByProduct): bool {
            $byProduct = $stocks->get($candidate->id)?->keyBy('product_id');
            foreach ($requiredByProduct as $productId => $lines) {
                if (($byProduct?->get($productId)?->available_quantity ?? 0) < $lines->sum('quantity')) {
                    return false;
                }
            }

            return true;
        });
        if ($eligible->isEmpty()) {
            throw new InvalidArgumentException('No located warehouse has sufficient available stock for this order.');
        }

        return $eligible->sort(function (Warehouse $first, Warehouse $second) use ($address): int {
            $distance = $this->distance((float) $address->latitude, (float) $address->longitude, (float) $first->latitude, (float) $first->longitude)
                <=> $this->distance((float) $address->latitude, (float) $address->longitude, (float) $second->latitude, (float) $second->longitude);

            return $distance ?: strcmp($first->id, $second->id);
        })->first();
    }

    private function assertStockAvailable(Warehouse $warehouse, mixed $requiredByProduct): void
    {
        foreach ($requiredByProduct as $productId => $lines) {
            $stock = WarehouseStock::query()->where('warehouse_id', $warehouse->id)
                ->where('product_id', $productId)->lockForUpdate()->first();
            if ($stock === null || $stock->available_quantity < $lines->sum('quantity')) {
                throw new InvalidArgumentException("Warehouse {$warehouse->name} has insufficient available stock for {$lines->first()->product_sku}.");
            }
        }
    }

    private function distance(float $fromLat, float $fromLng, float $toLat, float $toLng): float
    {
        $latitudeDelta = deg2rad($toLat - $fromLat);
        $longitudeDelta = deg2rad($toLng - $fromLng);
        $arc = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat)) * sin($longitudeDelta / 2) ** 2;

        return 6371.0088 * 2 * asin(min(1.0, sqrt($arc)));
    }
}
