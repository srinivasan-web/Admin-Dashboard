<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReplaceProductHighlightsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        return ['highlights' => ['present', 'array'], 'highlights.*.product_attribute_id' => ['required', 'uuid', 'distinct'], 'highlights.*.sort_order' => ['sometimes', 'integer', 'min:0'], 'highlights.*.is_active' => ['sometimes', 'boolean']];
    }
}
