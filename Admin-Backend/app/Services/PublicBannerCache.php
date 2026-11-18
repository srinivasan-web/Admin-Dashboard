<?php

namespace App\Services;

use App\Http\Resources\PublicBannerResource;
use App\Models\Banner;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class PublicBannerCache
{
    private const REVISION = 'banners:public:revision';

    public function invalidate(): void
    {
        try {
            // Each committed mutation gets a new namespace. An older in-flight
            // read cannot repopulate the new namespace with stale content.
            Cache::forever(self::REVISION, (string) Str::uuid());
        } catch (Throwable $exception) {
            Log::warning('banner.cache_invalidation_failed', ['exception' => $exception::class]);
        }
    }

    public function payload(string $page = 'landing', ?string $categoryId = null, ?string $typeId = null): array
    {
        // Do not publish uncommitted data into the shared cache.
        if (DB::transactionLevel() > 0) {
            return $this->freshPayload($page, $categoryId, $typeId);
        }
        try {
            $revision = Cache::get(self::REVISION);
            if (! $revision) {
                Cache::add(self::REVISION, (string) Str::uuid(), now()->addYear());
                $revision = Cache::get(self::REVISION);
            }
            $key = 'banners:public:payload:'.$page.':'.($categoryId ?? 'all').':'.($typeId ?? 'all').':'.$revision;
            $cached = Cache::get($key);
            if (is_array($cached)) {
                return $cached;
            }
            $readAt = now();
            $payload = $this->freshPayload($page, $categoryId, $typeId);
            Cache::put($key, $payload, $this->expiresAt($readAt, $page, $categoryId, $typeId));

            return $payload;
        } catch (Throwable $exception) {
            // Campaign delivery must still work if the cache is unavailable.
            Log::warning('banner.cache_read_failed', ['exception' => $exception::class]);

            return $this->freshPayload($page, $categoryId, $typeId);
        }
    }

    private function freshPayload(string $page, ?string $categoryId, ?string $typeId): array
    {
        $now = now();
        $banners = Banner::query()
            ->when($page === 'landing', fn ($query) => $query->whereIn('page', ['landing', 'home']), fn ($query) => $query->where('page', 'listing'))
            ->when($page === 'listing', function ($query) use ($categoryId, $typeId): void {
                $query->where(function ($audience) use ($categoryId, $typeId): void {
                    $audience->where(fn ($general) => $general->whereNull('category_id')->whereNull('product_type_id'));
                    if ($categoryId) {
                        $audience->orWhere('category_id', $categoryId);
                    }
                    if ($typeId) {
                        $audience->orWhere('product_type_id', $typeId);
                    }
                });
            })
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('start_at')->orWhere('start_at', '<=', $now))
            ->where(fn ($query) => $query->whereNull('end_at')->orWhere('end_at', '>=', $now))
            ->with(['desktopMedia', 'mobileMedia'])
            ->when($page === 'listing' && ($categoryId || $typeId), fn ($query) => $query->orderByRaw(
                'CASE WHEN category_id = ? OR product_type_id = ? THEN 0 ELSE 1 END',
                [$categoryId, $typeId],
            ))
            ->orderBy('sort_order')->orderBy('id')->limit(20)->get();

        return ['data' => PublicBannerResource::collection($banners)->resolve()];
    }

    private function expiresAt(Carbon $now, string $page, ?string $categoryId, ?string $typeId): \DateTimeInterface
    {
        // Cache reads cannot keep an upcoming or expired campaign on screen.
        $boundary = Banner::query()
            ->when($page === 'landing', fn ($query) => $query->whereIn('page', ['landing', 'home']), fn ($query) => $query->where('page', 'listing'))
            ->when($page === 'listing', function ($query) use ($categoryId, $typeId): void {
                $query->where(function ($audience) use ($categoryId, $typeId): void {
                    $audience->where(fn ($general) => $general->whereNull('category_id')->whereNull('product_type_id'));
                    if ($categoryId) {
                        $audience->orWhere('category_id', $categoryId);
                    }
                    if ($typeId) {
                        $audience->orWhere('product_type_id', $typeId);
                    }
                });
            })
            ->where('is_active', true)
            ->selectRaw('MIN(CASE WHEN start_at > ? THEN start_at END) AS next_start, MIN(CASE WHEN end_at >= ? THEN end_at END) AS next_end', [$now, $now])->first();
        $expiry = $now->copy()->addMinute();
        foreach ([$boundary?->next_start, $boundary?->next_end ? Carbon::parse($boundary->next_end)->addSecond() : null] as $date) {
            if ($date && Carbon::parse($date)->lt($expiry)) {
                $expiry = Carbon::parse($date);
            }
        }

        return $expiry;
    }
}
