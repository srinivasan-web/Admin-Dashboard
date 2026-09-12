<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class WarehouseStockTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Current stock has only its Warehouse, Product, and quantity state.
     */
    public function test_warehouse_stocks_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('warehouse_stocks'));
        $this->assertTrue(Schema::hasColumns('warehouse_stocks', [
            'id', 'warehouse_id', 'product_id', 'quantity', 'created_at', 'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('warehouse_stocks', 'reserved_quantity'));
        $this->assertFalse(Schema::hasColumn('warehouse_stocks', 'reorder_level'));
        $this->assertFalse(Schema::hasColumn('warehouse_stocks', 'variant_id'));
        $this->assertFalse(Schema::hasColumn('warehouse_stocks', 'deleted_at'));
    }

    /**
     * One stock row identifies a Warehouse and Product pair, including zero stock.
     */
    public function test_warehouse_stock_persists_uuid_relationships_and_zero_quantity(): void
    {
        $stock = WarehouseStock::factory()->create();

        $this->assertTrue(Str::isUuid($stock->id));
        $this->assertSame(0, $stock->quantity);
        $this->assertSame($stock->id, $stock->warehouse->stocks->sole()->id);
        $this->assertSame($stock->id, $stock->product->warehouseStocks->sole()->id);
    }

    /**
     * A Warehouse and Product can have only one current stock row.
     */
    public function test_warehouse_product_pair_is_unique(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        WarehouseStock::factory()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
        ]);

        $this->expectException(QueryException::class);

        WarehouseStock::factory()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
        ]);
    }

    /**
     * Referenced Warehouses and Products cannot be physically removed.
     */
    public function test_referenced_warehouse_cannot_be_deleted(): void
    {
        $stock = WarehouseStock::factory()->create();

        $this->expectException(QueryException::class);

        $stock->warehouse->delete();
    }
}
