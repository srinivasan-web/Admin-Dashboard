<?php

namespace Database\Factories;

use App\Models\HsnCode;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HsnCode>
 */
class HsnCodeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->words(3, true),
            'type' => fake()->optional()->word(),
            'hsn_code' => fake()->unique()->numerify('######'),
            'sgst_tax_multiplier' => '9.00',
            'igst_tax_multiplier' => '18.00',
        ];
    }
}
