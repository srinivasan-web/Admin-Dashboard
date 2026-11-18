<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ShopBenefitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'sort_order' => $this->sort_order,
            'is_active' => $this->when($request->is('api/v1/admin/*'), $this->is_active),
            'icon_media_id' => $this->when($request->is('api/v1/admin/*'), $this->icon_media_id),
            'icon_url' => $this->iconMedia
                ? Storage::disk($this->iconMedia->disk)->url($this->iconMedia->path)
                : null,
        ];
    }
}
