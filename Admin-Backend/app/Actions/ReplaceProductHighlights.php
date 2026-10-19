<?php

namespace App\Actions;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReplaceProductHighlights
{
    public function execute(Product $product, array $items): void
    {
        DB::transaction(function () use ($product, $items): void {
            Product::query()->lockForUpdate()->findOrFail($product->id);
            $ids = array_column($items, 'product_attribute_id');
            if ($product->productAttributes()->whereIn('id', $ids)->count() !== count($ids)) {
                throw ValidationException::withMessages(['highlights' => ['Every highlight must reference a specification on this product.']]);
            }
            $product->highlights()->delete();
            $product->highlights()->createMany($items);
            $product->productAttributes()->whereNotIn('id', $ids)->update(['show_on_top' => false]);
            $product->productAttributes()->whereIn('id', $ids)->update(['show_on_top' => true]);
        });
    }
}
