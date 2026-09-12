<?php

namespace App\Models;

use Database\Factories\ComboFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'is_active'])]
class Combo extends Model
{
    /** @use HasFactory<ComboFactory> */
    use HasFactory, HasUuids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsToMany<Product, $this, ComboItem> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'combo_items')
            ->using(ComboItem::class)
            ->withPivot(['id', 'quantity'])
            ->withTimestamps();
    }
}
