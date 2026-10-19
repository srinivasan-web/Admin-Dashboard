<?php

namespace App\Actions;

use App\Domain\Catalog\ProductDescription;
use App\Models\Product;
use Illuminate\Validation\ValidationException;

/** Called inside the existing product create/update transaction. */
class SaveProductContent
{
    /** @param array<string, mixed> $attributes */
    public function execute(Product $product, array $attributes): void
    {
        if (array_key_exists('details', $attributes)) {
            $keep = [];
            foreach ($attributes['details'] as $detail) {
                if (! empty($detail['id'])) {
                    $existing = $product->details()->whereKey($detail['id'])->first();
                    if (! $existing) {
                        throw ValidationException::withMessages(['details' => 'A detail section does not belong to this product.']);
                    }
                } else {
                    $existing = $product->details()->make();
                }
                $existing->fill([
                    'title' => trim($detail['title']),
                    'content' => ProductDescription::clean($detail['content']),
                    'sort_order' => $detail['sort_order'] ?? 0,
                    'is_active' => $detail['is_active'] ?? false,
                ])->save();
                $keep[] = $existing->getKey();
            }
            $product->details()->whereNotIn('id', $keep)->delete();
        }

        if (array_key_exists('additional_details', $attributes)) {
            $values = [];
            foreach (['generic_name', 'model_number', 'net_quantity', 'country_of_origin', 'manufactured_by', 'marketed_by', 'consumer_complaints'] as $field) {
                $values[$field] = $attributes['additional_details'][$field] ?? null;
            }
            if (count(array_filter($values, fn ($value) => $value !== null && trim((string) $value) !== '')) > 0 || $product->additionalDetails()->exists()) {
                $product->additionalDetails()->updateOrCreate(['product_id' => $product->getKey()], $values);
            }
        }
    }
}
