<?php

namespace Database\Seeders;

use App\Models\Media;
use App\Models\ProductType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ProductTypeArtworkSeeder extends Seeder
{
    /** Match existing product types only; do not create or rename catalog records. */
    private const ARTWORK = [
        'treadmills' => 'cat-treadmill.webp',
        'treadmill' => 'cat-treadmill.webp',
        'ellipticals' => 'cat-elleptical.webp',
        'elliptical' => 'cat-elleptical.webp',
        'spin-bikes' => 'cat-spin-bike.webp',
        'spin-bike' => 'cat-spin-bike.webp',
        'massagers' => 'cat-massager.webp',
        'massager' => 'cat-massager.webp',
        'accessories' => 'cat_accessory.webp',
        'accessory' => 'cat_accessory.webp',
        'combo-kits' => 'combo-kits.webp',
        'strength-machines' => 'abductor-machine.webp',
        'strength-machine' => 'abductor-machine.webp',
        'walkpads' => 'cat-walkpad.webp',
        'walkpad' => 'cat-walkpad.webp',
    ];

    public function run(): void
    {
        ProductType::query()
            ->whereNull('image_media_id')
            ->whereIn('slug', array_keys(self::ARTWORK))
            ->get()
            ->each(function (ProductType $type): void {
                $filename = self::ARTWORK[$type->slug];
                $source = base_path('../assets/'.$filename);
                if (! is_file($source)) {
                    throw new RuntimeException("Missing product type artwork: {$source}");
                }

                $path = 'product-types/'.$filename;
                $disk = Storage::disk('public');
                if (! $disk->exists($path)) {
                    $contents = file_get_contents($source);
                    if ($contents === false || ! $disk->put($path, $contents)) {
                        throw new RuntimeException("Unable to import product type artwork: {$filename}");
                    }
                }

                $media = Media::query()->firstOrCreate(
                    ['disk' => 'public', 'path' => $path],
                    ['original_filename' => $filename, 'mime_type' => 'image/webp', 'size_bytes' => filesize($source)],
                );
                $type->update(['image_media_id' => $media->id]);
            });
    }
}
