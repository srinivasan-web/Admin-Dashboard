<?php

namespace Tests\Feature;

use App\Models\ProductType;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductTypeTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Product types use the fields explicitly presented by the PDF form.
     */
    public function test_product_types_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('product_types'));
        $this->assertTrue(Schema::hasColumns('product_types', [
            'id',
            'name',
            'slug',
            'description',
            'is_active',
            'created_at',
            'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('product_types', 'sort_order'));
        $this->assertFalse(Schema::hasColumn('product_types', 'deleted_at'));
    }

    /**
     * Active is the default lifecycle state and master identifiers are unique.
     */
    public function test_product_types_default_to_active_with_unique_names_and_slugs(): void
    {
        $productType = ProductType::factory()->create([
            'name' => 'Treadmills',
            'slug' => 'treadmills',
            'description' => null,
        ]);

        $this->assertTrue(Str::isUuid($productType->id));
        $this->assertTrue($productType->is_active);
        $this->assertDatabaseHas('product_types', [
            'id' => $productType->id,
            'slug' => 'treadmills',
            'is_active' => true,
        ]);

        $this->expectException(QueryException::class);

        ProductType::factory()->create([
            'name' => 'Treadmills',
            'slug' => 'other-type',
        ]);
    }

    /**
     * A slug cannot identify more than one product type.
     */
    public function test_product_type_slugs_are_unique(): void
    {
        ProductType::factory()->create([
            'name' => 'Treadmills',
            'slug' => 'treadmills',
        ]);

        $this->expectException(QueryException::class);

        ProductType::factory()->create([
            'name' => 'Ellipticals',
            'slug' => 'treadmills',
        ]);
    }
}
