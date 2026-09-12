<?php

namespace Database\Factories;

use App\Models\Media;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Media>
 */
class MediaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'disk' => 'public',
            'path' => 'media/'.fake()->uuid().'.jpg',
            'original_filename' => fake()->word().'.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => fake()->numberBetween(1_000, 5_000_000),
        ];
    }
}
