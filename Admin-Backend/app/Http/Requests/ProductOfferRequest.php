<?php

namespace App\Http\Requests;

use App\Models\ProductOffer;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ProductOfferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post')
            ? ($this->user()?->can('create', ProductOffer::class) ?? false)
            : ($this->user()?->can('update', $this->route('offer')) ?? false);
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $id = $this->route('offer')?->id;

        return [
            'scope_type' => [$required, Rule::in(['product', 'category', 'product_type'])],
            'product_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('products', 'id')
                ->where(fn (Builder $query) => $query->whereNull('deleted_at'))],
            'category_id' => ['sometimes', 'nullable', 'uuid', 'exists:categories,id'],
            'product_type_id' => ['sometimes', 'nullable', 'uuid', 'exists:product_types,id'],
            'title' => [$required, 'string', 'min:2', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'offer_type' => [$required, Rule::in(['coupon', 'promotion'])],
            'coupon_code' => ['sometimes', 'nullable', 'string', 'min:3', 'max:80', 'regex:/^[A-Z0-9][A-Z0-9_-]*$/',
                Rule::unique('product_offers', 'coupon_code')->ignore($id)],
            'discount_type' => ['sometimes', 'nullable', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['sometimes', 'nullable', 'numeric', 'gt:0', 'max:9999999999.99'],
            'maximum_discount' => ['sometimes', 'nullable', 'numeric', 'gt:0', 'max:9999999999.99'],
            'minimum_order_amount' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'ends_at' => ['sometimes', 'nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $offer = $this->route('offer');
            $value = fn (string $key) => $this->exists($key) ? $this->input($key) : $offer?->$key;
            $scope = $value('scope_type');
            $targets = ['product' => 'product_id', 'category' => 'category_id', 'product_type' => 'product_type_id'];
            foreach ($targets as $kind => $field) {
                if ($kind === $scope && ! $value($field)) {
                    $validator->errors()->add($field, 'Select the target for this offer scope.');
                } elseif ($kind !== $scope && $value($field)) {
                    $validator->errors()->add($field, 'Only the selected offer-scope target may be set.');
                }
            }

            $code = $value('coupon_code');
            if ($value('offer_type') === 'coupon' && ! $code) {
                $validator->errors()->add('coupon_code', 'A coupon offer requires a code.');
            } elseif ($value('offer_type') === 'promotion' && $code) {
                $validator->errors()->add('coupon_code', 'A promotion without a coupon cannot have a code.');
            }

            $type = $value('discount_type');
            $amount = $value('discount_value');
            if (($type === null) !== ($amount === null)) {
                $validator->errors()->add('discount_value', 'Provide both a discount type and value, or neither.');
            }
            if ($type === 'percent' && $amount !== null && (float) $amount > 100) {
                $validator->errors()->add('discount_value', 'A percentage discount cannot exceed 100.');
            }
            if ($value('maximum_discount') !== null && $type !== 'percent') {
                $validator->errors()->add('maximum_discount', 'A maximum discount applies only to percentage offers.');
            }

            $start = $value('starts_at');
            $end = $value('ends_at');
            if ($start && $end && Carbon::parse($end)->lt(Carbon::parse($start))) {
                $validator->errors()->add('ends_at', 'The end date must be after or equal to the start date.');
            }
        });
    }

    protected function prepareForValidation(): void
    {
        if ($this->exists('coupon_code')) {
            $this->merge(['coupon_code' => ($code = Str::upper(trim((string) $this->input('coupon_code')))) !== '' ? $code : null]);
        }
    }
}
