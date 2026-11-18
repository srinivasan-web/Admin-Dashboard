<?php

namespace App\Http\Requests;

use App\Models\CategoryFaq;
use Illuminate\Foundation\Http\FormRequest;

class CategoryFaqRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post')
            ? ($this->user()?->can('create', CategoryFaq::class) ?? false)
            : ($this->user()?->can('update', $this->route('faq')) ?? false);
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'category_id' => ['sometimes', 'nullable', 'uuid', 'exists:categories,id'],
            'question' => [$required, 'string', 'min:5', 'max:255'],
            'answer' => [$required, 'string', 'min:2', 'max:10000'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
