<?php

use App\Http\Controllers\Api\V1\PublicCatalogController;
use App\Http\Controllers\Api\V1\PublicBannerController;
use App\Http\Controllers\Api\V1\PublicProductContentController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\ProductFinanceController;

Route::middleware('request_id')->prefix('v1')->group(function (): void {
    Route::get('products/{product}/purchase-options', [ProductFinanceController::class, 'show'])->middleware('throttle:120,1');
    Route::post('products/{product}/emi/calculate', [ProductFinanceController::class, 'calculate'])->middleware('throttle:60,1');
    Route::post('products/{product}/emi/enquiries', [ProductFinanceController::class, 'enquiry'])->middleware('throttle:5,1')->name('emi.enquiry');
    Route::get('banners/active', [PublicBannerController::class, 'active']);
    Route::get('merchandising/{placement}', [PublicCatalogController::class, 'merchandising']);
    Route::get('products', [PublicCatalogController::class, 'products']);
    Route::get('products/{product}/comparison', [PublicCatalogController::class, 'comparison']);
    Route::get('products/{product}/offers', [PublicCatalogController::class, 'offers']);
    Route::get('products/{product}/buy-it-with', [PublicCatalogController::class, 'buyItWith']);
    Route::get('products/{product}', [PublicCatalogController::class, 'product']);
    Route::get('categories', [PublicCatalogController::class, 'categories']);
    Route::get('product-types', [PublicCatalogController::class, 'productTypes']);
    Route::get('filters', [PublicCatalogController::class, 'filters']);
    Route::get('category-faqs', [PublicProductContentController::class, 'faqs']);
    Route::get('shop-benefits', [PublicProductContentController::class, 'shopBenefits']);
});
