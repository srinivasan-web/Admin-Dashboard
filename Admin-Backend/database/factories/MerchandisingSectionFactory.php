<?php

namespace Database\Factories;

use App\Models\MerchandisingSection;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MerchandisingSection>
 */
class MerchandisingSectionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $name = fake()->words(3, true),
            'slug' => Str::slug($name).'-'.fake()->unique()->numerify('###'),
            'type' => 'featured_products',
            'sort_order' => 0,
            'is_active' => true,
        ];
    }
}
