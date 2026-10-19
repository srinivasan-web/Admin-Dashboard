<?php

namespace App\Http\Requests;

use App\Domain\Catalog\SpecificationValue;
use App\Models\ProductAttribute;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AttributeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('attribute')?->id;
        $types = SpecificationValue::TYPES;
        if ($this->route('attribute')) {
            $types[] = $this->route('attribute')->data_type;
        }

        return ['name' => ['required', 'string', 'max:255', Rule::unique('attributes', 'name')->ignore($id)], 'slug' => ['nullable', 'string', 'max:255', Rule::unique('attributes', 'slug')->ignore($id)], 'icon' => ['nullable', 'string', 'max:255'], 'description' => ['nullable', 'string'], 'data_type' => ['required', 'string', 'max:50', Rule::in($types)], 'unit' => ['nullable', 'string', 'max:50'], 'is_filterable' => ['sometimes', 'boolean'], 'is_active' => ['sometimes', 'boolean'], 'sort_order' => ['sometimes', 'integer', 'min:0']];
    }

    public function after(): array
    {
        return [function ($validator) {
            $attribute = $this->route('attribute');
            if ($validator->errors()->any() || ! $attribute || $attribute->data_type === $this->input('data_type')) {
                return;
            }
            foreach (ProductAttribute::query()->where('attribute_id', $attribute->id)->select('value')->cursor() as $specification) {
                if (! SpecificationValue::valid($this->input('data_type'), $specification->value)) {
                    $validator->errors()->add('data_type', 'Existing product values are incompatible with this type. Correct those values before changing the definition.');
                    break;
                }
            }
        }];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('name') && ! $this->filled('slug')) {
            $this->merge(['slug' => Str::slug($this->string('name')->toString())]);
        }
    }
}
