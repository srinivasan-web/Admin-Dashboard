<?php

namespace App\Models;

use Database\Factories\HsnCodeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['title', 'type', 'hsn_code', 'sgst_tax_multiplier', 'igst_tax_multiplier'])]
class HsnCode extends Model
{
    /** @use HasFactory<HsnCodeFactory> */
    use HasFactory, HasUuids;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sgst_tax_multiplier' => 'decimal:2',
            'igst_tax_multiplier' => 'decimal:2',
        ];
    }

    /** @return HasMany<Product, $this> */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
