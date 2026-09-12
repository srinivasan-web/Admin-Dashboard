<?php

namespace Tests\Feature;

use App\Models\MerchandisingSection;
use App\Models\Product;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MerchandisingSectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_merchandising_schema_and_relationships_work(): void
    {
        $this->assertTrue(Schema::hasColumns('merchandising_sections', ['id', 'name', 'slug', 'type', 'sort_order', 'is_active']));
        $this->assertTrue(Schema::hasColumns('merchandising_products', ['id', 'section_id', 'product_id', 'sort_order', 'is_active']));

        $section = MerchandisingSection::factory()->create();
        $product = Product::factory()->create();
        $section->products()->attach($product->id, ['sort_order' => 2, 'is_active' => true]);

        $this->assertSame($product->id, $section->products->sole()->id);
        $this->assertSame(2, $section->products->sole()->pivot->sort_order);
        $this->assertSame($section->id, $product->merchandisingSections->sole()->id);
    }

    public function test_duplicate_product_assignment_is_rejected(): void
    {
        $section = MerchandisingSection::factory()->create();
        $product = Product::factory()->create();
        $section->products()->attach($product->id);
        $this->expectException(QueryException::class);
        $section->products()->attach($product->id);
    }
}
