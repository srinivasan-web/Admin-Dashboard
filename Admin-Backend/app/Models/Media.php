<?php

namespace App\Models;

use Database\Factories\MediaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['disk', 'path', 'original_filename', 'mime_type', 'size_bytes'])]
class Media extends Model
{
    /** @use HasFactory<MediaFactory> */
    use HasFactory, HasUuids;

    /** @return HasMany<ProductImage, $this> */
    public function productImages(): HasMany
    {
        return $this->hasMany(ProductImage::class);
    }

    public function isReferenced(): bool
    {
        return $this->productImages()->exists()
            || Category::query()->where('image_media_id', $this->id)->exists()
            || ProductType::query()->where('image_media_id', $this->id)->exists()
            || Banner::query()->where('desktop_media_id', $this->id)->orWhere('mobile_media_id', $this->id)->exists();
    }
}
