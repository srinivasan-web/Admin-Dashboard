<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreHsnCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'hsn_code' => ['nullable', 'string', 'max:255', Rule::unique('hsn_codes', 'hsn_code')],
            'sgst_tax_multiplier' => ['nullable', 'decimal:0,2', 'min:0', 'max:100'],
            'igst_tax_multiplier' => ['nullable', 'decimal:0,2', 'min:0', 'max:100'],
        ];
    }
}
