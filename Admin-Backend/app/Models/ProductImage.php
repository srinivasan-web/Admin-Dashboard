<?php

namespace App\Models;

use Database\Factories\ProductImageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['product_id', 'media_id', 'type', 'sort_order', 'is_primary'])]
class ProductImage extends Model
{
    /** @use HasFactory<ProductImageFactory> */
    use HasFactory, HasUuids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<Media, $this> */
    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }
}
