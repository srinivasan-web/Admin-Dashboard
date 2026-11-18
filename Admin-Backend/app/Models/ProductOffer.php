<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'scope_type', 'product_id', 'category_id', 'product_type_id', 'title', 'description',
    'offer_type', 'coupon_code', 'discount_type', 'discount_value', 'maximum_discount',
    'minimum_order_amount', 'starts_at', 'ends_at', 'is_active', 'sort_order',
])]
class ProductOffer extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'discount_value' => 'decimal:2',
            'maximum_discount' => 'decimal:2',
            'minimum_order_amount' => 'decimal:2',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function productType(): BelongsTo
    {
        return $this->belongsTo(ProductType::class);
    }
}
