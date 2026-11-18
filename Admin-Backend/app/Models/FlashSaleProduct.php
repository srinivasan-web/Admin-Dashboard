<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['flash_sale_id', 'product_id', 'discount_type', 'discount_value', 'is_active'])]
class FlashSaleProduct extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return ['discount_value' => 'decimal:2', 'is_active' => 'boolean'];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(FlashSale::class, 'flash_sale_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
