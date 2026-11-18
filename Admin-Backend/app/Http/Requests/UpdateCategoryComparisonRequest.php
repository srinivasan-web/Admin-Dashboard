<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoryComparisonRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'specifications' => ['present', 'array', 'max:24'],
            'specifications.*.attribute_id' => [
                'required', 'uuid', 'distinct',
                Rule::exists('attributes', 'id')->where('is_active', true),
            ],
            'specifications.*.label' => ['nullable', 'string', 'max:120'],
            'specifications.*.sort_order' => ['required', 'integer', 'min:0', 'max:4294967295'],
        ];
    }
}
