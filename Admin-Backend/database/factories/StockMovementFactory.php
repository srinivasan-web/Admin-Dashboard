<?php

namespace Database\Factories;

use App\Models\StockMovement;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMovement>
 */
class StockMovementFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'warehouse_stock_id' => WarehouseStock::factory(),
            'movement_type' => 'adjustment',
            'quantity_delta' => 1,
            'created_by' => User::factory(),
        ];
    }
}
