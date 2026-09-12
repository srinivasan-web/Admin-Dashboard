<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductVariantTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Variants keep only the Product, label, value, and SKU fields shown by the PDF.
     */
    public function test_product_variants_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('product_variants'));
        $this->assertTrue(Schema::hasColumns('product_variants', [
            'id', 'product_id', 'label', 'value', 'sku',
            'created_at', 'updated_at', 'deleted_at',
        ]));
        $this->assertFalse(Schema::hasColumn('product_variants', 'price'));
        $this->assertFalse(Schema::hasColumn('product_variants', 'sale_price'));
        $this->assertFalse(Schema::hasColumn('product_variants', 'is_active'));
        $this->assertFalse(Schema::hasColumn('product_variants', 'stock'));
    }

    /**
     * Product and ProductVariant expose the approved one-to-many relationship.
     */
    public function test_product_variant_persists_uuid_identity_and_product_relationship(): void
    {
        $variant = ProductVariant::factory()->create([
            'label' => 'Color',
            'value' => 'Black',
            'sku' => 'TREAD-BLK',
        ]);

        $this->assertTrue(Str::isUuid($variant->id));
        $this->assertSame($variant->product_id, $variant->product->id);
        $this->assertSame($variant->id, $variant->product->variants->sole()->id);
    }

    /**
     * A Product cannot repeat the same label/value pair.
     */
    public function test_variant_sku_and_product_attribute_pair_are_unique(): void
    {
        $product = Product::factory()->create();

        ProductVariant::factory()->create([
            'product_id' => $product->id,
            'label' => 'Color',
            'value' => 'Black',
            'sku' => 'TREAD-BLK',
        ]);

        $this->expectException(QueryException::class);

        ProductVariant::factory()->create([
            'product_id' => $product->id,
            'label' => 'Color',
            'value' => 'Black',
            'sku' => 'TREAD-OTHER',
        ]);
    }

    /**
     * Variant SKUs are unique among variants.
     */
    public function test_variant_skus_are_unique(): void
    {
        ProductVariant::factory()->create([
            'label' => 'Color',
            'value' => 'Black',
            'sku' => 'TREAD-BLK',
        ]);

        $this->expectException(QueryException::class);

        ProductVariant::factory()->create([
            'label' => 'Size',
            'value' => 'Large',
            'sku' => 'TREAD-BLK',
        ]);
    }

    /**
     * Variants preserve historical identity until their Product is physically removed.
     */
    public function test_variant_soft_deletes_and_product_force_delete_cascades(): void
    {
        $variant = ProductVariant::factory()->create();

        $variant->delete();

        $this->assertSoftDeleted('product_variants', ['id' => $variant->id]);

        $variant->product->forceDelete();

        $this->assertDatabaseMissing('product_variants', ['id' => $variant->id]);
    }
}
