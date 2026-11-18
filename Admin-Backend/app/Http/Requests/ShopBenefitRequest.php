<?php

namespace App\Http\Requests;

use App\Models\ShopBenefit;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ShopBenefitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post')
            ? ($this->user()?->can('create', ShopBenefit::class) ?? false)
            : ($this->user()?->can('update', $this->route('benefit')) ?? false);
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'min:2', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'icon_media_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('media', 'id')
                ->where(fn (Builder $query) => $query->where('mime_type', 'like', 'image/%'))],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
