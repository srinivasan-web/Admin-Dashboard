<?php

namespace App\Http\Requests;

class UpdateComboRequest extends StoreComboRequest
{
    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'is_active' => ['required', 'boolean'],
        ];
    }
}
