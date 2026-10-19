<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class StorefrontSchemaFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_product_writes_remain_compatible_and_metadata_is_optional(): void
    {
        $products = Product::factory()->count(2)->create();
        foreach ($products as $product) {
            $this->assertNull($product->fresh()->slug);
            $this->assertNull($product->fresh()->short_description);
        }
        $this->assertTrue(Schema::hasColumn('product_images', 'alt_text'));
        $this->assertDatabaseCount('product_details', 0);
    }

    public function test_non_null_product_slugs_are_unique(): void
    {
        $products = Product::factory()->count(2)->create();
        DB::table('products')->where('id', $products[0]->id)->update(['slug' => 'synthetic-equipment']);
        $this->expectException(QueryException::class);
        DB::table('products')->where('id', $products[1]->id)->update(['slug' => 'synthetic-equipment']);
    }

    public function test_benefit_concepts_are_separate_and_default_to_unpublished(): void
    {
        $product = Product::factory()->create();
        foreach (['shop_benefits', 'why_choose_us', 'product_additional_benefits'] as $table) {
            $row = ['id' => (string) Str::uuid(), 'title' => 'Synthetic example: not a service promise'];
            if ($table === 'product_additional_benefits') {
                $row += ['product_id' => $product->id, 'benefit_type' => 'information'];
            }
            DB::table($table)->insert($row);
            $this->assertFalse((bool) DB::table($table)->value('is_active'));
            $this->assertDatabaseCount($table, 1);
        }
    }

    public function test_category_configuration_reuses_the_existing_attribute_master(): void
    {
        $category = Category::factory()->create();
        $attribute = Attribute::query()->create(['name' => 'Synthetic motor', 'slug' => 'synthetic-motor', 'data_type' => 'number']);
        $row = ['id' => (string) Str::uuid(), 'category_id' => $category->id, 'attribute_id' => $attribute->id];
        DB::table('category_specifications')->insert($row);
        $this->assertFalse((bool) DB::table('category_specifications')->value('is_required'));
        $this->assertFalse(Schema::hasTable('specification_definitions'));
        $this->expectException(QueryException::class);
        DB::table('category_specifications')->insert(array_replace($row, ['id' => (string) Str::uuid()]));
    }

    public function test_content_rejects_an_unknown_product(): void
    {
        $this->expectException(QueryException::class);
        DB::table('product_details')->insert([
            'id' => (string) Str::uuid(), 'product_id' => (string) Str::uuid(), 'title' => 'Synthetic', 'content' => 'Test',
        ]);
    }

    public function test_regulatory_record_is_one_per_product_and_soft_delete_preserves_it(): void
    {
        $product = Product::factory()->create();
        $row = ['id' => (string) Str::uuid(), 'product_id' => $product->id, 'model_number' => 'SYNTHETIC-ONLY'];
        DB::table('product_additional_details')->insert($row);
        $product->delete();
        $this->assertDatabaseHas('product_additional_details', $row);
        $this->expectException(QueryException::class);
        DB::table('product_additional_details')->insert(array_replace($row, ['id' => (string) Str::uuid()]));
    }
}
