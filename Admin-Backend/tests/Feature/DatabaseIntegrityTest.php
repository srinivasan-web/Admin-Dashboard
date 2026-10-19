<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductHighlight;
use App\Models\WarehouseStock;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DatabaseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public static function invalidBalances(): array
    {
        return ['over-reserved' => [2, 3], 'negative physical' => [-1, 0], 'negative reserved' => [1, -1]];
    }

    #[DataProvider('invalidBalances')]
    public function test_database_rejects_invalid_stock_inserts(int $quantity, int $reserved): void
    {
        $values = WarehouseStock::factory()->make()->getAttributes();
        $this->expectException(QueryException::class);
        DB::table('warehouse_stocks')->insert(array_merge($values, [
            'id' => (string) Str::uuid(), 'quantity' => $quantity, 'reserved_quantity' => $reserved,
        ]));
    }

    #[DataProvider('invalidBalances')]
    public function test_database_rejects_invalid_stock_updates(int $quantity, int $reserved): void
    {
        $stock = WarehouseStock::factory()->create(['quantity' => 4, 'reserved_quantity' => 2]);
        $this->expectException(QueryException::class);
        DB::table('warehouse_stocks')->where('id', $stock->id)->update([
            'quantity' => $quantity, 'reserved_quantity' => $reserved,
        ]);
    }

    public function test_valid_stock_boundaries_and_atomic_balance_changes_are_allowed(): void
    {
        $stock = WarehouseStock::factory()->create(['quantity' => 4, 'reserved_quantity' => 4]);
        DB::table('warehouse_stocks')->where('id', $stock->id)->update(['quantity' => 0, 'reserved_quantity' => 0]);
        $this->assertSame(0, $stock->fresh()->quantity);
        $this->assertSame(0, $stock->fresh()->reserved_quantity);
    }

    public function test_database_rejects_highlight_from_another_product(): void
    {
        $specification = $this->specification();
        $product = Product::factory()->create();
        $this->expectException(QueryException::class);
        ProductHighlight::query()->create(['product_id' => $product->id, 'product_attribute_id' => $specification->id]);
    }

    public function test_database_rejects_changing_highlight_owner(): void
    {
        $specification = $this->specification();
        $highlight = $this->highlight($specification);
        $product = Product::factory()->create();
        $this->expectException(QueryException::class);
        DB::table('product_highlights')->where('id', $highlight->id)->update(['product_id' => $product->id]);
    }

    public function test_database_rejects_reassigning_a_highlighted_specification(): void
    {
        $specification = $this->specification();
        $this->highlight($specification);
        $product = Product::factory()->create();
        $this->expectException(QueryException::class);
        DB::table('product_attributes')->where('id', $specification->id)->update(['product_id' => $product->id]);
    }

    public function test_deleting_specification_still_cascades_its_highlight(): void
    {
        $specification = $this->specification();
        $highlight = $this->highlight($specification);
        $specification->delete();
        $this->assertDatabaseMissing('product_highlights', ['id' => $highlight->id]);
        $this->assertDatabaseHas('products', ['id' => $specification->product_id]);
    }

    public function test_invalid_highlight_rolls_back_related_specification_write(): void
    {
        $specification = $this->specification();
        $other = Product::factory()->create();
        try {
            DB::transaction(function () use ($specification, $other): void {
                $specification->update(['value' => 'Changed']);
                ProductHighlight::query()->create(['product_id' => $other->id, 'product_attribute_id' => $specification->id]);
            });
            $this->fail('Cross-product highlight must be rejected.');
        } catch (QueryException) {
            $this->assertSame('3 HP Peak', $specification->fresh()->value);
            $this->assertDatabaseCount('product_highlights', 0);
        }
    }

    public function test_stock_migration_refuses_invalid_existing_data_and_preserves_valid_rows(): void
    {
        $migration = require database_path('migrations/2026_10_10_100000_enforce_warehouse_stock_balance.php');
        $stock = WarehouseStock::factory()->create(['quantity' => 4, 'reserved_quantity' => 2]);
        $migration->down();
        $stock->update(['reserved_quantity' => 5]);
        try {
            $migration->up();
            $this->fail('Migration must stop for invalid existing balances.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('Invalid warehouse stock balances', $error->getMessage());
            $this->assertSame(5, $stock->fresh()->reserved_quantity);
        }
        $stock->update(['reserved_quantity' => 2]);
        $migration->up();
        $this->assertSame(4, $stock->fresh()->quantity);
        $this->assertSame(2, $stock->fresh()->reserved_quantity);
        $this->expectException(QueryException::class);
        $stock->update(['quantity' => 1]);
    }

    public function test_ownership_migration_refuses_invalid_existing_data_and_preserves_valid_rows(): void
    {
        $migration = require database_path('migrations/2026_10_10_101000_enforce_product_highlight_ownership.php');
        $specification = $this->specification();
        $highlight = $this->highlight($specification);
        $other = Product::factory()->create();
        $migration->down();
        DB::table('product_highlights')->where('id', $highlight->id)->update(['product_id' => $other->id]);
        try {
            $migration->up();
            $this->fail('Migration must stop for invalid existing ownership.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('Invalid product highlight ownership', $error->getMessage());
            $this->assertSame($other->id, $highlight->fresh()->product_id);
        }
        DB::table('product_highlights')->where('id', $highlight->id)->update(['product_id' => $specification->product_id]);
        $migration->up();
        $migration->up();
        $this->assertSame('3 HP Peak', $specification->fresh()->value);
        $this->assertSame($specification->product_id, $highlight->fresh()->product_id);
        $this->expectException(QueryException::class);
        DB::table('product_highlights')->where('id', $highlight->id)->update(['product_id' => $other->id]);
    }

    private function specification(): ProductAttribute
    {
        $attribute = Attribute::query()->create(['name' => 'Motor', 'slug' => 'motor', 'data_type' => 'text']);

        return ProductAttribute::query()->create([
            'product_id' => Product::factory()->create()->id,
            'attribute_id' => $attribute->id, 'value' => '3 HP Peak',
        ]);
    }

    private function highlight(ProductAttribute $specification): ProductHighlight
    {
        return ProductHighlight::query()->create([
            'product_id' => $specification->product_id, 'product_attribute_id' => $specification->id,
        ]);
    }
}
