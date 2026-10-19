<?php

namespace App\Actions;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

class DeleteCatalogProduct
{
    public function execute(Product $product): Product
    {
        return DB::transaction(function () use ($product): Product {
            $product = Product::query()->lockForUpdate()->findOrFail($product->getKey());
            $product->update(['is_active' => false]);
            $product->delete();

            return $product;
        });
    }
}
