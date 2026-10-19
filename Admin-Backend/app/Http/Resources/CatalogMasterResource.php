<?php

namespace App\Http\Resources;

use App\Models\Category;
use App\Models\ProductType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Model */
class CatalogMasterResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->getKey(),
            'name' => $this->resource->name,
            'slug' => $this->resource->slug,
            'description' => $this->resource->description ?? null,
            'is_active' => $this->resource->is_active ?? true,
        ];

        if ($this->resource instanceof Category || $this->resource instanceof ProductType) {
            $media = $this->resource->relationLoaded('imageMedia') ? $this->resource->imageMedia : null;
            $data['sort_order'] = $this->resource->sort_order;
            $data['image_media_id'] = $this->resource->image_media_id;
            $data['image_url'] = $media ? Storage::disk($media->disk)->url($media->path) : null;
            if ($request->is('api/v1/admin/*')) {
                $data['image_media'] = $media ? (new MediaResource($media))->toArray($request) : null;
            }
        }

        return $data;
    }
}
