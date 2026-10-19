<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Permission;
use App\Models\ProductType;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductExportBenchmarkTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_export_is_complete_with_representative_catalogue(): void
    {
        $brand = Brand::factory()->create();
        $category = Category::factory()->create();
        $type = ProductType::factory()->create();
        $now = now();
        foreach (range(0, 11) as $batch) {
            $products = [];
            foreach (range(0, 99) as $offset) {
                $number = $batch * 100 + $offset;
                $products[] = [
                    'id' => (string) Str::uuid(),
                    'brand_id' => $brand->id,
                    'category_id' => $category->id,
                    'product_type_id' => $type->id,
                    'name' => sprintf('Product %04d', $number),
                    'sku' => sprintf('SKU-%04d', $number),
                    'mrp_price' => '1000.00',
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            DB::table('products')->insert($products);
        }

        $manager = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $manager->roles()->attach($role);

        $queries = 0;
        DB::listen(function () use (&$queries): void {
            $queries++;
        });
        $memoryBefore = memory_get_usage(false);
        memory_reset_peak_usage();
        $start = hrtime(true);
        $response = $this->actingAs($manager)->get('/api/v1/admin/products/export');
        $elapsedMs = (hrtime(true) - $start) / 1_000_000;
        $memoryDelta = memory_get_usage(false) - $memoryBefore;
        $queriesBeforeStream = $queries;

        $response->assertOk()->assertDownload('products.csv');
        $csv = $response->streamedContent();
        $fullElapsedMs = (hrtime(true) - $start) / 1_000_000;
        $peakDelta = memory_get_peak_usage(false) - $memoryBefore;
        $lines = explode("\n", trim($csv));
        $this->assertCount(1201, $lines);
        $this->assertSame(
            ['Name', 'SKU', 'Brand', 'Product Type', 'Category', 'Stock', 'MRP', 'Sale Price', 'Status'],
            str_getcsv($lines[0]),
        );
        $this->assertSame(['Product 0000', 'SKU-0000'], array_slice(str_getcsv($lines[1]), 0, 2));
        $this->assertSame(['Product 1199', 'SKU-1199'], array_slice(str_getcsv($lines[1200]), 0, 2));
        $this->assertSame(['0', '1000.00', '', 'Active'], array_slice(str_getcsv($lines[1]), 5));

        $filtered = $this->actingAs($manager)
            ->get('/api/v1/admin/products/export?search=SKU-0001&status=active')
            ->assertOk()->assertDownload('products.csv');
        $filteredLines = explode("\n", trim($filtered->streamedContent()));
        $this->assertCount(2, $filteredLines);
        $this->assertSame(['Product 0001', 'SKU-0001'], array_slice(str_getcsv($filteredLines[1]), 0, 2));

        if (getenv('DURAFIT_EXPORT_BENCHMARK') === '1') {
            fwrite(STDERR, sprintf(
                "export benchmark: before-stream %.1f ms, %.1f MiB retained, %d queries; full stream %.1f ms, %.1f MiB peak, %d queries\n",
                $elapsedMs,
                $memoryDelta / 1024 / 1024,
                $queriesBeforeStream,
                $fullElapsedMs,
                $peakDelta / 1024 / 1024,
                $queries,
            ));
        }
    }

    public function test_product_export_requires_catalogue_permission(): void
    {
        $this->getJson('/api/v1/admin/products/export')->assertUnauthorized();
        $this->actingAs(User::factory()->create())
            ->getJson('/api/v1/admin/products/export')->assertForbidden();
    }
}
