<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\HsnCode;
use App\Models\Product;
use App\Models\ProductType;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $brand = Brand::query()->first();
        $category = Category::query()->first();
        $productType = ProductType::query()->first();

        if ($brand === null || $category === null || $productType === null) {
            return;
        }

        Product::query()->firstOrCreate(
            ['sku' => 'SAMPLE-PRODUCT-001'],
            [
                'brand_id' => $brand->id,
                'category_id' => $category->id,
                'product_type_id' => $productType->id,
                'hsn_code_id' => HsnCode::query()->value('id'),
                'name' => 'Sample Product',
                'mrp_price' => '1000.00',
                'sale_price' => null,
                'sort_order' => 0,
                'is_active' => true,
                'is_trade_product' => false,
            ],
        );
    }
}
