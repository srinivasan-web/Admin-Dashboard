<?php

namespace App\Actions;

use App\Domain\Catalog\ProductDescription;
use App\Domain\Catalog\ProductEditToken;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\User;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;

class UpdateCatalogProduct
{
    /** @param array<string, mixed> $attributes */
    public function execute(Product $product, array $attributes, ?User $actor = null): Product
    {
        return DB::transaction(function () use ($product, $attributes, $actor): Product {
            $product = Product::query()->lockForUpdate()->findOrFail($product->getKey());
            if (isset($attributes['edit_token'])) {
                abort_unless(hash_equals(ProductEditToken::for($product), $attributes['edit_token']), 409, 'This product was changed by another administrator. Review the latest saved product before continuing.');
            }
            $effectiveAt = now();

            $this->replacePriceWhenChanged($product, 'mrp', $product->mrp_price, $attributes['mrp_price'], $effectiveAt, $actor);
            $this->replacePriceWhenChanged($product, 'sale', $product->sale_price, $attributes['sale_price'] ?? null, $effectiveAt, $actor);

            $product->fill([
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
                'slug' => array_key_exists('slug', $attributes) ? $attributes['slug'] : $product->slug,
                'short_description' => array_key_exists('short_description', $attributes) ? $attributes['short_description'] : $product->short_description,
            ]);
            $product->save();

            app(SaveProductContent::class)->execute($product, $attributes);

            return $product->load(['brand', 'category', 'productType', 'hsnCode', 'details', 'additionalDetails']);
        });
    }

    private function replacePriceWhenChanged(Product $product, string $priceType, ?string $currentAmount, ?string $newAmount, \DateTimeInterface $effectiveAt, ?User $actor): void
    {
        if ($currentAmount === $newAmount || ($currentAmount !== null && $newAmount !== null && BigDecimal::of($currentAmount)->isEqualTo($newAmount))) {
            return;
        }

        ProductPrice::query()
            ->whereBelongsTo($product)
            ->where('price_type', $priceType)
            ->whereNull('ends_at')
            ->update(['ends_at' => $effectiveAt]);

        if ($newAmount === null) {
            return;
        }

        $product->prices()->create([
            'price_type' => $priceType,
            'currency' => 'INR',
            'amount' => $newAmount,
            'effective_at' => $effectiveAt,
            'created_by' => $actor?->getKey(),
        ]);
    }
}
