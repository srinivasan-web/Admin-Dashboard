<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('inventory.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'warehouse_id' => ['sometimes', 'nullable', 'uuid', 'exists:warehouses,id'],
            'product_id' => ['sometimes', 'nullable', 'uuid', 'exists:products,id'],
            'order' => ['sometimes', 'nullable', 'string', 'max:255'],
            'movement_type' => ['sometimes', 'nullable', Rule::in(['RESERVE', 'RELEASE', 'COMMIT', 'RESTORE', 'stock_in', 'stock_out', 'manual_set'])],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', ...($this->filled('date_from') ? ['after_or_equal:date_from'] : [])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'view' => ['sometimes', Rule::in(['matrix'])],
        ];
    }
}
