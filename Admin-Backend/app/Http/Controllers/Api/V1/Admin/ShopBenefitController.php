<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\ShopBenefitRequest;
use App\Http\Resources\ShopBenefitResource;
use App\Models\ShopBenefit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ShopBenefitController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ShopBenefit::class);
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);

        return ShopBenefitResource::collection(ShopBenefit::query()
            ->with('iconMedia:id,disk,path')
            ->orderBy('sort_order')->orderBy('id')->paginate(20));
    }

    public function store(ShopBenefitRequest $request): JsonResponse
    {
        return (new ShopBenefitResource(ShopBenefit::query()->create($request->validated())->load('iconMedia')))
            ->response()->setStatusCode(201);
    }

    public function update(ShopBenefitRequest $request, ShopBenefit $benefit): ShopBenefitResource
    {
        $benefit->update($request->validated());

        return new ShopBenefitResource($benefit->refresh()->load('iconMedia'));
    }

    public function destroy(ShopBenefit $benefit): JsonResponse
    {
        $this->authorize('delete', $benefit);
        $benefit->delete();

        return response()->json(['data' => null]);
    }
}
