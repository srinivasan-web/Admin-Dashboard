<?php

namespace App\Http\Requests;

use App\Domain\Orders\OrderStateRules;
use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderPaymentStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('order');

        return $order instanceof Order && ($this->user()?->can('update', $order) ?? false);
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(OrderStateRules::statuses('payment'))],
        ];
    }
}
