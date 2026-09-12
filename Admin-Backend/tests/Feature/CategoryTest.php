<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class CategoryTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Categories use only fields presented by the PDF form and remain flat.
     */
    public function test_categories_table_has_the_approved_flat_catalog_columns(): void
    {
        $this->assertTrue(Schema::hasTable('categories'));
        $this->assertTrue(Schema::hasColumns('categories', [
            'id',
            'name',
            'slug',
            'image_path',
            'description',
            'is_active',
            'created_at',
            'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('categories', 'parent_id'));
        $this->assertFalse(Schema::hasColumn('categories', 'sort_order'));
        $this->assertFalse(Schema::hasColumn('categories', 'deleted_at'));
    }

    /**
     * Active is the default lifecycle state and category identifiers are unique.
     */
    public function test_categories_default_to_active_with_unique_names_and_slugs(): void
    {
        $category = Category::factory()->create([
            'name' => 'Treadmills',
            'slug' => 'treadmills',
            'image_path' => null,
            'description' => null,
        ]);

        $this->assertTrue(Str::isUuid($category->id));
        $this->assertTrue($category->is_active);
        $this->assertDatabaseHas('categories', [
            'id' => $category->id,
            'slug' => 'treadmills',
            'is_active' => true,
        ]);

        $this->expectException(QueryException::class);

        Category::factory()->create([
            'name' => 'Treadmills',
            'slug' => 'fitness-treadmills',
        ]);
    }

    /**
     * A slug cannot identify more than one category.
     */
    public function test_category_slugs_are_unique(): void
    {
        Category::factory()->create([
            'name' => 'Treadmills',
            'slug' => 'treadmills',
        ]);

        $this->expectException(QueryException::class);

        Category::factory()->create([
            'name' => 'Ellipticals',
            'slug' => 'treadmills',
        ]);
    }

    /**
     * With no approved dependents or retention policy, a category deletes normally.
     */
    public function test_category_can_be_deleted_without_soft_deletes(): void
    {
        $category = Category::factory()->create();

        $category->delete();

        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }
}
