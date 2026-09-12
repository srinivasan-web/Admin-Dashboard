<?php

namespace App\Models;

use Database\Factories\WarehouseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name'])]
class Warehouse extends Model
{
    /** @use HasFactory<WarehouseFactory> */
    use HasFactory, HasUuids;

    /** @return HasMany<WarehouseStock, $this> */
    public function stocks(): HasMany
    {
        return $this->hasMany(WarehouseStock::class);
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
