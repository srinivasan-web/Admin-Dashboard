<?php

namespace App\Domain\Catalog;

final class SpecificationValue
{
    public const TYPES = ['text', 'number', 'boolean'];

    public static function valid(string $type, string $value): bool
    {
        if (trim($value) === '') {
            return false;
        }

        return match ($type) {
            'number' => preg_match('/^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/D', trim($value)) === 1,
            'boolean' => in_array(strtolower(trim($value)), ['true', 'false', '1', '0'], true),
            // Unknown legacy types retain their existing text representation.
            default => true,
        };
    }
}
