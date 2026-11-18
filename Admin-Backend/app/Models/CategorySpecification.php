<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CategorySpecification extends Model
{
    use HasUuids;

    protected $fillable = [
        'category_id', 'attribute_id', 'label', 'sort_order',
        'is_required', 'is_filterable', 'is_comparable', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer', 'is_required' => 'boolean',
            'is_filterable' => 'boolean', 'is_comparable' => 'boolean', 'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(Attribute::class);
    }
}
