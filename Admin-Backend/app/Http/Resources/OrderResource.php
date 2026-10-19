<?php

namespace App\Http\Resources;

use App\Domain\Orders\OrderStateRules;
use App\Models\Warehouse;
use App\Services\OrderInventoryView;
use Illuminate\Http\Request;

class OrderResource extends OrderListResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'inventory' => app(OrderInventoryView::class)->forOrder($this->resource),
            'allocation_warehouses' => $request->user()?->can('update', $this->resource)
                ? Warehouse::query()->orderBy('name')->get(['id', 'name']) : [],
            'billing_address' => $this->whenLoaded('billingAddress', fn () => $this->addressSnapshot($this->billingAddress)),
            'shipping_address' => $this->whenLoaded('shippingAddress', fn () => $this->addressSnapshot($this->shippingAddress)),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'product_sku' => $item->product_sku,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'discount_amount' => $item->discount_amount,
                'tax_amount' => $item->tax_amount,
                'line_total' => $item->line_total,
            ])),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'method' => $payment->method,
                'provider' => $payment->provider,
                'provider_transaction_reference' => $payment->provider_transaction_reference,
                'amount' => $payment->amount,
                'currency' => $payment->currency,
                'status' => $payment->status,
                'paid_at' => $payment->paid_at?->toISOString(),
                'created_at' => $payment->created_at?->toISOString(),
            ])),
            'shipments' => $this->whenLoaded('shipments', fn () => $this->shipments->map(fn ($shipment) => [
                'id' => $shipment->id,
                'warehouse_id' => $shipment->warehouse_id,
                'warehouse' => $shipment->warehouse ? [
                    'id' => $shipment->warehouse->id,
                    'name' => $shipment->warehouse->name,
                ] : null,
                'carrier' => $shipment->carrier,
                'tracking_reference' => $shipment->tracking_reference,
                'status' => $shipment->status,
                'shipped_at' => $shipment->shipped_at?->toISOString(),
                'delivered_at' => $shipment->delivered_at?->toISOString(),
            ])),
            'stock_reservations' => $this->whenLoaded('stockReservations', fn () => $this->stockReservations->map(fn ($reservation) => [
                'id' => $reservation->id,
                'order_item_id' => $reservation->order_item_id,
                'warehouse_id' => $reservation->warehouse_id,
                'product_id' => $reservation->product_id,
                'quantity' => $reservation->quantity,
                'status' => $reservation->status,
                'reserved_at' => $reservation->reserved_at?->toISOString(),
                'expires_at' => $reservation->expires_at?->toISOString(),
                'released_at' => $reservation->released_at?->toISOString(),
                'committed_at' => $reservation->committed_at?->toISOString(),
                'restored_at' => $reservation->restored_at?->toISOString(),
            ])),
            'status_history' => $this->whenLoaded('statusHistories', fn () => $this->statusHistories->map(fn ($history) => [
                'id' => $history->id,
                'from_status' => $history->from_status,
                'to_status' => $history->to_status,
                'changed_by' => $history->changed_by,
                'created_at' => $history->created_at,
            ])),
            'allowed_actions' => [
                'order_statuses' => $this->allowedOrderStatuses(),
                'payment_statuses' => $this->payments->mapWithKeys(fn ($payment) => [
                    $payment->id => $this->allowedPaymentStatuses($payment),
                ]),
                'shipment_statuses' => $this->shipments->mapWithKeys(fn ($shipment) => [
                    $shipment->id => $this->allowedShipmentStatuses($shipment),
                ]),
            ],
        ];
    }

    /** @return list<string> */
    private function allowedOrderStatuses(): array
    {
        $heldFrom = $this->status === 'hold'
            ? $this->statusHistories->where('to_status', 'hold')->last()?->from_status
            : null;

        return array_values(array_filter(
            OrderStateRules::allowedTransitions('order', $this->status, $heldFrom),
            fn (string $status): bool => ! (
                ($status === 'confirmed' || $status === 'completed') && $this->payment_status !== 'paid'
            ) && ! (
                in_array($status, ['confirmed', 'processing', 'picked', 'packed', 'invoiced', 'ready_to_ship', 'completed'], true)
                && ($this->payment_status !== 'paid' || $this->items->isEmpty() || $this->items->count() !== $this->stockReservations->where('status', 'COMMITTED')->count())
            ) && ! (
                $status === 'cancelled' && $this->shipments->contains(
                    fn ($shipment): bool => $shipment->shipped_at !== null || in_array($shipment->status, ['shipped', 'in_transit', 'out_for_delivery', 'delivered'], true)
                )
            )
        ));
    }

    /** @return list<string> */
    private function allowedPaymentStatuses(mixed $payment): array
    {
        return array_values(array_filter(
            OrderStateRules::allowedTransitions('payment', $payment->status),
            fn (string $status): bool => $status !== 'paid'
                || ($this->warehouse_id !== null && in_array($this->status, ['pending', 'confirmed'], true)
                    && $this->items->isNotEmpty() && $this->items->every(fn ($item) => $this->stockReservations->contains(
                        fn ($reservation) => $reservation->order_item_id === $item->id && $reservation->warehouse_id === $this->warehouse_id
                            && $reservation->quantity === $item->quantity && in_array($reservation->status, ['ACTIVE', 'COMMITTED'], true)
                            && ($reservation->status === 'COMMITTED' || $reservation->expires_at?->isFuture())
                    )))
        ));
    }

    /** @return list<string> */
    private function allowedShipmentStatuses(mixed $shipment): array
    {
        return array_values(array_filter(
            OrderStateRules::allowedTransitions('fulfillment', $shipment->status),
            fn (string $status): bool => $status === 'cancelled' || (
                $this->warehouse_id !== null
                && $shipment->warehouse_id === $this->warehouse_id
                && $this->payment_status === 'paid'
                && in_array($this->status, ['confirmed', 'processing', 'picked', 'packed', 'invoiced', 'ready_to_ship', 'completed'], true)
                && ($status !== 'delivered' || (
                    $this->status === 'completed' && $shipment->shipped_at !== null
                ))
            )
        ));
    }

    /** @return array<string, string|null>|null */
    private function addressSnapshot(mixed $address): ?array
    {
        if ($address === null) {
            return null;
        }

        return [
            'name' => $address->name,
            'phone' => $address->phone,
            'email' => $address->email,
            'address' => $address->address,
            'state' => $address->state,
            'city' => $address->city,
            'postal_code' => $address->postal_code,
            'latitude' => $address->latitude,
            'longitude' => $address->longitude,
        ];
    }
}
