<?php

namespace App\Actions;

use App\Models\Combo;
use Illuminate\Support\Facades\DB;

class SaveCombo
{
    /** @param array{name: string, is_active?: bool, items?: list<array{product_id: string, quantity: int}>} $attributes */
    public function execute(array $attributes, ?Combo $combo = null): Combo
    {
        return DB::transaction(function () use ($attributes, $combo): Combo {
            $combo ??= new Combo;
            $combo->fill([
                'name' => $attributes['name'],
                'is_active' => $attributes['is_active'] ?? true,
            ]);
            $combo->save();

            if (array_key_exists('items', $attributes)) {
                $items = collect($attributes['items'])->mapWithKeys(
                    fn (array $item): array => [$item['product_id'] => ['quantity' => $item['quantity']]],
                )->all();
                $combo->products()->sync($items);
            }

            return $combo->load('products:id,name,sku');
        });
    }
}
