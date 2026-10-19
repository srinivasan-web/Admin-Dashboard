<?php

namespace App\Http\Requests;

use App\Domain\Orders\OrderStateRules;
use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('order');

        return $order instanceof Order && ($this->user()?->can('update', $order) ?? false);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $statuses = OrderStateRules::statuses('order');

        return [
            'current_status' => ['required', Rule::in($statuses)],
            'status' => ['required', Rule::in($statuses)],
        ];
    }
}
