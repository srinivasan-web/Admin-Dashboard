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

    public function payload(string $page = 'landing'): array
    {
        // Do not publish uncommitted data into the shared cache.
        if (DB::transactionLevel() > 0) {
            return $this->freshPayload($page);
        }
        try {
            $revision = Cache::get(self::REVISION);
            if (! $revision) {
                Cache::add(self::REVISION, (string) Str::uuid(), now()->addYear());
                $revision = Cache::get(self::REVISION);
            }
            $key = 'banners:public:payload:'.$page.':'.$revision;
            $cached = Cache::get($key);
            if (is_array($cached)) {
                return $cached;
            }
            $readAt = now();
            $payload = $this->freshPayload($page);
            Cache::put($key, $payload, $this->expiresAt($readAt, $page));

            return $payload;
        } catch (Throwable $exception) {
            // Campaign delivery must still work if the cache is unavailable.
            Log::warning('banner.cache_read_failed', ['exception' => $exception::class]);

            return $this->freshPayload($page);
        }
    }

    private function freshPayload(string $page): array
    {
        $now = now();
        $banners = Banner::query()
            ->when($page === 'landing', fn ($query) => $query->whereIn('page', ['landing', 'home']), fn ($query) => $query->where('page', 'listing'))
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('start_at')->orWhere('start_at', '<=', $now))
            ->where(fn ($query) => $query->whereNull('end_at')->orWhere('end_at', '>=', $now))
            ->with(['desktopMedia', 'mobileMedia'])
            ->orderBy('sort_order')->orderBy('id')->get();

        return ['data' => PublicBannerResource::collection($banners)->resolve()];
    }

    private function expiresAt(Carbon $now, string $page): \DateTimeInterface
    {
        // Cache reads cannot keep an upcoming or expired campaign on screen.
        $boundary = Banner::query()
            ->when($page === 'landing', fn ($query) => $query->whereIn('page', ['landing', 'home']), fn ($query) => $query->where('page', 'listing'))
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
