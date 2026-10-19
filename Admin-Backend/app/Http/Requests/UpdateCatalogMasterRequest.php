<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateCatalogMasterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('catalog.manage') ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $table = match ($this->route('master')) {
            'brands' => 'brands',
            'product-types' => 'product_types',
            'categories' => 'categories',
        };
        $recordId = (string) $this->route('record');

        $rules = [
            'name' => ['required', 'string', 'max:255', Rule::unique($table, 'name')->ignore($recordId)],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique($table, 'slug')->ignore($recordId)],
            'description' => ['nullable', 'string'],
            'is_active' => ['required', 'boolean'],
        ];

        if (in_array($table, ['categories', 'product_types'], true)) {
            $rules['image_media_id'] = ['sometimes', 'nullable', 'uuid', Rule::exists('media', 'id')->where(fn ($query) => $query->where('mime_type', 'like', 'image/%'))];
            $rules['sort_order'] = ['sometimes', 'integer', 'min:0', 'max:4294967295'];
        }

        return $rules;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('name') && ! $this->filled('slug')) {
            $this->merge(['slug' => Str::slug($this->string('name')->toString())]);
        }
    }
}
