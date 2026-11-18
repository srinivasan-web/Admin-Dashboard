<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['product_id', 'variant_id', 'emi_plan_id', 'mobile_number', 'consented_at', 'quote', 'idempotency_key', 'request_fingerprint', 'notification_status', 'notification_attempts', 'notification_error', 'notification_locked_until', 'notified_at'])]
class EmiCalculation extends Model
{
    use HasUuids;

    protected $hidden = ['mobile_number', 'quote', 'idempotency_key', 'request_fingerprint'];

    protected function casts(): array
    {
        return ['mobile_number' => 'encrypted', 'consented_at' => 'datetime', 'quote' => 'array', 'notification_attempts' => 'integer', 'notification_locked_until' => 'datetime', 'notified_at' => 'datetime'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(EmiPlan::class, 'emi_plan_id');
    }
}
