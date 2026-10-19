<?php

namespace App\Http\Requests;

use App\Domain\Catalog\SpecificationValue;
use App\Models\Attribute;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class PublicProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['nullable', 'uuid'],
            'product_type_id' => ['nullable', 'uuid'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:name,price_asc,price_desc'],
            'min_price' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'max_price' => ['nullable', 'numeric', 'min:0', 'max:99999999.99', 'gte:min_price'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'attributes' => ['sometimes', 'array', 'max:20'],
            'attributes.*' => ['array', 'min:1', 'max:20'],
            'attributes.*.*' => ['required', 'string', 'max:1000'],
        ];
    }

    public function after(): array
    {
        return [function ($validator): void {
            if ($validator->errors()->any()) {
                return;
            }
            $filters = $this->input('attributes', []);
            $ids = array_keys($filters);
            foreach ($ids as $id) {
                if (! Str::isUuid($id)) {
                    $validator->errors()->add('attributes', 'Select valid attribute filters.');

                    return;
                }
            }
            $definitions = Attribute::query()->whereIn('id', $ids)->where('is_active', true)->where('is_filterable', true)->get()->keyBy('id');
            foreach ($filters as $id => $values) {
                $attribute = $definitions->get($id);
                if (! $attribute) {
                    $validator->errors()->add('attributes', 'A selected attribute is no longer available for filtering.');

                    continue;
                }
                foreach ($values as $value) {
                    if (! SpecificationValue::valid($attribute->data_type, $value)) {
                        $validator->errors()->add('attributes', 'Select a valid '.$attribute->name.' value.');
                    }
                }
            }
        }];
    }
}
