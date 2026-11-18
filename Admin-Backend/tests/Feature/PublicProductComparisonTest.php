<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PublicProductComparisonTest extends TestCase
{
    use RefreshDatabase;

    private function availableProduct(array $fields = []): Product
    {
        $product = Product::factory()->create($fields);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 3, 'reserved_quantity' => 0]);

        return $product;
    }

    private function configure(Product $product, string $slug, array $fields = []): Attribute
    {
        $attribute = Attribute::query()->create([
            'name' => ucfirst($slug), 'slug' => $slug, 'data_type' => 'number',
            'unit' => 'kg', 'is_active' => true,
        ]);
        $product->category->specifications()->create(array_merge([
            'attribute_id' => $attribute->id, 'is_active' => true,
            'is_comparable' => true, 'sort_order' => 0,
        ], $fields));

        return $attribute;
    }

    public function test_empty_configuration_does_not_invent_comparison_rows(): void
    {
        $product = $this->availableProduct(['slug' => 'synthetic-comparison-product']);
        $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
            ->assertExactJson(['data' => ['attributes' => [], 'products' => []]]);
        $this->getJson('/api/v1/products/'.$product->slug.'/comparison')->assertOk()
            ->assertExactJson(['data' => ['attributes' => [], 'products' => []]]);
    }

    public function test_comparison_is_bounded_ordered_and_reads_saved_values_with_one_image_per_product(): void
    {
        $product = $this->availableProduct(['name' => 'Z Current', 'mrp_price' => '30000.00', 'sale_price' => '25000.00']);
        $later = $this->configure($product, 'weight', ['sort_order' => 2]);
        $first = $this->configure($product, 'flywheel', ['label' => 'Flywheel weight', 'sort_order' => 1]);
        $spec = $product->productAttributes()->create(['attribute_id' => $first->id, 'value' => '7']);
        $products = collect([$product]);
        for ($index = 0; $index < 5; $index++) {
            $products->push($this->availableProduct([
                'name' => 'Alternative '.$index, 'category_id' => $product->category_id,
                'product_type_id' => $product->product_type_id,
            ]));
        }
        $primaryIds = [];
        foreach ($products as $candidate) {
            ProductImage::factory()->create(['product_id' => $candidate->id, 'sort_order' => 0]);
            $primaryIds[$candidate->id] = ProductImage::factory()->create([
                'product_id' => $candidate->id, 'is_primary' => true, 'sort_order' => 2,
            ])->id;
        }

        DB::enableQueryLog();
        try {
            $response = $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
                ->assertJsonCount(4, 'data.products')
                ->assertJsonPath('data.products.0.id', $product->id)
                ->assertJsonPath('data.products.1.name', 'Alternative 0')
                ->assertJsonPath('data.products.0.price.sale', '25000.00')
                ->assertJsonPath('data.products.0.specifications.0.value', '7')
                ->assertJsonPath('data.attributes.0.name', 'Flywheel weight')
                ->assertJsonPath('data.attributes.1.id', $later->id);

            foreach ($response->json('data.products') as $candidate) {
                $this->assertCount(1, $candidate['images']);
                $this->assertSame($primaryIds[$candidate['id']], $candidate['images'][0]['id']);
                $this->assertArrayNotHasKey('description', $candidate);
                $this->assertArrayNotHasKey('inventory', $candidate);
            }
            $specQueries = collect(DB::getQueryLog())->filter(fn ($query) =>
                preg_match('/from ["`]?product_attributes["`]?\s/i', $query['query']));
            $this->assertCount(1, $specQueries, 'Specifications should be fetched once for all comparison products.');
        } finally {
            DB::disableQueryLog();
            DB::flushQueryLog();
        }

        $spec->update(['value' => '8']);
        $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
            ->assertJsonPath('data.products.0.specifications.0.value', '8');
    }

    public function test_comparison_excludes_unpublished_settings_invalid_values_and_ineligible_products(): void
    {
        $product = $this->availableProduct();
        $attribute = $this->configure($product, 'visible');
        $this->configure($product, 'draft', ['is_active' => false]);
        $this->configure($product, 'not-comparable', ['is_comparable' => false]);
        $inactive = $this->configure($product, 'inactive-definition');
        $inactive->update(['is_active' => false]);
        $product->productAttributes()->create(['attribute_id' => $attribute->id, 'value' => 'invalid numeric value']);

        $sameGroup = ['category_id' => $product->category_id, 'product_type_id' => $product->product_type_id];
        $this->availableProduct(array_merge($sameGroup, ['is_active' => false]));
        $reserved = $this->availableProduct($sameGroup);
        $reserved->warehouseStocks()->update(['reserved_quantity' => 3]);
        $deleted = $this->availableProduct($sameGroup);
        $deleted->delete();
        $this->availableProduct(['category_id' => $product->category_id]);
        $this->availableProduct(['product_type_id' => $product->product_type_id]);
        Product::factory()->create($sameGroup); // No warehouse stock.

        $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
            ->assertJsonCount(1, 'data.products')
            ->assertJsonCount(1, 'data.attributes')
            ->assertJsonPath('data.attributes.0.id', $attribute->id)
            ->assertJsonCount(0, 'data.products.0.specifications');
    }

    public function test_comparison_rejects_unavailable_source_products_and_invalid_ids(): void
    {
        $product = $this->availableProduct();
        $url = '/api/v1/products/'.$product->id.'/comparison';
        foreach ([$product, $product->category, $product->productType] as $record) {
            $record->update(['is_active' => false]);
            $this->getJson($url)->assertNotFound();
            $record->update(['is_active' => true]);
        }
        $product->warehouseStocks()->update(['reserved_quantity' => 3]);
        $this->getJson($url)->assertNotFound();
        $this->getJson('/api/v1/products/invalid/comparison')->assertNotFound();
        $this->getJson('/api/v1/products/00000000-0000-4000-8000-000000000001/comparison')->assertNotFound();
    }
}
