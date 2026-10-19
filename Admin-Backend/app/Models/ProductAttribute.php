<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProductAttribute extends Model
{
    use HasUuids;

    protected $fillable = ['product_id', 'attribute_id', 'value', 'sort_order', 'show_on_top'];

    protected function casts(): array
    {
        return ['show_on_top' => 'boolean'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(Attribute::class);
    }

    public function highlight(): HasOne
    {
        return $this->hasOne(ProductHighlight::class);
    }
}
