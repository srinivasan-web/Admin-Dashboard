<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductImageTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Product images are explicit Product-to-Media attachments.
     */
    public function test_product_images_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('product_images'));
        $this->assertTrue(Schema::hasColumns('product_images', [
            'id', 'product_id', 'media_id', 'type', 'sort_order', 'is_primary',
            'primary_product_id', 'created_at', 'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('product_images', 'deleted_at'));
    }

    /**
     * Product and Media each own one-to-many ProductImage relations.
     */
    public function test_product_image_persists_uuid_relationships_and_ordering(): void
    {
        $productImage = ProductImage::factory()->create([
            'type' => 'gallery',
            'sort_order' => 2,
            'is_primary' => true,
        ]);

        $this->assertTrue(Str::isUuid($productImage->id));
        $this->assertTrue($productImage->is_primary);
        $this->assertSame($productImage->id, $productImage->product->images->sole()->id);
        $this->assertSame($productImage->id, $productImage->media->productImages->sole()->id);
    }

    /**
     * A media record cannot be attached to the same product twice.
     */
    public function test_product_media_pair_is_unique(): void
    {
        $product = Product::factory()->create();
        $media = Media::factory()->create();

        ProductImage::factory()->create([
            'product_id' => $product->id,
            'media_id' => $media->id,
        ]);

        $this->expectException(QueryException::class);

        ProductImage::factory()->create([
            'product_id' => $product->id,
            'media_id' => $media->id,
        ]);
    }

    /**
     * The generated unique key allows only one primary image per product.
     */
    public function test_product_has_at_most_one_primary_image(): void
    {
        $product = Product::factory()->create();

        ProductImage::factory()->create([
            'product_id' => $product->id,
            'is_primary' => true,
        ]);

        $this->expectException(QueryException::class);

        ProductImage::factory()->create([
            'product_id' => $product->id,
            'is_primary' => true,
        ]);
    }

    /**
     * Media cannot be removed while linked; a physical product delete removes links.
     */
    public function test_media_is_restricted_and_product_force_delete_cascades_images(): void
    {
        $productImage = ProductImage::factory()->create();

        try {
            $productImage->media->delete();
            $this->fail('Expected a referenced media deletion to fail.');
        } catch (QueryException) {
            $productImage->product->forceDelete();
        }

        $this->assertDatabaseMissing('product_images', ['id' => $productImage->id]);
        $this->assertDatabaseHas('media', ['id' => $productImage->media_id]);
    }
}
