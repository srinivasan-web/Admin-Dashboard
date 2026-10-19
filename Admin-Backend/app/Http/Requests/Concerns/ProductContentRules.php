<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Validation\Rule;

trait ProductContentRules
{
    /** @return array<string, array<int, mixed>> */
    private function productContentRules(?string $productId = null): array
    {
        $slug = Rule::unique('products', 'slug');
        if ($productId !== null) {
            $slug->ignore($productId);
        }

        $rules = [
            'slug' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug],
            'short_description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'details' => ['sometimes', 'array', 'max:40'],
            'details.*.id' => ['sometimes', 'uuid'],
            'details.*.title' => ['required', 'string', 'max:255'],
            'details.*.content' => ['required', 'string', 'max:30000'],
            'details.*.sort_order' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'details.*.is_active' => ['sometimes', 'boolean'],
            'additional_details' => ['sometimes', 'array'],
        ];
        foreach (['generic_name', 'model_number', 'net_quantity', 'country_of_origin'] as $field) {
            $rules['additional_details.'.$field] = ['sometimes', 'nullable', 'string', 'max:255'];
        }
        foreach (['manufactured_by', 'marketed_by', 'consumer_complaints'] as $field) {
            $rules['additional_details.'.$field] = ['sometimes', 'nullable', 'string', 'max:10000'];
        }

        return $rules;
    }
}
