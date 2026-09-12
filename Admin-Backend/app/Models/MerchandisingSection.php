<?php

namespace App\Models;

use Database\Factories\MerchandisingSectionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class MerchandisingSection extends Model
{
    /** @use HasFactory<MerchandisingSectionFactory> */
    use HasFactory, HasUuids;

    /** @var list<string> */
    protected $fillable = ['name', 'slug', 'type', 'sort_order', 'is_active'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsToMany<Product, $this, MerchandisingProduct> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'merchandising_products', 'section_id')
            ->using(MerchandisingProduct::class)
            ->withPivot(['id', 'sort_order', 'is_active'])
            ->withTimestamps();
    }
}
