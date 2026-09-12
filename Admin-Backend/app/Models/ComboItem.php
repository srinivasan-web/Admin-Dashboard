<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;
use LogicException;

#[Fillable(['combo_id', 'product_id', 'quantity'])]
class ComboItem extends Pivot
{
    use HasUuids;

    /** @var bool */
    public $incrementing = false;

    /** @var string */
    protected $keyType = 'string';

    protected static function booted(): void
    {
        static::creating(static function (ComboItem $comboItem): void {
            if ($comboItem->quantity < 1) {
                throw new LogicException('Combo item quantity must be at least one.');
            }
        });
    }
}
