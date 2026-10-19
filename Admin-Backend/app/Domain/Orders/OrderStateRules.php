<?php

namespace App\Domain\Orders;

use InvalidArgumentException;

final class OrderStateRules
{
    // Shared existing vocabulary; shipping is not an order status.
    private const TRANSITIONS = [
        'order' => [
            'pending' => ['confirmed', 'cancelled', 'abandoned', 'hold'],
            'confirmed' => ['processing', 'cancelled', 'hold'],
            'processing' => ['picked', 'completed', 'cancelled', 'hold'],
            'picked' => ['packed', 'cancelled', 'hold'],
            'packed' => ['invoiced', 'cancelled', 'hold'],
            'invoiced' => ['ready_to_ship', 'cancelled', 'hold'],
            'ready_to_ship' => ['completed', 'cancelled', 'hold'],
            'hold' => [], 'completed' => [], 'cancelled' => [], 'abandoned' => [],
        ],
        'payment' => [
            'pending' => ['authorized', 'failed'],
            'authorized' => ['paid', 'failed', 'refunded'],
            'paid' => ['refunded'], 'failed' => [], 'refunded' => [],
        ],
        'fulfillment' => [
            'pending' => ['processing', 'cancelled'],
            'processing' => ['shipped', 'cancelled'],
            'shipped' => ['in_transit', 'delivered'],
            'in_transit' => ['out_for_delivery', 'delivered'],
            'out_for_delivery' => ['delivered'], 'delivered' => [], 'cancelled' => [],
        ],
    ];

    /** @return list<string> */
    public static function statuses(string $domain): array
    {
        if (! isset(self::TRANSITIONS[$domain])) {
            throw new InvalidArgumentException("Unknown {$domain} status domain.");
        }

        return array_keys(self::TRANSITIONS[$domain]);
    }

    /** @return list<string> */
    public static function allowedTransitions(string $domain, ?string $current, ?string $heldFrom = null): array
    {
        if (! isset(self::TRANSITIONS[$domain][$current])) {
            return [];
        }

        if ($domain === 'order' && $current === 'hold') {
            return in_array($heldFrom, ['pending', 'confirmed', 'processing', 'picked', 'packed', 'invoiced', 'ready_to_ship'], true) ? [$heldFrom] : [];
        }

        return self::TRANSITIONS[$domain][$current];
    }

    public static function assertTransition(string $domain, ?string $current, string $target, ?string $heldFrom = null): void
    {
        $transitions = self::TRANSITIONS[$domain] ?? [];
        if (! isset($transitions[$current]) || ! isset($transitions[$target])) {
            throw new InvalidArgumentException("Unknown {$domain} status.");
        }

        // A retry against the locked persisted state is a no-op, including terminals.
        if ($current === $target) {
            return;
        }

        $allowed = self::allowedTransitions($domain, $current, $heldFrom);

        if (! in_array($target, $allowed, true)) {
            throw new InvalidArgumentException("Invalid {$domain} status transition from {$current} to {$target}.");
        }
    }

    public static function assertConsistent(?string $order, ?string $payment, ?string $fulfillment): void
    {
        if ($order === 'completed' && $payment !== 'paid') {
            throw new InvalidArgumentException('Orders can only complete after payment is paid.');
        }
        if ($fulfillment === 'delivered' && ($order !== 'completed' || $payment !== 'paid')) {
            throw new InvalidArgumentException('Fulfillment can only be delivered for a completed, paid order.');
        }
    }
}
