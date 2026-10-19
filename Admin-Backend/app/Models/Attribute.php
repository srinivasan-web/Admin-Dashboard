<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Attribute extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'slug', 'icon', 'description', 'data_type', 'unit', 'is_filterable', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['is_filterable' => 'boolean', 'is_active' => 'boolean'];
    }

    public function productAttributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class);
    }
}
