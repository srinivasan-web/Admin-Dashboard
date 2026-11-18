<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\AttachProductImage;
use App\Actions\CreateCatalogProduct;
use App\Actions\DeleteCatalogProduct;
use App\Actions\ManageProductImage;
use App\Actions\UpdateCatalogProduct;
use App\Http\Controllers\Controller;
use App\Http\Requests\ListProductsRequest;
use App\Http\Requests\StoreProductImageRequest;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductImageRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends Controller
{
    public function index(ListProductsRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Product::class);

        $query = $this->filteredQuery($request)
            ->with([
                'brand:id,name,slug',
                'category:id,name,slug',
                'productType:id,name,slug',
                'hsnCode:id,code,description',
                'images' => fn ($q) => $q->orderBy('sort_order')->with('media:id,disk,path,original_filename'),
                'warehouseStocks:id,product_id,warehouse_id,quantity,reserved_quantity',
                'warehouseStocks.warehouse:id,name',
            ])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity');
        match ($request->validated('sort', 'newest')) {
            'name' => $query->orderBy('name'),
            'price_asc' => $query->orderByRaw('COALESCE(sale_price, mrp_price) ASC'),
            'price_desc' => $query->orderByRaw('COALESCE(sale_price, mrp_price) DESC'),
            default => $query->orderByDesc('created_at'),
        };

        return ProductResource::collection($query->orderBy('id')->paginate(20)->withQueryString());
    }

    public function export(ListProductsRequest $request): StreamedResponse
    {
        $this->authorize('viewAny', Product::class);
        $products = $this->filteredQuery($request)
            ->with(['brand', 'category', 'productType'])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity')
            ->orderBy('name')
            ->orderBy('id')
            ->lazy(500);

        return response()->streamDownload(function () use ($products): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Name', 'SKU', 'Brand', 'Product Type', 'Category', 'Stock', 'MRP', 'Sale Price', 'Status']);
            foreach ($products as $product) {
                fputcsv($handle, [
                    $product->name,
                    $product->sku,
                    $product->brand->name,
                    $product->productType->name,
                    $product->category->name,
                    max(0, (int) ($product->warehouse_stocks_sum_quantity ?? 0) - (int) ($product->warehouse_stocks_sum_reserved_quantity ?? 0)),
                    $product->mrp_price,
                    $product->sale_price,
                    $product->is_active ? 'Active' : 'Inactive',
                ]);
            }
            fclose($handle);
        }, 'products.csv', ['Content-Type' => 'text/csv']);
    }

    public function store(StoreProductRequest $request, CreateCatalogProduct $createCatalogProduct): ProductResource
    {
        $this->authorize('create', Product::class);

        return new ProductResource($createCatalogProduct->execute($request->validated(), $request->user()));
    }

    public function show(Product $product): ProductResource
    {
        $this->authorize('viewAny', Product::class);

        return new ProductResource(
            $product->load([
                'brand',
                'category',
                'productType',
                'hsnCode',
                'images.media',
                'productAttributes.attribute',
                'highlights.productAttribute.attribute',
                'details',
                'additionalDetails',
            ])->loadSum('warehouseStocks', 'quantity')->loadSum('warehouseStocks', 'reserved_quantity'),
        );
    }

    public function update(Product $product, UpdateProductRequest $request, UpdateCatalogProduct $updateCatalogProduct): ProductResource
    {
        return new ProductResource($updateCatalogProduct->execute($product, $request->validated(), $request->user()));
    }

    public function destroy(Product $product, DeleteCatalogProduct $deleteCatalogProduct): ProductResource
    {
        $this->authorize('delete', $product);
        $product = $deleteCatalogProduct->execute($product);

        return new ProductResource($product->load(['brand', 'category', 'productType', 'hsnCode'])->loadSum('warehouseStocks', 'quantity')->loadSum('warehouseStocks', 'reserved_quantity'));
    }

    public function storeImage(Product $product, StoreProductImageRequest $request, AttachProductImage $attachProductImage): ProductResource
    {
        $this->authorize('update', $product);

        $attachProductImage->execute(
            $product,
            $request->file('image'),
            $request->string('type', 'gallery')->toString(),
            $request->integer('sort_order'),
            $request->boolean('is_primary'),
        );

        return new ProductResource($product->fresh(['brand', 'category', 'productType', 'images.media'])->loadSum('warehouseStocks', 'quantity')->loadSum('warehouseStocks', 'reserved_quantity'));
    }

    public function updateImage(Product $product, ProductImage $image, UpdateProductImageRequest $request, ManageProductImage $manageProductImage): ProductResource
    {
        $manageProductImage->update($product, $image, $request->validated());

        return $this->imageResponse($product);
    }

    public function replaceImage(Product $product, ProductImage $image, StoreProductImageRequest $request, ManageProductImage $manageProductImage): ProductResource
    {
        $this->authorize('update', $product);
        $manageProductImage->replace($product, $image, $request->file('image'));

        return $this->imageResponse($product);
    }

    public function destroyImage(Product $product, ProductImage $image, ManageProductImage $manageProductImage): ProductResource
    {
        $this->authorize('update', $product);
        $manageProductImage->delete($product, $image);

        return $this->imageResponse($product);
    }

    private function imageResponse(Product $product): ProductResource
    {
        return new ProductResource($product->fresh(['brand', 'category', 'productType', 'hsnCode', 'images.media'])->loadSum('warehouseStocks', 'quantity')->loadSum('warehouseStocks', 'reserved_quantity'));
    }

    private function filteredQuery(Request $request): Builder
    {
        return Product::query()
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(function ($productQuery) use ($search): void {
                    $productQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('id', $search);
                });
            })
            ->when($request->filled('product_type_id'), fn ($query) => $query->where('product_type_id', $request->string('product_type_id')))
            ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->string('category_id')))
            ->when($request->filled('hsn_code_id'), fn ($query) => $query->where('hsn_code_id', $request->string('hsn_code_id')))
            ->when($request->input('status') === 'active', fn ($query) => $query->where('is_active', true))
            ->when($request->input('status') === 'inactive', fn ($query) => $query->where('is_active', false))
            ->when($request->input('stock') === 'in-stock', fn ($query) => $query->whereHas('warehouseStocks', fn ($stockQuery) => $stockQuery->whereColumn('quantity', '>', 'reserved_quantity')))
            ->when($request->input('stock') === 'out-of-stock', fn ($query) => $query->whereDoesntHave('warehouseStocks', fn ($stockQuery) => $stockQuery->whereColumn('quantity', '>', 'reserved_quantity')));
    }
}
