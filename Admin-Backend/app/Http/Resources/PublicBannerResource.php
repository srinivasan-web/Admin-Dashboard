<?php

namespace App\Http\Resources;

use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Banner */
class PublicBannerResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $url = trim((string) $this->redirect_url);
        $scheme = parse_url($url, PHP_URL_SCHEME);
        $safeUrl = in_array(strtolower((string) $scheme), ['http', 'https'], true) ? $url : null;

        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'product_type_id' => $this->product_type_id,
            'title' => $this->title,
            'description' => $this->description,
            'desktop_image_url' => Storage::disk($this->desktopMedia->disk)->url($this->desktopMedia->path),
            'mobile_image_url' => Storage::disk($this->mobileMedia->disk)->url($this->mobileMedia->path),
            'cta_text' => $this->cta_text,
            'cta_url' => $safeUrl,
            'display_order' => $this->sort_order,
            'status' => 'active',
            'start_at' => $this->start_at?->toIso8601String(),
            'end_at' => $this->end_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
