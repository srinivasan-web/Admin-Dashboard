<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\BannerRequest;
use App\Http\Requests\ListBannersRequest;
use App\Http\Resources\BannerResource;
use App\Models\Banner;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BannerController extends Controller
{
    public function index(ListBannersRequest $request): AnonymousResourceCollection
    {
        $filters = $request->validated();
        $now = now();

        $query = Banner::query()->with(['desktopMedia', 'mobileMedia'])
            ->when($filters['search'] ?? null, fn (Builder $query, string $search) =>
                $query->where('title', 'like', '%'.$search.'%'))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) =>
                $query->where('is_active', $status === 'active'));

        match ($filters['scheduling'] ?? null) {
            'current' => $query->where(fn (Builder $query) => $query->whereNull('start_at')->orWhere('start_at', '<=', $now))
                ->where(fn (Builder $query) => $query->whereNull('end_at')->orWhere('end_at', '>=', $now)),
            'upcoming' => $query->where('start_at', '>', $now),
            'expired' => $query->where('end_at', '<', $now),
            'unscheduled' => $query->whereNull('start_at')->whereNull('end_at'),
            default => null,
        };

        return BannerResource::collection($query
            ->orderBy('sort_order', $filters['sort_order'] ?? 'asc')
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 20));
    }

    public function store(BannerRequest $request): JsonResponse
    {
        $banner = Banner::query()->create($request->validated())->load(['desktopMedia', 'mobileMedia']);

        return (new BannerResource($banner))->response()->setStatusCode(201);
    }

    public function show(Banner $banner): BannerResource
    {
        $this->authorize('view', $banner);

        return new BannerResource($banner->load(['desktopMedia', 'mobileMedia']));
    }

    public function update(BannerRequest $request, Banner $banner): BannerResource
    {
        $banner->update($request->validated());

        return new BannerResource($banner->refresh()->load(['desktopMedia', 'mobileMedia']));
    }

    public function destroy(Banner $banner): JsonResponse
    {
        $this->authorize('delete', $banner);
        $banner->delete();

        return response()->json(['data' => null]);
    }
}
