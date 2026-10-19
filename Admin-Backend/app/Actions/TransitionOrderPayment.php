<?php

namespace App\Actions;

use App\Domain\Orders\OrderMoney;
use App\Domain\Orders\OrderStateRules;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\User;
use App\Services\OrderInventoryService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class TransitionOrderPayment
{
    public function __construct(private readonly OrderInventoryService $inventory) {}

    // This validates a persisted transaction; it is not gateway verification or reconciliation.
    public function execute(Order $order, Payment $payment, string $status, ?User $actor = null): Payment
    {
        return DB::transaction(function () use ($order, $payment, $status, $actor): Payment {
            $order = Order::query()->lockForUpdate()->findOrFail($order->getKey());
            $payment = Payment::query()->lockForUpdate()->findOrFail($payment->getKey());
            if ($payment->order_id !== $order->getKey()) {
                throw new InvalidArgumentException('Payment does not belong to this order.');
            }

            // No order currency or partial-payment allocation policy exists yet.
            // Validate representation without inventing equality to the order total.
            OrderMoney::toMinorUnits((string) $payment->getRawOriginal('amount'), 'Payment amount');
            if (! preg_match('/^[A-Z]{3}$/D', $payment->currency)) {
                throw new InvalidArgumentException('Payment currency must be a three-letter uppercase code.');
            }
            if (trim($payment->provider) === '' || trim($payment->provider_transaction_reference) === '') {
                throw new InvalidArgumentException('Payment provider and transaction reference are required.');
            }
            OrderStateRules::assertTransition('payment', $payment->status, $status);
            // A persisted transition already committed its side effects atomically.
            // Later order progress must not be replayed or rewound by a retry.
            if ($payment->status === $status) {
                return $payment->load('order');
            }
            if ($payment->status !== $status) {
                $payment->update([
                    'status' => $status,
                    'paid_at' => $status === 'paid' ? ($payment->paid_at ?? now()) : $payment->paid_at,
                ]);
            }

            if ($status === 'authorized' && $order->payment_status === 'pending') {
                $order->update(['payment_status' => 'authorized']);
            }

            if ($status === 'paid') {
                if (! in_array($order->status, ['pending', 'confirmed'], true)) {
                    throw new InvalidArgumentException('Payment cannot confirm an order in its current state.');
                }
                if ($order->warehouse_id === null) {
                    throw new InvalidArgumentException('A warehouse must be assigned before payment can commit inventory.');
                }
                $this->inventory->commit($order, $actor);
                $priorStatus = $order->status;
                $order->update(['status' => 'confirmed', 'payment_status' => 'paid']);
                if ($priorStatus !== 'confirmed') {
                    OrderStatusHistory::query()->create([
                        'order_id' => $order->id,
                        'from_status' => $priorStatus,
                        'to_status' => 'confirmed',
                        'changed_by' => $actor?->id,
                    ]);
                }
            }

            if ($status === 'failed' && ! $order->payments()->where('status', 'paid')->exists()) {
                $this->inventory->release($order, $actor);
                $priorStatus = $order->status;
                $order->update(['status' => 'cancelled', 'payment_status' => 'failed']);
                if ($priorStatus !== 'cancelled') {
                    OrderStatusHistory::query()->create([
                        'order_id' => $order->id,
                        'from_status' => $priorStatus,
                        'to_status' => 'cancelled',
                        'changed_by' => $actor?->id,
                    ]);
                }
            }

            if ($status === 'refunded') {
                // Refund is intentionally independent from restocking.
                $order->update(['payment_status' => 'refunded']);
            }

            return $payment->load('order');
        });
    }
}
