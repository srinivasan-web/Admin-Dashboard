<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FinanceConfigurationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        return match ($this->route('kind')) {
            'emi-providers' => [
                'name' => ['required', 'string', 'max:255'],
                'code' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9_-]+$/D', Rule::unique('emi_providers', 'code')->ignore($this->route('record'))],
                'is_active' => ['required', 'boolean'],
            ],
            'emi-plans' => [
                'provider_id' => ['required', 'uuid', 'exists:emi_providers,id'],
                'tenure_months' => ['required', 'integer', 'between:1,120'],
                'annual_interest_rate' => ['required', 'numeric', 'between:0,100', 'decimal:0,4'],
                'processing_fee' => ['required', 'numeric', 'between:0,9999999999.99', 'decimal:0,2'],
                'minimum_amount' => ['required', 'numeric', 'between:0,9999999999.99', 'decimal:0,2'],
                'maximum_amount' => ['nullable', 'numeric', 'between:0,9999999999.99', 'decimal:0,2', 'gte:minimum_amount'],
                'is_no_cost' => ['required', 'boolean'],
                'starts_at' => ['nullable', 'date'], 'ends_at' => ['nullable', 'date', Rule::when($this->filled('starts_at'), 'after:starts_at')],
                'is_active' => ['required', 'boolean'],
            ],
            'product-emi-plans' => [
                'product_id' => ['required', 'uuid', Rule::exists('products', 'id')->whereNull('deleted_at')],
                'variant_id' => ['nullable', 'uuid', Rule::exists('product_variants', 'id')->where('product_id', $this->input('product_id'))->whereNull('deleted_at')],
                'emi_plan_id' => ['required', 'uuid', 'exists:emi_plans,id', Rule::unique('product_emi_plans', 'emi_plan_id')
                    ->where('target_key', $this->input('variant_id') ?: $this->input('product_id'))->ignore($this->route('record'))],
                'is_active' => ['required', 'boolean'], 'sort_order' => ['required', 'integer', 'min:0'],
            ],
            'flash-sales' => [
                'name' => ['required', 'string', 'max:255'], 'starts_at' => ['required', 'date'],
                'ends_at' => ['required', 'date', 'after:starts_at'], 'is_active' => ['required', 'boolean'],
            ],
            'flash-sale-products' => [
                'flash_sale_id' => ['required', 'uuid', 'exists:flash_sales,id'],
                'product_id' => ['required', 'uuid', Rule::exists('products', 'id')->whereNull('deleted_at'),
                    Rule::unique('flash_sale_products', 'product_id')->where('flash_sale_id', $this->input('flash_sale_id'))->ignore($this->route('record'))],
                'discount_type' => ['required', 'in:price,fixed,percent'],
                'discount_value' => ['required', 'numeric', 'gt:0', 'max:'.($this->input('discount_type') === 'percent' ? '99.99' : '9999999999.99'), 'decimal:0,2'],
                'is_active' => ['required', 'boolean'],
            ],
            default => [],
        };
    }
}
