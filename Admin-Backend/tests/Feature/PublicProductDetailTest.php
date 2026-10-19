<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductImage;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PublicProductDetailTest extends TestCase
{
    use RefreshDatabase;

    public function test_detail_returns_related_persisted_data_without_requerying_catalog_masters(): void
    {
        $product = Product::factory()->create(['mrp_price' => '50000.00', 'sale_price' => '40000.00']);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 8, 'reserved_quantity' => 3]);
        $attribute = Attribute::query()->create(['name' => 'Motor', 'slug' => 'motor', 'data_type' => 'text', 'unit' => 'HP', 'is_active' => true]);
        $spec = ProductAttribute::query()->create(['product_id' => $product->id, 'attribute_id' => $attribute->id, 'value' => '3 Peak']);
        $product->highlights()->create(['product_attribute_id' => $spec->id, 'is_active' => true, 'sort_order' => 0]);
        $image = ProductImage::factory()->create(['product_id' => $product->id, 'is_primary' => true]);

        DB::enableQueryLog();
        try {
            $response = $this->getJson('/api/v1/products/'.$product->id)->assertOk()
                ->assertJsonPath('data.id', $product->id)
                ->assertJsonPath('data.brand.id', $product->brand_id)
                ->assertJsonPath('data.category.id', $product->category_id)
                ->assertJsonPath('data.product_type.id', $product->product_type_id)
                ->assertJsonPath('data.price.mrp', '50000.00')
                ->assertJsonPath('data.price.sale', '40000.00')
                ->assertJsonPath('data.available_stock', 5)
                ->assertJsonPath('data.images.0.id', $image->id)
                ->assertJsonPath('data.specifications.0.id', $spec->id)
                ->assertJsonPath('data.highlights.0.specification.id', $spec->id)
                ->assertJsonPath('data.highlights.0.specification.attribute.unit', 'HP');
            $queries = collect(DB::getQueryLog())->pluck('query');
            foreach (['brands', 'categories', 'product_types'] as $table) {
                $count = $queries->filter(fn (string $sql) => (bool) preg_match('/from ["`]?'.preg_quote($table, '/').'["`]?\s/i', $sql))->count();
                $this->assertSame(1, $count, "The detail endpoint should load {$table} once.");
            }
            $this->assertArrayNotHasKey('inventory', $response->json('data'));
            $this->assertArrayNotHasKey('edit_token', $response->json('data'));
        } finally {
            DB::disableQueryLog();
            DB::flushQueryLog();
        }

        $spec->update(['value' => '4 Peak']);
        $this->getJson('/api/v1/products/'.$product->id)->assertOk()
            ->assertJsonPath('data.specifications.0.value', '4 Peak')
            ->assertJsonPath('data.highlights.0.specification.value', '4 Peak');
    }

    public function test_unpublished_inactive_and_fully_reserved_products_are_not_exposed(): void
    {
        $product = Product::factory()->create();
        $stock = WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 3, 'reserved_quantity' => 0]);
        $url = '/api/v1/products/'.$product->id;
        $this->getJson($url)->assertOk();
        foreach ([$product, $product->category, $product->productType] as $record) {
            $record->update(['is_active' => false]);
            $this->getJson($url)->assertNotFound();
            $record->update(['is_active' => true]);
        }
        $stock->update(['reserved_quantity' => 3]);
        $this->getJson($url)->assertNotFound();
    }
}
