<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProductEmiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'variant_id' => ['sometimes', 'nullable', 'uuid'],
            'plan_id' => [$this->isMethod('post') ? 'required' : 'sometimes', 'uuid'],
            // Explicitly reject caller-controlled financing terms.
            'principal' => ['prohibited'], 'price' => ['prohibited'],
            'annual_interest_rate' => ['prohibited'], 'tenure_months' => ['prohibited'],
            'mobile_number' => $this->routeIs('emi.enquiry') ? ['required', 'regex:/^[6-9][0-9]{9}$/D'] : ['prohibited'],
            'consent' => $this->routeIs('emi.enquiry') ? ['required', 'accepted'] : ['prohibited'],
            'idempotency_key' => $this->routeIs('emi.enquiry') ? ['sometimes', 'uuid'] : ['prohibited'],
        ];
    }
}
