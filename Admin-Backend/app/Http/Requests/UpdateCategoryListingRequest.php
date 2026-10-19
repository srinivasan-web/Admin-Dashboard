<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCategoryListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'sort_order' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'is_featured' => ['required', 'boolean'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
