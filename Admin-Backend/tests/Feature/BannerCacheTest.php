<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\Media;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BannerCacheTest extends TestCase
{
    use DatabaseMigrations;

    private function banner(array $changes = []): Banner
    {
        $media = Media::factory()->create();

        return Banner::query()->create(array_merge([
            'title' => 'Campaign', 'description' => 'Move at home', 'cta_text' => 'Explore',
            'desktop_media_id' => $media->id, 'mobile_media_id' => $media->id,
            'page' => 'landing', 'sort_order' => 0, 'redirect_url' => 'https://www.durafit91.com/products',
            'is_active' => true,
        ], $changes));
    }

    private function manager(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $user->roles()->attach($role);

        return $user;
    }

    public function test_conditional_reads_reuse_payload_without_querying_banner_or_media_tables(): void
    {
        $banner = $this->banner();
        $response = $this->getJson('/api/v1/banners/active')->assertOk()->assertJsonPath('data.0.id', $banner->id);
        $etag = $response->headers->get('ETag');
        $this->assertNotEmpty($etag);
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = $query->sql;
        });
        $this->withHeader('If-None-Match', $etag)->getJson('/api/v1/banners/active')->assertStatus(304)->assertContent('');
        $this->assertEmpty(array_filter($queries, fn ($sql) => preg_match('/from ["`]?banners["`]?|from ["`]?media["`]?/i', $sql)));
    }

    public function test_admin_button_text_update_changes_etag_immediately_even_in_the_same_second(): void
    {
        $this->freezeTime();
        $banner = $this->banner();
        $etag = $this->getJson('/api/v1/banners/active')->headers->get('ETag');
        $this->actingAs($this->manager());
        $this->putJson('/api/v1/admin/banners/'.$banner->id, ['cta_text' => 'Shop the updated collection'])
            ->assertOk()->assertJsonPath('data.cta_text', 'Shop the updated collection');
        $response = $this->withHeader('If-None-Match', $etag)->getJson('/api/v1/banners/active')
            ->assertOk()->assertJsonPath('data.0.cta_text', 'Shop the updated collection')
            ->assertJsonPath('data.0.cta_url', 'https://www.durafit91.com/products');
        $this->assertNotSame($etag, $response->headers->get('ETag'));
        $this->assertDatabaseHas('banners', ['id' => $banner->id, 'cta_text' => 'Shop the updated collection']);
    }

    public function test_creating_deactivating_and_deleting_campaigns_invalidates_public_cache(): void
    {
        $first = $this->banner();
        $this->getJson('/api/v1/banners/active')->assertJsonCount(1, 'data');
        $second = $this->banner(['title' => 'New campaign']);
        $this->getJson('/api/v1/banners/active')->assertJsonCount(2, 'data');
        $first->update(['is_active' => false]);
        $this->getJson('/api/v1/banners/active')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $second->id);
        $second->delete();
        $this->getJson('/api/v1/banners/active')->assertExactJson(['data' => []]);
    }

    public function test_schedule_boundaries_expire_cached_payload_without_an_admin_write(): void
    {
        $this->freezeTime();
        $start = now()->addSeconds(10);
        $end = now()->addSeconds(20);
        $banner = $this->banner(['start_at' => $start, 'end_at' => $end]);
        $this->getJson('/api/v1/banners/active')->assertExactJson(['data' => []]);
        $this->travelTo($start);
        $this->getJson('/api/v1/banners/active')->assertJsonPath('data.0.id', $banner->id);
        $this->travelTo($end);
        $this->getJson('/api/v1/banners/active')->assertJsonCount(1, 'data');
        $this->travelTo($end->copy()->addSecond());
        $this->getJson('/api/v1/banners/active')->assertExactJson(['data' => []]);
    }

    public function test_rolled_back_changes_do_not_replace_committed_shared_payload(): void
    {
        $banner = $this->banner();
        $this->getJson('/api/v1/banners/active')->assertJsonPath('data.0.cta_text', 'Explore');
        DB::beginTransaction();
        $banner->update(['cta_text' => 'Uncommitted label']);
        $this->getJson('/api/v1/banners/active')->assertJsonPath('data.0.cta_text', 'Uncommitted label');
        DB::rollBack();
        $this->getJson('/api/v1/banners/active')->assertJsonPath('data.0.cta_text', 'Explore');
        DB::transaction(fn () => $banner->fresh()->update(['cta_text' => 'Committed label']));
        $this->getJson('/api/v1/banners/active')->assertJsonPath('data.0.cta_text', 'Committed label');
    }
}
