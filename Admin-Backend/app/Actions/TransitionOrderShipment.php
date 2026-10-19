<?php

namespace App\Actions;

use App\Domain\Orders\OrderStateRules;
use App\Models\Order;
use App\Models\Shipment;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class TransitionOrderShipment
{
    public function execute(Order $order, Shipment $shipment, string $status): Shipment
    {
        return DB::transaction(function () use ($order, $shipment, $status): Shipment {
            $order = Order::query()->lockForUpdate()->findOrFail($order->getKey());
            $shipment = Shipment::query()->lockForUpdate()->findOrFail($shipment->getKey());
            if ($shipment->order_id !== $order->getKey()) {
                throw new InvalidArgumentException('Shipment does not belong to this order.');
            }
            if (trim($shipment->carrier) === '') {
                throw new InvalidArgumentException('Shipment carrier is required.');
            }
            if ($status !== 'cancelled' && ($order->warehouse_id === null || $shipment->warehouse_id !== $order->warehouse_id)) {
                throw new InvalidArgumentException('Shipment warehouse must match the allocated order warehouse.');
            }
            if (in_array($status, ['processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'], true)
                && ($order->payment_status !== 'paid' || ! in_array($order->status, ['confirmed', 'processing', 'picked', 'packed', 'invoiced', 'ready_to_ship', 'completed'], true))) {
                throw new InvalidArgumentException('Only a paid, confirmed order can enter shipment processing.');
            }
            OrderStateRules::assertTransition('fulfillment', $shipment->status, $status);
            if ($status !== 'cancelled' && (! $order->items()->exists()
                || $order->items()->count() !== $order->stockReservations()->where('status', 'COMMITTED')->where('warehouse_id', $order->warehouse_id)->count())) {
                throw new InvalidArgumentException('Shipment requires committed inventory in the allocated warehouse.');
            }
            if ($status === 'delivered') {
                OrderStateRules::assertConsistent($order->status, $order->payment_status, $status);
            }
            if ($shipment->status === $status) {
                return $shipment->load(['order', 'warehouse']);
            }

            $shipment->status = $status;
            if ($status === 'shipped' && $shipment->shipped_at === null) {
                $shipment->shipped_at = now();
            }
            if ($status === 'in_transit') {
                $shipment->in_transit_at ??= now();
            }
            if ($status === 'out_for_delivery') {
                $shipment->out_for_delivery_at ??= now();
            }
            if ($status === 'delivered') {
                if ($shipment->shipped_at === null) {
                    throw new InvalidArgumentException('A delivery requires a recorded shipping timestamp.');
                }
                $shipment->delivered_at ??= now();
            }
            if ($shipment->delivered_at !== null && ($shipment->shipped_at === null || $shipment->delivered_at->lt($shipment->shipped_at))) {
                throw new InvalidArgumentException('Delivery cannot precede shipping.');
            }
            $shipment->save();

            $states = $order->shipments()->pluck('status');
            $aggregate = $states->every(fn ($state) => $state === 'delivered') ? 'delivered'
                : ($states->contains('out_for_delivery') ? 'out_for_delivery' : ($states->contains('in_transit') ? 'in_transit' : ($states->contains('shipped') ? 'shipped'
                    : ($states->contains('processing') ? 'processing'
                        : ($states->every(fn ($state) => $state === 'cancelled') ? 'cancelled' : 'pending')))));
            $order->update(['fulfillment_status' => $aggregate]);

            // Inventory was committed after payment; shipment never deducts it again.
            return $shipment->load(['order', 'warehouse']);
        });
    }
}
