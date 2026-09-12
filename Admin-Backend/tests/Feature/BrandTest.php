<?php

namespace Tests\Feature;

use App\Models\Brand;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class BrandTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Brands are UUID-backed reusable references with no lifecycle extensions.
     */
    public function test_brands_table_has_only_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('brands'));
        $this->assertTrue(Schema::hasColumns('brands', [
            'id',
            'name',
            'slug',
            'created_at',
            'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('brands', 'description'));
        $this->assertFalse(Schema::hasColumn('brands', 'logo_id'));
        $this->assertFalse(Schema::hasColumn('brands', 'is_active'));
        $this->assertFalse(Schema::hasColumn('brands', 'sort_order'));
        $this->assertFalse(Schema::hasColumn('brands', 'deleted_at'));
    }

    /**
     * Brand names and slugs are unique stable identifiers.
     */
    public function test_brands_can_be_created_with_unique_names_and_slugs(): void
    {
        $brand = Brand::factory()->create([
            'name' => 'Durafit 91',
            'slug' => 'durafit-91',
        ]);

        $this->assertTrue(Str::isUuid($brand->id));
        $this->assertDatabaseHas('brands', [
            'id' => $brand->id,
            'slug' => 'durafit-91',
        ]);

        $this->expectException(QueryException::class);

        Brand::factory()->create([
            'name' => 'Durafit 91',
            'slug' => 'other-brand',
        ]);
    }

    /**
     * A slug cannot identify more than one brand.
     */
    public function test_brand_slugs_are_unique(): void
    {
        Brand::factory()->create([
            'name' => 'Durafit 91',
            'slug' => 'durafit-91',
        ]);

        $this->expectException(QueryException::class);

        Brand::factory()->create([
            'name' => 'Durafit Pro',
            'slug' => 'durafit-91',
        ]);
    }
}
