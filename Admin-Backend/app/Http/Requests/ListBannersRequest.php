<?php

namespace App\Http\Requests;

use App\Models\Banner;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListBannersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Banner::class) ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'scheduling' => ['sometimes', Rule::in(['current', 'upcoming', 'expired', 'unscheduled'])],
            'sort_order' => ['sometimes', Rule::in(['asc', 'desc'])],
        ];
    }
}
