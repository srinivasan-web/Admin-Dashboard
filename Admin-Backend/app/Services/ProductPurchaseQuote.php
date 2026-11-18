<?php

namespace App\Services;

use App\Domain\Orders\OrderMoney;
use App\Models\EmiPlan;
use App\Models\FlashSaleProduct;
use App\Models\Product;
use App\Models\ProductEmiPlan;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductPurchaseQuote
{
    public function product(string $identifier, ?string $variantId = null): Product
    {
        $product = Product::query()->where(Str::isUuid($identifier) ? 'id' : 'slug', $identifier)
            ->where('is_active', true)
            ->whereHas('category', fn (Builder $q) => $q->where('is_active', true))
            ->whereHas('productType', fn (Builder $q) => $q->where('is_active', true))
            ->whereHas('warehouseStocks', fn (Builder $q) => $q->whereColumn('quantity', '>', 'reserved_quantity'))
            ->firstOrFail();
        if ($variantId && ! $product->variants()->whereKey($variantId)->exists()) {
            throw ValidationException::withMessages(['variant_id' => 'Select a variant belonging to this product.']);
        }

        return $product;
    }

    public function price(Product $product): array
    {
        $mrp = OrderMoney::toMinorUnits($product->mrp_price, 'MRP');
        $base = $product->sale_price !== null ? min($mrp, OrderMoney::toMinorUnits($product->sale_price, 'Selling price')) : $mrp;
        $current = $base;
        $flash = null;
        $now = now();
        // Bounded database selection, not an unbounded scan through historical sales.
        $sale = FlashSaleProduct::query()->with('sale')
            ->where('product_id', $product->id)->where('is_active', true)
            ->whereHas('sale', fn (Builder $q) => $q->where('is_active', true)->where('starts_at', '<=', $now)->where('ends_at', '>', $now))
            ->where(function (Builder $q) use ($base): void {
                $q->where(fn (Builder $q) => $q->where('discount_type', 'price')->where('discount_value', '>', 0)->where('discount_value', '<', $base / 100))
                    ->orWhere(fn (Builder $q) => $q->where('discount_type', 'percent')->where('discount_value', '>', 0)->where('discount_value', '<', 100))
                    ->orWhere(fn (Builder $q) => $q->where('discount_type', 'fixed')->where('discount_value', '>', 0)->where('discount_value', '<', $base / 100));
            })
            ->orderByRaw("CASE discount_type WHEN 'price' THEN ROUND(discount_value * 100) WHEN 'fixed' THEN ? - ROUND(discount_value * 100) ELSE ? - ROUND(? * discount_value / 100) END", [$base, $base, $base])
            ->orderBy('id')->first();
        if ($sale) {
            $value = OrderMoney::toMinorUnits($sale->discount_value, 'Sale value');
            $candidate = match ($sale->discount_type) {
                'price' => $value,
                'fixed' => $base - $value,
                'percent' => $base - intdiv($base * $value + 5000, 10000),
            };
            if ($candidate > 0 && $candidate < $base) {
                $current = $candidate;
                $flash = ['id' => $sale->sale->id, 'name' => $sale->sale->name,
                    'starts_at' => $sale->sale->starts_at->toIso8601String(), 'ends_at' => $sale->sale->ends_at->toIso8601String()];
            }
        }

        return ['currency' => 'INR', 'mrp' => OrderMoney::fromMinorUnits($mrp),
            'base_price' => OrderMoney::fromMinorUnits($base), 'selling_price' => OrderMoney::fromMinorUnits($current),
            'discount_percent' => $mrp > 0 ? (int) round(($mrp - $current) * 100 / $mrp) : 0,
            'flash_sale' => $flash, 'server_time' => $now->toIso8601String(),
            'checkout_available' => false];
    }

    public function eligiblePlans(Product $product, int $principal, ?string $variantId = null): Builder
    {
        $now = now();

        return ProductEmiPlan::query()->with('plan.provider')
            ->where('product_id', $product->id)->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereNull('variant_id')->when($variantId, fn (Builder $q) => $q->orWhere('variant_id', $variantId)))
            ->whereHas('plan', fn (Builder $q) => $q->where('is_active', true)
                ->whereBetween('tenure_months', [1, 120])->whereBetween('annual_interest_rate', [0, 100])
                ->where('processing_fee', '>=', 0)->where('minimum_amount', '<=', $principal / 100)
                ->where(fn (Builder $q) => $q->whereNull('maximum_amount')->orWhere('maximum_amount', '>=', $principal / 100))
                ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
                ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', $now))
                ->whereHas('provider', fn (Builder $q) => $q->where('is_active', true)))
            ->orderBy('sort_order')->orderBy('id');
    }

    public function calculate(EmiPlan $plan, int $principal): array
    {
        $months = $plan->tenure_months;
        $monthlyRate = (float) $plan->annual_interest_rate / 1200;
        $zero = $plan->is_no_cost || $monthlyRate == 0;
        $payment = $zero ? $principal / $months
            : $principal * $monthlyRate / (1 - pow(1 + $monthlyRate, -$months));
        // Round the schedule total once, then adjust the final instalment for paise.
        $repayment = $zero ? $principal : (int) round($payment * $months);
        $monthly = (int) round($repayment / $months);
        if ($monthly * ($months - 1) > $repayment) {
            $monthly = intdiv($repayment, $months);
        }
        $fee = OrderMoney::toMinorUnits($plan->processing_fee, 'Processing fee');
        if ($repayment + $fee > OrderMoney::MAX_MINOR_UNITS) {
            throw ValidationException::withMessages(['plan_id' => 'This plan exceeds the supported amount range.']);
        }

        return ['plan_id' => $plan->id, 'provider' => ['id' => $plan->provider->id, 'name' => $plan->provider->name, 'code' => $plan->provider->code],
            'currency' => 'INR', 'tenure_months' => $months, 'annual_interest_rate' => $plan->annual_interest_rate,
            'method' => $plan->is_no_cost ? 'no_cost' : ($zero ? 'zero_interest' : 'reducing_balance'),
            'principal' => OrderMoney::fromMinorUnits($principal), 'monthly_emi' => OrderMoney::fromMinorUnits($monthly),
            'final_instalment' => OrderMoney::fromMinorUnits($repayment - $monthly * ($months - 1)),
            'interest_payable' => OrderMoney::fromMinorUnits($repayment - $principal),
            'processing_fee' => $plan->processing_fee, 'total_payable' => OrderMoney::fromMinorUnits($repayment + $fee),
            'ends_at' => $plan->ends_at?->toIso8601String()];
    }

    public function selected(Product $product, string $planId, ?string $variantId = null): array
    {
        $price = $this->price($product);
        $principal = OrderMoney::toMinorUnits($price['selling_price'], 'Principal');
        $assignment = $this->eligiblePlans($product, $principal, $variantId)->where('emi_plan_id', $planId)->first();
        if (! $assignment) {
            throw ValidationException::withMessages(['plan_id' => 'This EMI plan is not currently eligible. Refresh the plans and try again.']);
        }

        return $this->calculate($assignment->plan, $principal);
    }
}
