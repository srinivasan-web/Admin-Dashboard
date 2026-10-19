<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ProductContentRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    use ProductContentRules;

    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'brand_id' => ['required', 'uuid', Rule::exists('brands', 'id')],
            'category_id' => ['required', 'uuid', Rule::exists('categories', 'id')->where('is_active', true)],
            'product_type_id' => ['required', 'uuid', Rule::exists('product_types', 'id')->where('is_active', true)],
            'hsn_code_id' => ['nullable', 'uuid', Rule::exists('hsn_codes', 'id')],
            'name' => ['required', 'string', 'max:255'],
            'group_name' => ['nullable', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:255', Rule::unique('products', 'sku')],
            'mrp_price' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999.99'],
            'sale_price' => ['nullable', 'numeric', 'decimal:0,2', 'gt:0', 'lte:mrp_price', 'max:9999999999.99'],
            'tag' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'is_trade_product' => ['sometimes', 'boolean'],
            'description' => ['nullable', 'string'],
        ] + $this->productContentRules();
    }
}
