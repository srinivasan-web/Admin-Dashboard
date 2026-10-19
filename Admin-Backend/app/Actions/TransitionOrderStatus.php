<?php

namespace App\Actions;

use App\Domain\Orders\OrderStateRules;
use App\Domain\Orders\OrderStatusConflict;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\User;
use App\Services\OrderInventoryService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class TransitionOrderStatus
{
    public function __construct(private readonly OrderInventoryService $inventory) {}

    public function execute(Order $order, ?string $orderStatus = null, ?string $paymentStatus = null, ?string $fulfillmentStatus = null, ?User $changedBy = null, ?string $expectedOrderStatus = null): Order
    {
        if ($orderStatus === null && $paymentStatus === null && $fulfillmentStatus === null) {
            throw new InvalidArgumentException('At least one status transition is required.');
        }

        return DB::transaction(function () use ($order, $orderStatus, $paymentStatus, $fulfillmentStatus, $changedBy, $expectedOrderStatus): Order {
            $order = Order::query()->lockForUpdate()->findOrFail($order->getKey());

            if ($expectedOrderStatus !== null && $order->status !== $expectedOrderStatus) {
                if ($orderStatus === $order->status && $paymentStatus === null && $fulfillmentStatus === null) {
                    return $order->load('statusHistories');
                }
                throw new OrderStatusConflict('The order status changed. Refresh the order and try again.');
            }

            if ($changedBy !== null && (! $changedBy->exists || ! User::query()->whereKey($changedBy->getKey())->exists())) {
                throw new InvalidArgumentException('Status-change actor must be persisted.');
            }

            $targetOrderStatus = $orderStatus ?? $order->status;
            $targetPaymentStatus = $paymentStatus ?? $order->payment_status;
            $targetFulfillmentStatus = $fulfillmentStatus ?? $order->fulfillment_status;

            if ($orderStatus !== null) {
                $this->assertOrderTransition($order, $targetOrderStatus);
                if ($targetOrderStatus === 'confirmed' && $targetPaymentStatus !== 'paid') {
                    throw new InvalidArgumentException('An order can only be confirmed after successful payment.');
                }
            }

            if ($paymentStatus !== null) {
                OrderStateRules::assertTransition('payment', $order->payment_status, $targetPaymentStatus);
            }

            if ($fulfillmentStatus !== null) {
                OrderStateRules::assertTransition('fulfillment', $order->fulfillment_status, $targetFulfillmentStatus);
            }

            if ($targetOrderStatus === $order->status && $targetPaymentStatus === $order->payment_status && $targetFulfillmentStatus === $order->fulfillment_status) {
                return $order->load('statusHistories');
            }
            OrderStateRules::assertConsistent($targetOrderStatus, $targetPaymentStatus, $targetFulfillmentStatus);

            if ($targetOrderStatus === 'cancelled' && $order->status !== 'cancelled') {
                if (in_array($order->fulfillment_status, ['shipped', 'in_transit', 'out_for_delivery', 'delivered'], true)
                    || $order->shipments()->where(fn ($q) => $q->whereNotNull('shipped_at')->orWhereIn('status', ['shipped', 'in_transit', 'out_for_delivery', 'delivered']))->exists()) {
                    throw new InvalidArgumentException('A shipped order must use the return or RTO flow.');
                }
                $this->inventory->release($order, $changedBy);
                $this->inventory->restoreCancellation($order, $changedBy);
            }
            if ($targetOrderStatus === 'abandoned' && $order->status !== 'abandoned') {
                $this->inventory->release($order, $changedBy);
            }

            if (in_array($targetOrderStatus, ['confirmed', 'processing', 'picked', 'packed', 'invoiced', 'ready_to_ship', 'completed'], true)
                && ($targetPaymentStatus !== 'paid' || ! $order->items()->exists() || $order->items()->count() !== $order->stockReservations()->where('status', 'COMMITTED')->count())) {
                throw new InvalidArgumentException('Paid, committed inventory is required for fulfillment operations.');
            }

            $priorOrderStatus = $order->status;
            $order->fill([
                'status' => $targetOrderStatus,
                'payment_status' => $targetPaymentStatus,
                'fulfillment_status' => $targetFulfillmentStatus,
            ]);
            $order->save();

            if ($priorOrderStatus !== $targetOrderStatus) {
                $order->statusHistories()->create([
                    'from_status' => $priorOrderStatus,
                    'to_status' => $targetOrderStatus,
                    'changed_by' => $changedBy?->getKey(),
                ]);
            }

            return $order->fresh(['statusHistories']);
        });
    }

    private function assertOrderTransition(Order $order, string $targetStatus): void
    {
        $heldFromStatus = null;
        if ($order->status === 'hold') {
            $heldFromStatus = OrderStatusHistory::query()
                ->where('order_id', $order->getKey())
                ->where('to_status', 'hold')
                ->latest('created_at')
                ->orderByDesc('id')
                ->value('from_status');
        }
        OrderStateRules::assertTransition('order', $order->status, $targetStatus, $heldFromStatus);
    }
}
