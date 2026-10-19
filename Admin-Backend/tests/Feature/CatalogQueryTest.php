<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\Category;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogQueryTest extends TestCase
{
    use RefreshDatabase;

    private function products(): array
    {
        $category = Category::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $attribute = Attribute::query()->create(['name' => 'Motor', 'slug' => 'motor', 'data_type' => 'text', 'is_active' => true, 'is_filterable' => true]);
        $products = collect(range(1, 30))->map(function ($index) use ($category, $warehouse, $attribute) {
            $product = Product::factory()->create(['category_id' => $category->id, 'name' => sprintf('Equipment %02d', $index), 'sku' => sprintf('QUERY-%02d', $index), 'mrp_price' => '100.00', 'sale_price' => null]);
            WarehouseStock::factory()->create(['warehouse_id' => $warehouse->id, 'product_id' => $product->id, 'quantity' => 1]);
            ProductAttribute::query()->create(['product_id' => $product->id, 'attribute_id' => $attribute->id, 'value' => $index > 24 ? '3 HP' : '2 HP']);

            return $product;
        });

        return [$products, $category, $attribute];
    }

    public function test_public_filters_are_applied_before_pagination_and_combine_with_category(): void
    {
        [$products, $category, $attribute] = $this->products();
        $this->getJson('/api/v1/products')->assertOk()->assertJsonCount(24, 'data')->assertJsonPath('meta.total', 30);
        $query = http_build_query(['category_id' => $category->id, 'attributes' => [$attribute->id => ['3 HP']]]);
        $this->getJson('/api/v1/products?'.$query)->assertOk()->assertJsonCount(6, 'data')->assertJsonPath('meta.total', 6)->assertJsonPath('data.0.sku', 'QUERY-25');
        $query = http_build_query(['attributes' => [$attribute->id => ['2 HP', '3 HP']], 'page' => 2]);
        $this->getJson('/api/v1/products?'.$query)->assertOk()->assertJsonCount(6, 'data')->assertJsonPath('meta.total', 30);
        $typeId = $products->first()->product_type_id;
        $this->getJson('/api/v1/products?product_type_id='.$typeId)->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $products->first()->id);
        $this->getJson('/api/v1/filters?product_type_id='.$typeId)->assertOk()->assertJsonPath('data.0.name', 'Motor');
        $products->first()->update(['sale_price' => '50.00']);
        $products->last()->update(['mrp_price' => '200.00']);
        $this->getJson('/api/v1/products?min_price=150&max_price=250')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $products->last()->id);
        $this->getJson('/api/v1/products?min_price=250&max_price=100')->assertUnprocessable();
        $other = Attribute::query()->create(['name' => 'Use', 'slug' => 'use', 'data_type' => 'text', 'is_active' => true, 'is_filterable' => true]);
        ProductAttribute::query()->create(['product_id' => $products->last()->id, 'attribute_id' => $other->id, 'value' => 'Home']);
        $this->getJson('/api/v1/products?'.http_build_query(['attributes' => [$attribute->id => ['3 HP'], $other->id => ['Home']]]))->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.sku', 'QUERY-30');
        $different = Category::factory()->create();
        $this->getJson('/api/v1/filters?category_id='.$different->id)->assertOk()->assertExactJson(['data' => []]);
        $this->getJson('/api/v1/products?attributes[invalid][]=value')->assertUnprocessable();
        $attribute->update(['is_active' => false]);
        $this->getJson('/api/v1/products?'.http_build_query(['attributes' => [$attribute->id => ['3 HP']]]))->assertUnprocessable();
    }

    public function test_admin_search_sort_and_pagination_cover_products_beyond_the_first_page(): void
    {
        [$products] = $this->products();
        $role = Role::query()->create(['name' => 'Catalog', 'slug' => 'catalog']);
        $role->permissions()->attach(Permission::query()->create(['name' => 'catalog.manage']));
        $user = User::factory()->create();
        $user->roles()->attach($role);
        $this->actingAs($user);
        $this->getJson('/api/v1/admin/products?sort=name&page=2')->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('data.0.sku', 'QUERY-21')->assertJsonPath('meta.total', 30);
        $this->getJson('/api/v1/admin/products?search=QUERY-30')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $products->last()->id);
        $this->getJson('/api/v1/admin/products?search='.$products->last()->id)->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/products?sort=untrusted_sql')->assertUnprocessable();
        $this->getJson('/api/v1/admin/products?page=0')->assertUnprocessable();
    }

    public function test_optional_category_placement_supplements_primary_category_and_public_filters(): void
    {
        $primary = Category::factory()->create(['name' => 'Treadmills']);
        $additional = Category::factory()->create(['name' => 'Home Fitness']);
        $product = Product::factory()->create(['category_id' => $primary->id]);
        $warehouse = Warehouse::factory()->create();
        WarehouseStock::factory()->create(['warehouse_id' => $warehouse->id, 'product_id' => $product->id, 'quantity' => 2]);
        $attribute = Attribute::query()->create([
            'name' => 'Motor', 'slug' => 'motor', 'data_type' => 'text',
            'is_active' => true, 'is_filterable' => true,
        ]);
        ProductAttribute::query()->create(['product_id' => $product->id, 'attribute_id' => $attribute->id, 'value' => '3 HP']);

        $listingUrl = '/api/v1/admin/categories/'.$additional->id.'/listings';
        $this->getJson($listingUrl)->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson($listingUrl)->assertForbidden();

        $role = Role::query()->create(['name' => 'Catalog', 'slug' => 'catalog']);
        $role->permissions()->attach(Permission::query()->create(['name' => 'catalog.manage']));
        $user = User::factory()->create();
        $user->roles()->attach($role);
        $this->actingAs($user);

        $created = $this->postJson($listingUrl, ['product_id' => $product->id, 'sort_order' => 3])
            ->assertSuccessful()
            ->assertJsonPath('data.product.primary_category_id', $primary->id)
            ->assertJsonPath('data.sort_order', 3);
        $listingId = $created->json('data.id');
        $this->postJson($listingUrl, ['product_id' => $product->id])->assertUnprocessable();
        $this->getJson($listingUrl)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/products?category_id='.$additional->id)
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $product->id);
        $this->getJson('/api/v1/filters?category_id='.$additional->id)
            ->assertOk()->assertJsonPath('data.0.name', 'Motor')->assertJsonPath('data.0.values.0', '3 HP');
        $this->getJson('/api/v1/products?category_id='.$primary->id)
            ->assertOk()->assertJsonPath('meta.total', 1);

        $this->putJson($listingUrl.'/'.$listingId, ['sort_order' => 4, 'is_featured' => true, 'is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);
        $this->getJson('/api/v1/products?category_id='.$additional->id)
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/filters?category_id='.$additional->id)
            ->assertOk()->assertExactJson(['data' => []]);
        $this->getJson('/api/v1/products?category_id='.$primary->id)
            ->assertOk()->assertJsonPath('meta.total', 1);
    }
}
