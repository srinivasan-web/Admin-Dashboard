<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductOfferRequest;
use App\Http\Resources\ProductOfferResource;
use App\Models\ProductOffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductOfferController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ProductOffer::class);
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);

        return ProductOfferResource::collection(ProductOffer::query()
            ->orderBy('sort_order')->orderBy('id')->paginate(20));
    }

    public function store(ProductOfferRequest $request): JsonResponse
    {
        return (new ProductOfferResource(ProductOffer::query()->create($request->validated())))
            ->response()->setStatusCode(201);
    }

    public function update(ProductOfferRequest $request, ProductOffer $offer): ProductOfferResource
    {
        $offer->update($request->validated());

        return new ProductOfferResource($offer->refresh());
    }

    public function destroy(ProductOffer $offer): JsonResponse
    {
        $this->authorize('delete', $offer);
        $offer->delete();

        return response()->json(['data' => null]);
    }
}
