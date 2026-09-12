<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductType;
use Database\Seeders\ProductSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Products include only PDF-supported attributes and the approved support fields.
     */
    public function test_products_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('products'));
        $this->assertTrue(Schema::hasColumns('products', [
            'id', 'brand_id', 'category_id', 'product_type_id', 'hsn_code_id',
            'name', 'group_name', 'sku', 'mrp_price', 'sale_price', 'tag',
            'sort_order', 'is_active', 'is_trade_product', 'description',
            'created_at', 'updated_at', 'deleted_at',
        ]));
        $this->assertFalse(Schema::hasColumn('products', 'slug'));
        $this->assertFalse(Schema::hasColumn('products', 'cost_price'));
        $this->assertFalse(Schema::hasColumn('products', 'tax_rate'));
    }

    /**
     * Products retain UUID identity, catalog relationships, and exact money values.
     */
    public function test_product_persists_catalog_relationships_and_money_values(): void
    {
        $product = Product::factory()->create([
            'sku' => 'TREAD-001',
            'mrp_price' => '49999.00',
            'sale_price' => '44999.00',
        ]);

        $this->assertTrue(Str::isUuid($product->id));
        $this->assertSame('49999.00', $product->mrp_price);
        $this->assertSame('44999.00', $product->sale_price);
        $this->assertNotNull($product->brand);
        $this->assertNotNull($product->category);
        $this->assertNotNull($product->productType);
        $this->assertNotNull($product->hsnCode);
        $this->assertTrue($product->is_active);
        $this->assertFalse($product->is_trade_product);
    }

    /**
     * SKU is the unique product identifier exposed by the PDF.
     */
    public function test_skus_are_unique(): void
    {
        Product::factory()->create(['sku' => 'TREAD-001']);

        $this->expectException(QueryException::class);

        Product::factory()->create(['sku' => 'TREAD-001']);
    }

    /**
     * Products are soft deleted to preserve their identity for future historical domains.
     */
    public function test_product_uses_soft_deletes(): void
    {
        $product = Product::factory()->create();

        $product->delete();

        $this->assertSoftDeleted('products', ['id' => $product->id]);
    }

    /**
     * A referenced catalog master cannot be deleted while it owns a product.
     */
    public function test_referenced_catalog_master_cannot_be_deleted(): void
    {
        $product = Product::factory()->create();

        $this->expectException(QueryException::class);

        $product->brand->delete();
    }

    /**
     * The standalone seeder creates its sample only when its required masters exist.
     */
    public function test_product_seeder_creates_a_sample_product_from_existing_masters(): void
    {
        Brand::factory()->create();
        Category::factory()->create();
        ProductType::factory()->create();

        $this->seed(ProductSeeder::class);

        $this->assertDatabaseHas('products', ['sku' => 'SAMPLE-PRODUCT-001']);
    }

    /**
     * The Product migration can drop and recreate its own table after masters exist.
     */
    public function test_product_migration_can_be_rolled_back_and_reapplied(): void
    {
        $migration = require database_path('migrations/2026_09_12_204000_create_products_table.php');

        $migration->down();

        $this->assertFalse(Schema::hasTable('products'));

        $migration->up();

        $this->assertTrue(Schema::hasTable('products'));
    }
}
