<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SetWarehouseStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('inventory.manage') ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'include_history' => ['sometimes', 'boolean'],
            'history_page' => ['sometimes', 'integer', 'min:1'],
            'history_per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'idempotency_key' => ['sometimes', 'uuid'],
            'operation' => ['sometimes', 'string', 'in:adjustment,stock_in,stock_out'],
            'quantity' => [
                'required',
                'integer',
                'max:1000000',
                Rule::when(
                    in_array($this->input('operation'), ['stock_in', 'stock_out'], true),
                    ['min:1'],
                    ['min:0'],
                ),
            ],
        ];
    }
}
