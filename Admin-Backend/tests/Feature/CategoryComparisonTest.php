<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\FlashSale;
use App\Models\FlashSaleProduct;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryComparisonTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_configuration_is_saved_and_reflected_in_storefront_comparison(): void
    {
        $product = Product::factory()->create([
            'is_active' => true, 'mrp_price' => '30000.00', 'sale_price' => '25000.00',
        ]);
        $alternative = Product::factory()->create([
            'category_id' => $product->category_id,
            'product_type_id' => $product->product_type_id,
            'is_active' => true,
        ]);
        foreach ([$product, $alternative] as $candidate) {
            WarehouseStock::factory()->create(['product_id' => $candidate->id, 'quantity' => 3, 'reserved_quantity' => 0]);
        }
        $attribute = Attribute::query()->create([
            'name' => 'Motor output', 'slug' => 'motor-output', 'data_type' => 'text',
            'unit' => 'HP', 'is_active' => true,
        ]);
        $product->productAttributes()->create(['attribute_id' => $attribute->id, 'value' => '3 Peak']);

        $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
            ->assertJsonPath('data.attributes.0.name', 'Motor output')
            ->assertJsonPath('data.products.0.specifications.0.value', '3 Peak')
            ->assertJsonCount(2, 'data.products');

        $url = '/api/v1/admin/categories/'.$product->category_id.'/comparison-specifications';
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->putJson($url, ['specifications' => []])->assertForbidden();

        $manager = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $manager->roles()->attach($role);
        $this->actingAs($manager);

        $payload = ['specifications' => [[
            'attribute_id' => $attribute->id, 'label' => 'Motor', 'sort_order' => 1,
        ]]];
        $this->putJson($url, $payload)->assertOk()
            ->assertJsonPath('data.0.label', 'Motor');
        $this->assertDatabaseHas('category_specifications', [
            'category_id' => $product->category_id,
            'attribute_id' => $attribute->id,
            'is_comparable' => 1,
        ]);
        $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
            ->assertJsonPath('data.attributes.0.name', 'Motor')
            ->assertJsonPath('data.products.0.specifications.0.value', '3 Peak')
            ->assertJsonCount(2, 'data.products');

        $sale = FlashSale::query()->create([
            'name' => 'Current offer', 'starts_at' => now()->subMinute(),
            'ends_at' => now()->addHour(), 'is_active' => true,
        ]);
        FlashSaleProduct::query()->create([
            'flash_sale_id' => $sale->id, 'product_id' => $product->id,
            'discount_type' => 'price', 'discount_value' => '20000.00', 'is_active' => true,
        ]);
        $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
            ->assertJsonPath('data.products.0.price.sale', '20000.00');

        $this->putJson($url, $payload)->assertOk();
        $this->assertSame(1, $product->category->specifications()->count());
        $this->putJson($url, ['specifications' => []])->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/products/'.$product->id.'/comparison')->assertOk()
            ->assertJsonCount(0, 'data.products');
    }

    public function test_inactive_attributes_cannot_be_published_for_comparison(): void
    {
        $product = Product::factory()->create();
        $attribute = Attribute::query()->create([
            'name' => 'Retired', 'slug' => 'retired', 'data_type' => 'text', 'is_active' => false,
        ]);
        $manager = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $manager->roles()->attach($role);
        $this->actingAs($manager)->putJson(
            '/api/v1/admin/categories/'.$product->category_id.'/comparison-specifications',
            ['specifications' => [['attribute_id' => $attribute->id, 'sort_order' => 0]]],
        )->assertUnprocessable();
    }
}
