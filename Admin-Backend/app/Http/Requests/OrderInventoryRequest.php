<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OrderInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('order')) ?? false;
    }

    public function rules(): array
    {
        return ['warehouse_id' => [$this->isMethod('PUT') ? 'nullable' : 'prohibited', 'uuid', 'exists:warehouses,id']];
    }
}
