<?php

namespace App\Services;

use App\Models\Order;
use App\Models\StockMovement;
use App\Models\WarehouseStock;
use Illuminate\Support\Carbon;

class OrderInventoryView
{
    public function forOrder(Order $order): array
    {
        $stocks = WarehouseStock::query()->where('warehouse_id', $order->warehouse_id)
            ->whereIn('product_id', $order->items->pluck('product_id'))->get()->keyBy('product_id');
        $reservations = $order->stockReservations->keyBy('order_item_id');
        $movements = StockMovement::query()->where('order_id', $order->id)->with('createdBy')->orderBy('created_at')->orderBy('id')->get();
        $rows = $order->items->map(function ($item) use ($stocks, $reservations, $movements): array {
            $stock = $stocks->get($item->product_id);
            $reservation = $reservations->get($item->id);
            $restored = $movements->contains(fn ($movement) => $movement->order_item_id === $item->id && in_array($movement->movement_type, ['RESTORE', 'CANCELLATION_RESTORE'], true));

            return [
                'order_item_id' => $item->id, 'product_id' => $item->product_id,
                'product' => $item->product_name, 'sku' => $item->product_sku, 'ordered_quantity' => $item->quantity,
                'physical' => $stock?->quantity, 'reserved' => $stock?->reserved_quantity, 'available' => $stock?->available_quantity,
                'reservation_status' => $restored ? 'RESTORED' : ($reservation?->status ?? 'NOT_RESERVED'),
                'expires_at' => $reservation?->expires_at?->toISOString(),
                'commit_status' => $restored ? 'RESTORED' : ($reservation?->committed_at ? 'COMPLETED' : 'PENDING'),
            ];
        });
        $statuses = $rows->pluck('reservation_status')->unique();
        $status = $statuses->count() === 1 ? $statuses->first() : ($statuses->isEmpty() ? 'NOT_RESERVED' : 'PARTIAL');
        $timeline = collect([['id' => 'created', 'label' => 'Order created', 'status' => 'success', 'timestamp' => $order->created_at?->toISOString(), 'actor' => null]]);
        if ($order->warehouse_id) {
            $timeline->push(['id' => 'allocated', 'label' => 'Warehouse allocated', 'status' => 'success', 'timestamp' => $order->warehouse_allocated_at?->toISOString(), 'actor' => $order->warehouse_allocated_by]);
        }
        $movementLabels = ['RESERVE' => 'Stock reserved', 'RESERVATION_CREATED' => 'Stock reserved', 'RELEASE' => 'Stock released', 'RESERVATION_RELEASED' => 'Stock released', 'COMMIT' => 'Stock committed', 'ORDER_COMMITTED' => 'Stock committed', 'RESTORE' => 'Stock restored', 'CANCELLATION_RESTORE' => 'Stock restored'];
        foreach ($movements as $movement) {
            if ($movement->movement_type === 'RELEASE' && $reservations->get($movement->order_item_id)?->status === 'EXPIRED') {
                $timeline->push([
                    'id' => $movement->id.'-expired', 'label' => 'Reservation expired', 'status' => 'expired',
                    'timestamp' => $movement->created_at?->toISOString(), 'actor' => null,
                ]);
            }
            $timeline->push([
                'id' => $movement->id, 'label' => $movementLabels[$movement->movement_type] ?? $movement->movement_type, 'status' => 'success',
                'timestamp' => $movement->created_at?->toISOString(), 'actor' => $movement->createdBy?->name,
            ]);
        }
        foreach ($order->payments as $payment) {
            if ($payment->paid_at) {
                $timeline->push(['id' => $payment->id, 'label' => 'Payment successful', 'status' => 'success', 'timestamp' => $payment->paid_at->toISOString(), 'actor' => $payment->provider]);
            } elseif ($payment->status === 'failed') {
                $timeline->push(['id' => $payment->id, 'label' => 'Payment failed', 'status' => 'failed', 'timestamp' => $payment->updated_at?->toISOString(), 'actor' => $payment->provider]);
            }
        }
        foreach ($order->statusHistories as $history) {
            if ($history->from_status === null) {
                continue;
            }
            $timeline->push(['id' => $history->id, 'label' => ucwords(str_replace('_', ' ', $history->to_status)), 'status' => 'success', 'timestamp' => Carbon::parse($history->created_at)->toISOString(), 'actor' => $history->changed_by]);
        }
        foreach ($order->shipments as $shipment) {
            foreach (['created_at' => 'Shipment created', 'shipped_at' => 'Shipped', 'in_transit_at' => 'In transit', 'out_for_delivery_at' => 'Out for delivery', 'delivered_at' => 'Delivered'] as $field => $label) {
                if ($shipment->$field) {
                    $timeline->push(['id' => $shipment->id.$field, 'label' => $label, 'status' => 'success', 'timestamp' => $shipment->$field->toISOString(), 'actor' => $shipment->carrier]);
                }
            }
        }
        $steps = ['Order created', 'Warehouse allocated', 'Stock reserved', 'Payment successful', 'Confirmed', 'Stock committed', 'Processing', 'Picked', 'Packed', 'Invoiced', 'Ready To Ship', 'Shipment created', 'Shipped', 'In transit', 'Out for delivery', 'Delivered'];
        $timeline = $timeline->sortBy(fn ($event) => ($event['timestamp'] ?? '').sprintf('%03d', array_search($event['label'], $steps, true) ?: 0))->values();
        if (! in_array($order->status, ['cancelled', 'abandoned'], true) && ! $reservations->contains('status', 'EXPIRED')) {
            foreach ($steps as $index => $label) {
                if (! $timeline->contains('label', $label)) {
                    $timeline->push(['id' => 'pending-'.$index, 'label' => $label, 'status' => 'pending', 'timestamp' => null, 'actor' => null]);
                }
            }
        }

        return [
            'status' => $status, 'items' => $rows->values(),
            'can_allocate' => $order->status === 'pending' && $reservations->isEmpty() && $order->shipments->isEmpty(),
            'can_reserve' => $order->status === 'pending' && $order->warehouse_id !== null && $reservations->isEmpty() && $rows->isNotEmpty(),
            'timeline' => $timeline,
        ];
    }
}
