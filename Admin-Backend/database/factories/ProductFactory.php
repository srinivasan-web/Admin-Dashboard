<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Category;
use App\Models\HsnCode;
use App\Models\Product;
use App\Models\ProductType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'category_id' => Category::factory(),
            'product_type_id' => ProductType::factory(),
            'hsn_code_id' => HsnCode::factory(),
            'name' => fake()->words(3, true),
            'group_name' => fake()->optional()->words(2, true),
            'sku' => fake()->unique()->bothify('SKU-########'),
            'mrp_price' => fake()->numberBetween(1000, 100000).'.00',
            'sale_price' => fake()->boolean() ? fake()->numberBetween(500, 99999).'.00' : null,
            'tag' => fake()->optional()->word(),
            'sort_order' => 0,
            'is_active' => true,
            'is_trade_product' => false,
            'description' => fake()->optional()->paragraph(),
        ];
    }
}
