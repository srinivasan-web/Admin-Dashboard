<?php

namespace App\Domain\Catalog;

use App\Models\Product;

final class ProductEditToken
{
    // An optimistic token for core product fields. No schema change or clock
    // precision dependency; dependent requests remain separate transactions.
    public static function for(Product $product): string
    {
        $values = $product->only($product->getFillable());
        $values['sort_order'] = (int) $product->sort_order;
        ksort($values);

        return hash('sha256', json_encode($values, JSON_THROW_ON_ERROR));
    }
}
