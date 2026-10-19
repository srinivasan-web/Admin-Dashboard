<?php

namespace App\Http\Resources;

use App\Models\Banner;
use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Banner */
class BannerResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'cta_text' => $this->cta_text,
            'desktop_media_id' => $this->desktop_media_id,
            'mobile_media_id' => $this->mobile_media_id,
            'desktop_media' => $this->whenLoaded('desktopMedia', fn (): array => $this->mediaData($this->desktopMedia)),
            'mobile_media' => $this->whenLoaded('mobileMedia', fn (): array => $this->mediaData($this->mobileMedia)),
            'page' => $this->page,
            'sort_order' => $this->sort_order,
            'redirect_url' => $this->redirect_url,
            'start_at' => $this->start_at?->toIso8601String(),
            'end_at' => $this->end_at?->toIso8601String(),
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /** @return array{id: string, url: string, mime_type: ?string} */
    private function mediaData(Media $media): array
    {
        return [
            'id' => $media->id,
            'url' => Storage::disk($media->disk)->url($media->path),
            'mime_type' => $media->mime_type,
        ];
    }
}
