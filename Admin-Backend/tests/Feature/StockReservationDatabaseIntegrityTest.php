<?php

namespace Tests\Feature;

use App\Actions\CreateOrder;
use App\Actions\ReserveOrderStock;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockReservation;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StockReservationDatabaseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public static function invalidWrites(): array
    {
        return [
            'insert another order' => ['insert', 'order'],
            'update another order' => ['update', 'order'],
            'insert another product' => ['insert', 'product'],
            'update another product' => ['update', 'product'],
            'insert missing warehouse stock' => ['insert', 'stock'],
            'update missing warehouse stock' => ['update', 'stock'],
        ];
    }

    #[DataProvider('invalidWrites')]
    public function test_database_rejects_mismatched_reservation_references(string $operation, string $mismatch): void
    {
        [$order, $stock, $data] = $this->fixture();
        if ($operation === 'update') {
            DB::table('stock_reservations')->insert($data);
        }
        $changes = $this->mismatch($mismatch, $stock);

        try {
            if ($operation === 'insert') {
                DB::table('stock_reservations')->insert(array_merge($data, $changes));
            } else {
                DB::table('stock_reservations')->where('id', $data['id'])->update($changes);
            }
            $this->fail('Separate valid foreign keys must not allow mismatched ownership.');
        } catch (QueryException $error) {
            $this->assertStringContainsString('foreign key', strtolower($error->getMessage()));
            $this->assertDatabaseCount('stock_reservations', $operation === 'insert' ? 0 : 1);
            if ($operation === 'update') {
                $this->assertDatabaseHas('stock_reservations', [
                    'id' => $data['id'], 'order_id' => $order->id,
                    'product_id' => $stock->product_id, 'warehouse_id' => $stock->warehouse_id,
                ]);
            }
        }
    }

    public function test_existing_reservation_action_and_retry_preserve_balances_and_history(): void
    {
        [$order, $stock] = $this->fixture();
        app(ReserveOrderStock::class)->execute($order);
        app(ReserveOrderStock::class)->execute($order);

        $this->assertSame(4, $stock->fresh()->quantity);
        $this->assertSame(1, $stock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_reservations', 1);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_reserved_order_item_cannot_be_reassigned_by_direct_sql(): void
    {
        [$order, $stock, $data] = $this->fixture();
        app(ReserveOrderStock::class)->execute($order);
        $other = $this->order($stock);
        $this->expectException(QueryException::class);
        DB::table('order_items')->where('id', $data['order_item_id'])->update(['order_id' => $other->id]);
    }

    public function test_reserved_stock_row_cannot_be_deleted_even_after_release(): void
    {
        [, $stock, $data] = $this->fixture();
        // A released historical reservation still owns its stock relationship.
        DB::table('stock_reservations')->insert(array_merge($data, [
            'status' => StockReservation::Released, 'released_at' => now(),
        ]));
        $this->expectException(QueryException::class);
        DB::table('warehouse_stocks')->where('id', $stock->id)->delete();
    }

    public function test_stock_pair_cannot_be_reassigned_under_an_existing_reservation(): void
    {
        [, $stock, $data] = $this->fixture();
        DB::table('stock_reservations')->insert($data);
        $other = Warehouse::factory()->create();
        $this->expectException(QueryException::class);
        DB::table('warehouse_stocks')->where('id', $stock->id)->update(['warehouse_id' => $other->id]);
    }

    public function test_mismatched_reservation_rolls_back_the_stock_change(): void
    {
        [, $stock, $data] = $this->fixture();
        $other = $this->order($stock);
        try {
            DB::transaction(function () use ($stock, $data, $other): void {
                DB::table('warehouse_stocks')->where('id', $stock->id)->increment('reserved_quantity');
                DB::table('stock_reservations')->insert(array_merge($data, ['order_id' => $other->id]));
            });
            $this->fail('Mismatched reservation must fail and roll back.');
        } catch (QueryException) {
            $this->assertSame(0, $stock->fresh()->reserved_quantity);
            $this->assertDatabaseCount('stock_reservations', 0);
        }
    }

    public static function legacyMismatches(): array
    {
        return [['order'], ['product'], ['stock']];
    }

    #[DataProvider('legacyMismatches')]
    public function test_migration_stops_before_ddl_without_repairing_legacy_data(string $mismatch): void
    {
        [, $stock, $data] = $this->fixture();
        $migration = $this->migration();
        $migration->down();
        $invalid = array_merge($data, $this->mismatch($mismatch, $stock));
        DB::table('stock_reservations')->insert($invalid);
        try {
            $migration->up();
            $this->fail('Migration must refuse mismatched legacy relationships.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('Invalid stock reservation relationships', $error->getMessage());
            $this->assertDatabaseHas('stock_reservations', [
                'id' => $invalid['id'], 'order_id' => $invalid['order_id'],
                'product_id' => $invalid['product_id'], 'warehouse_id' => $invalid['warehouse_id'],
            ]);
            $this->assertFalse(Schema::hasIndex('order_items', 'order_items_order_id_id_product_id_unique'));
        }
        // Restore only the isolated test fixture, not real application data.
        DB::table('stock_reservations')->where('id', $data['id'])->update($data);
        $migration->up();
    }

    public function test_migration_round_trip_and_retry_preserve_valid_reservations(): void
    {
        [$order, $stock] = $this->fixture();
        app(ReserveOrderStock::class)->execute($order);
        $before = (array) DB::table('stock_reservations')->sole();
        $migration = $this->migration();
        $migration->down();
        $migration->up();
        $migration->up();

        $this->assertSame($before, (array) DB::table('stock_reservations')->sole());
        $this->assertSame(1, $stock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('stock_movements', 1);
        $other = $this->order($stock);
        $this->expectException(QueryException::class);
        DB::table('stock_reservations')->where('id', $before['id'])->update(['order_id' => $other->id]);
    }

    public function test_migration_resumes_after_partial_index_and_foreign_key_creation(): void
    {
        $migration = $this->migration();
        $migration->down();
        Schema::table('order_items', fn ($table) => $table->unique(['order_id', 'id', 'product_id']));
        Schema::table('stock_reservations', function ($table): void {
            $table->foreign(['order_id', 'order_item_id', 'product_id'])
                ->references(['order_id', 'id', 'product_id'])->on('order_items')
                ->restrictOnDelete()->restrictOnUpdate();
        });
        $migration->up();
        $keys = Schema::getForeignKeys('stock_reservations');
        $this->assertCount(1, array_filter($keys, fn ($key) => $key['columns'] === ['order_id', 'order_item_id', 'product_id']));
        $this->assertCount(1, array_filter($keys, fn ($key) => $key['columns'] === ['warehouse_id', 'product_id']));
    }

    private function fixture(): array
    {
        $stock = WarehouseStock::factory()->create(['quantity' => 4]);
        $order = $this->order($stock);

        return [$order, $stock, [
            'id' => (string) Str::uuid(), 'order_id' => $order->id,
            'order_item_id' => $order->items()->sole()->id,
            'warehouse_id' => $stock->warehouse_id, 'product_id' => $stock->product_id,
            'quantity' => 1, 'status' => StockReservation::Active,
            'reserved_at' => now(), 'expires_at' => now()->addMinutes(10),
            'created_at' => now(), 'updated_at' => now(),
        ]];
    }

    private function order(WarehouseStock $stock): Order
    {
        $address = ['name' => 'Integrity test customer', 'address' => 'Test address'];

        return app(CreateOrder::class)->execute(
            Customer::factory()->create(), 'INTEGRITY-'.Str::uuid(),
            [['product' => $stock->product, 'quantity' => 1, 'unit_price' => '100.00']],
            $address, $address, $stock->warehouse,
        );
    }

    private function mismatch(string $kind, WarehouseStock $stock): array
    {
        if ($kind === 'order') {
            return ['order_id' => $this->order($stock)->id];
        }
        if ($kind === 'product') {
            $other = WarehouseStock::factory()->create([
                'warehouse_id' => $stock->warehouse_id, 'product_id' => Product::factory(), 'quantity' => 4,
            ]);

            return ['product_id' => $other->product_id];
        }

        return ['warehouse_id' => Warehouse::factory()->create()->id];
    }

    private function migration(): object
    {
        return require database_path('migrations/2026_10_10_102000_enforce_stock_reservation_relationships.php');
    }
}
