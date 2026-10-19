<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreCatalogMasterRequest extends FormRequest
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
            default => null,
        };

        $rules = [
            'name' => ['required', 'string', 'max:255', Rule::unique((string) $table, 'name')],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique((string) $table, 'slug')],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        if (in_array($table, ['categories', 'product_types'], true)) {
            $rules['image_media_id'] = ['nullable', 'uuid', Rule::exists('media', 'id')->where(fn ($query) => $query->where('mime_type', 'like', 'image/%'))];
            $rules['sort_order'] = ['sometimes', 'integer', 'min:0', 'max:4294967295'];
        }

        return $rules;
    }

    /** @return array<string, mixed> */
    public function attributes(): array
    {
        return ['slug' => 'URL slug'];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('name') && ! $this->filled('slug')) {
            $this->merge(['slug' => Str::slug($this->string('name')->toString())]);
        }
    }
}
