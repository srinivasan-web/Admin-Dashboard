<?php

namespace App\Actions;

use App\Domain\Catalog\ProductDescription;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreateCatalogProduct
{
    /** @param array<string, mixed> $attributes */
    public function execute(array $attributes, ?User $actor = null): Product
    {
        return DB::transaction(function () use ($attributes, $actor): Product {
            $product = Product::query()->create([
                'brand_id' => $attributes['brand_id'],
                'category_id' => $attributes['category_id'],
                'product_type_id' => $attributes['product_type_id'],
                'hsn_code_id' => $attributes['hsn_code_id'] ?? null,
                'name' => $attributes['name'],
                'group_name' => $attributes['group_name'] ?? null,
                'sku' => $attributes['sku'],
                'mrp_price' => $attributes['mrp_price'],
                'sale_price' => $attributes['sale_price'] ?? null,
                'tag' => $attributes['tag'] ?? null,
                'sort_order' => $attributes['sort_order'] ?? 0,
                'is_active' => $attributes['is_active'] ?? false,
                'is_trade_product' => $attributes['is_trade_product'] ?? false,
                'description' => ProductDescription::clean($attributes['description'] ?? null),
                'slug' => $attributes['slug'] ?? null,
                'short_description' => $attributes['short_description'] ?? null,
            ]);

            app(SaveProductContent::class)->execute($product, $attributes);

            $effectiveAt = now();
            $product->prices()->create([
                'price_type' => 'mrp',
                'currency' => 'INR',
                'amount' => $attributes['mrp_price'],
                'effective_at' => $effectiveAt,
                'created_by' => $actor?->getKey(),
            ]);

            if (($attributes['sale_price'] ?? null) !== null) {
                $product->prices()->create([
                    'price_type' => 'sale',
                    'currency' => 'INR',
                    'amount' => $attributes['sale_price'],
                    'effective_at' => $effectiveAt,
                    'created_by' => $actor?->getKey(),
                ]);
            }

            return $product->load(['brand', 'category', 'productType', 'hsnCode', 'details', 'additionalDetails']);
        });
    }
}
