<?php

namespace App\Actions;

use App\Models\Product;
use App\Models\ProductAttribute;
use Illuminate\Support\Facades\DB;

class SaveProductSpecification
{
    public function execute(Product $product, array $data, ?ProductAttribute $specification = null): ProductAttribute
    {
        return DB::transaction(function () use ($product, $data, $specification): ProductAttribute {
            Product::query()->lockForUpdate()->findOrFail($product->id);
            if ($specification) {
                $specification = $product->productAttributes()->lockForUpdate()->findOrFail($specification->id);
                $specification->update($data);
            } else {
                $specification = $product->productAttributes()->create($data);
            }
            if (array_key_exists('show_on_top', $data)) {
                if ($data['show_on_top']) {
                    $product->highlights()->firstOrCreate(['product_attribute_id' => $specification->id], ['sort_order' => $specification->sort_order ?? 0, 'is_active' => true]);
                } else {
                    $product->highlights()->where('product_attribute_id', $specification->id)->delete();
                }
            }

            return $specification->load('attribute');
        });
    }
}
