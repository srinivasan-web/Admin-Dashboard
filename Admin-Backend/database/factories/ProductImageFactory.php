<?php

namespace Database\Factories;

use App\Models\Media;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductImage>
 */
class ProductImageFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'media_id' => Media::factory(),
            'type' => 'gallery',
            'sort_order' => 0,
            'is_primary' => false,
        ];
    }
}
