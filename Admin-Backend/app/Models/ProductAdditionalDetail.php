<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductAdditionalDetail extends Model
{
    use HasUuids;

    protected $fillable = [
        'product_id', 'generic_name', 'model_number', 'net_quantity',
        'country_of_origin', 'manufactured_by', 'marketed_by', 'consumer_complaints',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
