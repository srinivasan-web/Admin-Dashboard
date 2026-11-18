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
            foreach (['brands', 'categories', 'product_types', 'product_attributes'] as $table) {
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

    public function test_product_detail_reads_only_active_persisted_benefits_in_display_order(): void
    {
        $product = Product::factory()->create();
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
        $later = $product->benefits()->create([
            'title' => 'Stored benefit B', 'benefit_type' => 'information',
            'description' => 'Stored description B', 'sort_order' => 2, 'is_active' => true,
        ]);
        $first = $product->benefits()->create([
            'title' => 'Stored benefit A', 'benefit_type' => 'information',
            'sort_order' => 1, 'is_active' => true,
        ]);
        $product->benefits()->create([
            'title' => 'Unpublished benefit', 'benefit_type' => 'information',
            'sort_order' => 0, 'is_active' => false,
        ]);

        $this->getJson('/api/v1/products/'.$product->id)
            ->assertOk()
            ->assertJsonCount(2, 'data.benefits')
            ->assertJsonPath('data.benefits.0.id', $first->id)
            ->assertJsonPath('data.benefits.1.id', $later->id)
            ->assertJsonPath('data.benefits.1.description', 'Stored description B');
    }

    public function test_detail_orders_gallery_and_published_content_and_returns_stored_compliance(): void
    {
        $product = Product::factory()->create(['short_description' => 'Stored product summary']);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
        $later = ProductImage::factory()->create(['product_id' => $product->id, 'sort_order' => 2]);
        $first = ProductImage::factory()->create(['product_id' => $product->id, 'sort_order' => 1, 'alt_text' => 'Stored image description']);
        $product->details()->create(['title' => 'Later section', 'content' => 'Stored content', 'sort_order' => 2, 'is_active' => true]);
        $product->details()->create(['title' => 'First section', 'content' => 'Stored introduction', 'sort_order' => 1, 'is_active' => true]);
        $product->details()->create(['title' => 'Draft section', 'content' => 'Not public', 'sort_order' => 0, 'is_active' => false]);
        $product->additionalDetails()->create(['model_number' => 'TEST-MODEL', 'country_of_origin' => 'Stored origin']);

        $this->getJson('/api/v1/products/'.$product->id)->assertOk()
            ->assertJsonPath('data.short_description', 'Stored product summary')
            ->assertJsonPath('data.images.0.id', $first->id)
            ->assertJsonPath('data.images.0.alt_text', 'Stored image description')
            ->assertJsonPath('data.images.1.id', $later->id)
            ->assertJsonCount(2, 'data.details')
            ->assertJsonPath('data.details.0.title', 'First section')
            ->assertJsonPath('data.details.1.title', 'Later section')
            ->assertJsonPath('data.additional_details.model_number', 'TEST-MODEL')
            ->assertJsonPath('data.additional_details.country_of_origin', 'Stored origin')
            ->assertJsonCount(0, 'data.benefits');
    }

    public function test_detail_excludes_inactive_definitions_and_invalid_values_from_specs_and_highlights(): void
    {
        $product = Product::factory()->create();
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
        foreach ([['is_active' => false, 'value' => '12'], ['is_active' => true, 'value' => 'not a number']] as $index => $data) {
            $attribute = Attribute::query()->create([
                'name' => 'Specification '.$index, 'slug' => 'specification-'.$index,
                'data_type' => 'number', 'is_active' => $data['is_active'],
            ]);
            $spec = $product->productAttributes()->create(['attribute_id' => $attribute->id, 'value' => $data['value']]);
            $product->highlights()->create(['product_attribute_id' => $spec->id, 'is_active' => true]);
        }

        $this->getJson('/api/v1/products/'.$product->id)->assertOk()
            ->assertJsonCount(0, 'data.specifications')
            ->assertJsonCount(0, 'data.highlights');
    }

    public function test_invalid_missing_and_deleted_products_return_the_existing_not_found_contract(): void
    {
        $product = Product::factory()->create();
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
        $product->delete();

        foreach (['not-a-product-id', '00000000-0000-4000-8000-000000000001', $product->id] as $id) {
            $this->getJson('/api/v1/products/'.$id)->assertNotFound()
                ->assertJsonPath('error.code', 'resource.not_found');
        }
    }

    public function test_published_product_slug_and_uuid_return_the_same_persisted_detail(): void
    {
        $product = Product::factory()->create([
            'name' => 'Synthetic Cross Trainer',
            'slug' => 'synthetic-cross-trainer',
            'mrp_price' => '34999.00',
            'sale_price' => '15639.00',
        ]);
        WarehouseStock::factory()->create([
            'product_id' => $product->id, 'quantity' => 7, 'reserved_quantity' => 2,
        ]);

        foreach ([$product->id, $product->slug] as $identifier) {
            $response = $this->getJson('/api/v1/products/'.$identifier)->assertOk()
                ->assertJsonPath('data.id', $product->id)
                ->assertJsonPath('data.name', 'Synthetic Cross Trainer')
                ->assertJsonPath('data.price.mrp', '34999.00')
                ->assertJsonPath('data.price.sale', '15639.00')
                ->assertJsonPath('data.available_stock', 5)
                ->assertJsonCount(0, 'data.images')
                ->assertJsonCount(0, 'data.specifications')
                ->assertJsonCount(0, 'data.highlights')
                ->assertJsonCount(0, 'data.details')
                ->assertJsonCount(0, 'data.benefits')
                ->assertJsonPath('data.additional_details', null);
            $this->assertArrayNotHasKey('inventory', $response->json('data'));
            $this->assertArrayNotHasKey('edit_token', $response->json('data'));
        }
        $this->getJson('/api/v1/admin/products/'.$product->id)->assertUnauthorized();
    }

    public function test_unknown_invalid_and_unpublished_slugs_are_not_exposed(): void
    {
        $product = Product::factory()->create(['slug' => 'hidden-cross-trainer', 'is_active' => false]);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);

        foreach (['hidden-cross-trainer', 'unknown-cross-trainer', 'NOT-A-SLUG', 'invalid%20slug'] as $identifier) {
            $this->getJson('/api/v1/products/'.$identifier)->assertNotFound()
                ->assertJsonPath('error.code', 'resource.not_found');
        }

        $product->update(['is_active' => true]);
        $product->category->update(['is_active' => false]);
        $this->getJson('/api/v1/products/'.$product->slug)->assertNotFound();
        $product->category->update(['is_active' => true]);
        $product->productType->update(['is_active' => false]);
        $this->getJson('/api/v1/products/'.$product->slug)->assertNotFound();
        $product->productType->update(['is_active' => true]);
        $product->warehouseStocks()->update(['reserved_quantity' => 2]);
        $this->getJson('/api/v1/products/'.$product->slug)->assertNotFound();
    }
}
