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

class AttachProductImage
{
    public function execute(Product $product, UploadedFile $image, string $type = 'gallery', int $sortOrder = 0, bool $isPrimary = false): ProductImage
    {
        if ($type === '360_frame' && $isPrimary) {
            throw ValidationException::withMessages(['is_primary' => 'A 360° frame cannot be the primary product image.']);
        }

        $path = $image->store('products/'.$product->getKey(), 'public');
        if ($path === false) {
            throw new \RuntimeException('Product image could not be stored.');
        }

        try {
            return DB::transaction(function () use ($product, $image, $type, $sortOrder, $isPrimary, $path): ProductImage {
                DB::afterRollBack(fn () => app(RemoveMediaFile::class)->execute('public', $path));
                Product::query()->lockForUpdate()->findOrFail($product->getKey());
                if ($isPrimary) {
                    $product->images()->where('is_primary', true)->update(['is_primary' => false]);
                }

                $media = Media::query()->create([
                    'disk' => 'public',
                    'path' => $path,
                    'original_filename' => $image->getClientOriginalName(),
                    'mime_type' => $image->getMimeType(),
                    'size_bytes' => $image->getSize(),
                ]);

                return $product->images()->create([
                    'media_id' => $media->getKey(),
                    'type' => $type,
                    'sort_order' => $sortOrder,
                    'is_primary' => $isPrimary,
                ])->load('media');
            });
        } catch (Throwable $exception) {
            app(RemoveMediaFile::class)->execute('public', $path);

            throw $exception;
        }
    }
}
