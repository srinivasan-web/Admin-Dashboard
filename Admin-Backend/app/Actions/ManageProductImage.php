<?php

namespace App\Actions;

use App\Models\Media;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\RemoveMediaFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class ManageProductImage
{
    public function update(Product $product, ProductImage $image, array $attributes): void
    {
        DB::transaction(function () use ($product, $image, $attributes): void {
            Product::query()->lockForUpdate()->findOrFail($product->getKey());
            $image = $this->ownedImage($product, $image);
            if (($attributes['is_primary'] ?? false) === true) {
                $product->images()->where('is_primary', true)->update(['is_primary' => false]);
                $image->refresh();
            }
            $image->fill($attributes)->save();
        });
    }

    public function replace(Product $product, ProductImage $image, UploadedFile $file): void
    {
        $path = $file->store('products/'.$product->getKey(), 'public');
        if ($path === false) {
            throw new \RuntimeException('Replacement product image could not be stored.');
        }

        try {
            $oldMedia = DB::transaction(function () use ($product, $image, $file, $path): ?Media {
                DB::afterRollBack(fn () => app(RemoveMediaFile::class)->execute('public', $path));
                Product::query()->lockForUpdate()->findOrFail($product->getKey());
                $image = $this->ownedImage($product, $image);
                $oldMedia = Media::query()->lockForUpdate()->findOrFail($image->media_id);
                $media = Media::query()->create([
                    'disk' => 'public',
                    'path' => $path,
                    'original_filename' => $file->getClientOriginalName(),
                    'mime_type' => $file->getMimeType(),
                    'size_bytes' => $file->getSize(),
                ]);
                $image->update(['media_id' => $media->getKey()]);
                if ($oldMedia->isReferenced()) {
                    return null;
                }
                $oldMedia->delete();

                return $oldMedia;
            });
        } catch (Throwable $exception) {
            app(RemoveMediaFile::class)->execute('public', $path);
            throw $exception;
        }

        if ($oldMedia) {
            DB::afterCommit(fn () => app(RemoveMediaFile::class)->execute($oldMedia->disk, $oldMedia->path));
        }
    }

    public function delete(Product $product, ProductImage $image): void
    {
        $orphan = DB::transaction(function () use ($product, $image): ?Media {
            Product::query()->lockForUpdate()->findOrFail($product->getKey());
            $image = $this->ownedImage($product, $image);
            $wasPrimary = $image->is_primary;
            $media = Media::query()->lockForUpdate()->findOrFail($image->media_id);
            $image->delete();
            if ($wasPrimary) {
                $next = $product->images()->orderBy('sort_order')->orderBy('id')->first();
                $next?->update(['is_primary' => true]);
            }
            if ($media->isReferenced()) {
                return null;
            }
            $media->delete();

            return $media;
        });

        if ($orphan) {
            DB::afterCommit(fn () => app(RemoveMediaFile::class)->execute($orphan->disk, $orphan->path));
        }
    }

    private function ownedImage(Product $product, ProductImage $image): ProductImage
    {
        $owned = $product->images()->with('media')->lockForUpdate()->find($image->getKey());
        if (! $owned) {
            throw ValidationException::withMessages(['image' => 'Image does not belong to this product.']);
        }

        return $owned;
    }
}
