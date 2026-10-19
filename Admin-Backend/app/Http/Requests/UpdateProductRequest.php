<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ProductContentRules;
use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    use ProductContentRules;

    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('product')) ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        /** @var Product $product */
        $product = $this->route('product');

        return [
            'edit_token' => ['sometimes', 'string', 'regex:/^[a-f0-9]{64}$/D'],
            'brand_id' => ['required', 'uuid', Rule::exists('brands', 'id')],
            'category_id' => ['required', 'uuid', Rule::exists('categories', 'id')->where('is_active', true)],
            'product_type_id' => ['required', 'uuid', Rule::exists('product_types', 'id')->where('is_active', true)],
            'hsn_code_id' => ['nullable', 'uuid', Rule::exists('hsn_codes', 'id')],
            'name' => ['required', 'string', 'max:255'],
            'group_name' => ['nullable', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:255', Rule::unique('products', 'sku')->ignore($product)],
            'mrp_price' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999.99'],
            'sale_price' => ['nullable', 'numeric', 'decimal:0,2', 'gt:0', 'lte:mrp_price', 'max:9999999999.99'],
            'tag' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'is_trade_product' => ['sometimes', 'boolean'],
            'description' => ['nullable', 'string'],
        ] + $this->productContentRules($product->getKey());
    }
}
