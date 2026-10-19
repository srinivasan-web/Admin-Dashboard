<?php

namespace App\Domain\Orders;

use InvalidArgumentException;

final class OrderMoney
{
    public const MAX_MINOR_UNITS = 999999999999;

    public static function toMinorUnits(string $amount, string $field): int
    {
        // Bound the input before integer conversion, so huge inputs cannot overflow.
        if (! preg_match('/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/D', $amount)) {
            throw new InvalidArgumentException($field.' must be a non-negative DECIMAL(12,2) amount.');
        }
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '0');

        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
    }

    public static function fromMinorUnits(int $amount): string
    {
        if ($amount < 0 || $amount > self::MAX_MINOR_UNITS) {
            throw new InvalidArgumentException('Amount exceeds the supported money range.');
        }

        return intdiv($amount, 100).'.'.str_pad((string) ($amount % 100), 2, '0', STR_PAD_LEFT);
    }
}
