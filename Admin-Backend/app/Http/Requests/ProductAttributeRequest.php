<?php

namespace App\Http\Requests;

use App\Domain\Catalog\SpecificationValue;
use App\Models\Attribute;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductAttributeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        $product = $this->route('product');
        $productAttribute = $this->route('productAttribute');

        return [
            'attribute_id' => [
                'required',
                'uuid',
                Rule::exists('attributes', 'id')->where('is_active', true),
                Rule::unique('product_attributes', 'attribute_id')
                    ->where('product_id', $product?->id)
                    ->ignore($productAttribute?->id),
            ],
            'value' => ['required', 'string', 'max:1000', function ($field, $value, $fail) use ($productAttribute) {
                // Retain legacy stored values when only ordering/flags change.
                if ($productAttribute && $productAttribute->attribute_id === $this->input('attribute_id') && $productAttribute->value === $value) {
                    return;
                }
                if (! is_string($this->input('attribute_id'))) {
                    return;
                }
                $attribute = Attribute::query()->find($this->input('attribute_id'));
                if ($attribute && is_string($value) && ! SpecificationValue::valid($attribute->data_type, $value)) {
                    $fail('Enter a valid '.$attribute->data_type.' value; enter units separately through the attribute definition.');
                }
            }],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'show_on_top' => ['sometimes', 'boolean'],
        ];
    }
}
