<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\ReplaceProductHighlights;
use App\Actions\SaveProductSpecification;
use App\Http\Controllers\Controller;
use App\Http\Requests\ProductAttributeRequest;
use App\Http\Requests\ReplaceProductHighlightsRequest;
use App\Http\Resources\ProductAttributeResource;
use App\Http\Resources\ProductHighlightResource;
use App\Models\Product;
use App\Models\ProductAttribute;
use Illuminate\Support\Facades\DB;

class ProductSpecificationController extends Controller
{
    private function authorizeProduct(Product $product): void
    {
        $this->authorize('update', $product);
    }

    public function index(Product $product)
    {
        $this->authorizeProduct($product);

        return ProductAttributeResource::collection($product->productAttributes()->with('attribute')->orderBy('sort_order')->get());
    }

    public function store(Product $product, ProductAttributeRequest $request, SaveProductSpecification $save)
    {
        $this->authorizeProduct($product);
        $item = $save->execute($product, $request->validated());

        return new ProductAttributeResource($item->load('attribute'));
    }

    public function update(Product $product, ProductAttribute $productAttribute, ProductAttributeRequest $request, SaveProductSpecification $save)
    {
        $this->authorizeProduct($product);
        abort_unless($productAttribute->product_id === $product->id, 404);

        return new ProductAttributeResource($save->execute($product, $request->validated(), $productAttribute));
    }

    public function destroy(Product $product, ProductAttribute $productAttribute)
    {
        $this->authorizeProduct($product);
        abort_unless($productAttribute->product_id === $product->id, 404);
        DB::transaction(function () use ($product, $productAttribute): void {
            Product::query()->lockForUpdate()->findOrFail($product->id);
            $product->productAttributes()->findOrFail($productAttribute->id)->delete();
        });

        return response()->noContent();
    }

    public function highlights(Product $product)
    {
        $this->authorizeProduct($product);

        return ProductHighlightResource::collection($product->highlights()->with('productAttribute.attribute')->orderBy('sort_order')->get());
    }

    public function replaceHighlights(Product $product, ReplaceProductHighlightsRequest $request, ReplaceProductHighlights $replace)
    {
        $this->authorizeProduct($product);
        $replace->execute($product, $request->validated('highlights'));

        return ProductHighlightResource::collection($product->highlights()->with('productAttribute.attribute')->orderBy('sort_order')->get());
    }
}
