<?php

namespace App\Http\Requests;

use App\Models\Banner;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post')
            ? ($this->user()?->can('create', Banner::class) ?? false)
            : ($this->user()?->can('update', $this->route('banner')) ?? false);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $imageMedia = Rule::exists('media', 'id')
            ->where(fn (Builder $query) => $query->where('mime_type', 'like', 'image/%'));

        return [
            'title' => [$required, 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'cta_text' => ['sometimes', 'nullable', 'string', 'max:120'],
            'desktop_media_id' => [$required, 'uuid', $imageMedia],
            'mobile_media_id' => [$required, 'uuid', $imageMedia],
            'page' => ['sometimes', 'nullable', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'redirect_url' => ['sometimes', 'nullable', 'url:http,https', 'max:2048'],
            'start_at' => ['sometimes', 'nullable', 'date'],
            'end_at' => ['sometimes', 'nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $banner = $this->route('banner');
            $start = $this->exists('start_at') ? $this->input('start_at') : $banner?->start_at;
            $end = $this->exists('end_at') ? $this->input('end_at') : $banner?->end_at;

            if ($start && $end && Carbon::parse($end)->lt(Carbon::parse($start))) {
                $validator->errors()->add('end_at', 'The end date must be after or equal to the start date.');
            }
        });
    }
}
