<?php

use App\Http\Controllers\Api\V1\PublicCatalogController;
use App\Http\Controllers\Api\V1\PublicBannerController;
use Illuminate\Support\Facades\Route;

Route::middleware('request_id')->prefix('v1')->group(function (): void {
    Route::get('banners/active', [PublicBannerController::class, 'active']);
    Route::get('merchandising/{placement}', [PublicCatalogController::class, 'merchandising']);
    Route::get('products', [PublicCatalogController::class, 'products']);
    Route::get('products/{product}/buy-it-with', [PublicCatalogController::class, 'buyItWith']);
    Route::get('products/{product}', [PublicCatalogController::class, 'product']);
    Route::get('categories', [PublicCatalogController::class, 'categories']);
    Route::get('product-types', [PublicCatalogController::class, 'productTypes']);
    Route::get('filters', [PublicCatalogController::class, 'filters']);
});
