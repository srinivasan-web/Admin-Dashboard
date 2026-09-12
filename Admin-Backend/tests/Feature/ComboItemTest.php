<?php

namespace Tests\Feature;

use App\Models\Combo;
use App\Models\ComboItem;
use App\Models\Product;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use LogicException;
use Tests\TestCase;

class ComboItemTest extends TestCase
{
    use RefreshDatabase;

    public function test_combo_items_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('combo_items'));
        $this->assertTrue(Schema::hasColumns('combo_items', [
            'id', 'combo_id', 'product_id', 'quantity', 'created_at', 'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('combo_items', 'sort_order'));
        $this->assertFalse(Schema::hasColumn('combo_items', 'deleted_at'));
    }

    public function test_combo_and_product_have_many_to_many_relationships(): void
    {
        $combo = Combo::factory()->create();
        $product = Product::factory()->create();

        $combo->products()->attach($product->id, ['quantity' => 2]);

        $this->assertSame($product->id, $combo->products->sole()->id);
        $this->assertSame(2, $combo->products->sole()->pivot->quantity);
        $this->assertSame($combo->id, $product->combos->sole()->id);
    }

    public function test_combo_product_pair_is_unique(): void
    {
        $combo = Combo::factory()->create();
        $product = Product::factory()->create();

        $combo->products()->attach($product->id, ['quantity' => 1]);

        $this->expectException(QueryException::class);

        $combo->products()->attach($product->id, ['quantity' => 1]);
    }

    public function test_combo_item_requires_a_positive_quantity(): void
    {
        $this->expectException(LogicException::class);

        ComboItem::query()->create([
            'combo_id' => Combo::factory()->create()->id,
            'product_id' => Product::factory()->create()->id,
            'quantity' => 0,
        ]);
    }
}
