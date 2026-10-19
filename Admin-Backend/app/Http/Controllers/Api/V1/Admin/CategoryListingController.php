<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCategoryListingRequest;
use App\Http\Requests\UpdateCategoryListingRequest;
use App\Http\Resources\CategoryListingResource;
use App\Models\Category;
use App\Models\CategoryProductListing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryListingController extends Controller
{
    public function index(Request $request, Category $category): AnonymousResourceCollection
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);

        return CategoryListingResource::collection($category->listingPlacements()
            ->whereHas('product')
            ->with('product.category:id,name')
            ->orderBy('sort_order')->orderBy('id')->paginate(24));
    }

    public function store(StoreCategoryListingRequest $request, Category $category): CategoryListingResource
    {
        $listing = $category->listingPlacements()->create($request->validated());

        return new CategoryListingResource($listing->load('product.category:id,name'));
    }

    public function update(UpdateCategoryListingRequest $request, Category $category, string $listing): CategoryListingResource
    {
        $placement = CategoryProductListing::query()->where('category_id', $category->id)->findOrFail($listing);
        $placement->update($request->validated());

        return new CategoryListingResource($placement->load('product.category:id,name'));
    }
}
