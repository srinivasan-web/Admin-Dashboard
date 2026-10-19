<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCategoryListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        $categoryId = $this->route('category')?->getKey();

        return [
            'product_id' => [
                'required', 'uuid',
                Rule::exists('products', 'id')->whereNull('deleted_at'),
                Rule::unique('category_product_listings', 'product_id')->where('category_id', $categoryId),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:4294967295'],
            'is_featured' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
