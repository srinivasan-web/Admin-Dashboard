<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ListProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'product_type_id' => ['sometimes', 'nullable', 'uuid'],
            'category_id' => ['sometimes', 'nullable', 'uuid'],
            'hsn_code_id' => ['sometimes', 'nullable', 'uuid'],
            'status' => ['sometimes', 'in:all,active,inactive'],
            'stock' => ['sometimes', 'in:all,in-stock,out-of-stock'],
            'sort' => ['sometimes', 'in:newest,name,price_asc,price_desc'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
