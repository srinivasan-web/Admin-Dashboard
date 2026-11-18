<?php

namespace App\Actions;

use App\Models\EmiCalculation;
use App\Services\EmiEnquiryDelivery;
use App\Services\ProductPurchaseQuote;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SubmitEmiEnquiry
{
    public function execute(string $identifier, array $data): EmiCalculation
    {
        $fingerprint = hash_hmac('sha256', implode('|', [$identifier, $data['variant_id'] ?? '', $data['plan_id'], $data['mobile_number']]), (string) config('app.key'));
        try {
            return DB::transaction(function () use ($identifier, $data, $fingerprint) {
                if ($existing = $this->existing($data['idempotency_key'] ?? null, $fingerprint)) {
                    return $existing;
                }
                $service = app(ProductPurchaseQuote::class);
                $item = $service->product($identifier, $data['variant_id'] ?? null);
                // Serialize duplicate submissions for this product before lookup/create.
                $item->newQuery()->whereKey($item->id)->lockForUpdate()->firstOrFail();
                if ($existing = $this->existing($data['idempotency_key'] ?? null, $fingerprint)) {
                    return $existing;
                }
                $quote = $service->selected($item->fresh(), $data['plan_id'], $data['variant_id'] ?? null);
                $delivery = app(EmiEnquiryDelivery::class);
                $issue = $delivery->configurationIssue();
                $record = EmiCalculation::query()->create([
                    'product_id' => $item->id, 'variant_id' => $data['variant_id'] ?? null,
                    'emi_plan_id' => $quote['plan_id'], 'mobile_number' => $data['mobile_number'], 'consented_at' => now(), 'quote' => $quote,
                    'idempotency_key' => $data['idempotency_key'] ?? null, 'request_fingerprint' => $fingerprint,
                    'notification_status' => $issue ? 'blocked' : 'pending', 'notification_error' => $issue,
                ]);
                if (! $issue) {
                    $delivery->queue($record->id);
                }

                return $record;
            });
        } catch (UniqueConstraintViolationException $exception) {
            return $this->existing($data['idempotency_key'] ?? null, $fingerprint) ?? throw $exception;
        }
    }

    private function existing(?string $key, string $fingerprint): ?EmiCalculation
    {
        $record = $key ? EmiCalculation::query()->where('idempotency_key', $key)->first() : null;
        if ($record && ! hash_equals((string) $record->request_fingerprint, $fingerprint)) {
            throw ValidationException::withMessages(['idempotency_key' => 'This submission reference was already used for another enquiry.']);
        }

        return $record;
    }
}
