<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['provider_id', 'tenure_months', 'annual_interest_rate', 'processing_fee', 'minimum_amount', 'maximum_amount', 'is_no_cost', 'starts_at', 'ends_at', 'is_active'])]
class EmiPlan extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return ['tenure_months' => 'integer', 'annual_interest_rate' => 'decimal:4', 'processing_fee' => 'decimal:2', 'minimum_amount' => 'decimal:2', 'maximum_amount' => 'decimal:2', 'is_no_cost' => 'boolean', 'starts_at' => 'datetime', 'ends_at' => 'datetime', 'is_active' => 'boolean'];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(EmiProvider::class, 'provider_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ProductEmiPlan::class, 'emi_plan_id');
    }
}
