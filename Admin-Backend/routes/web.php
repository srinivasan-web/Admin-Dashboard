<?php

use App\Http\Controllers\Api\V1\Admin\AdminAuthController;
use App\Http\Controllers\Api\V1\Admin\AttributeController;
use App\Http\Controllers\Api\V1\Admin\BannerController;
use App\Http\Controllers\Api\V1\Admin\CatalogMasterController;
use App\Http\Controllers\Api\V1\Admin\CategoryListingController;
use App\Http\Controllers\Api\V1\Admin\CategoryComparisonController;
use App\Http\Controllers\Api\V1\Admin\CategoryFaqController;
use App\Http\Controllers\Api\V1\Admin\ComboController;
use App\Http\Controllers\Api\V1\Admin\HsnCodeController;
use App\Http\Controllers\Api\V1\Admin\MerchandisingController;
use App\Http\Controllers\Api\V1\Admin\MediaController;
use App\Http\Controllers\Api\V1\Admin\OrderController;
use App\Http\Controllers\Api\V1\Admin\ProductController;
use App\Http\Controllers\Api\V1\Admin\ProductOfferController;
use App\Http\Controllers\Api\V1\Admin\ProductSpecificationController;
use App\Http\Controllers\Api\V1\Admin\ShopBenefitController;
use App\Http\Controllers\Api\V1\Admin\WarehouseController;
use App\Http\Controllers\Api\V1\Admin\WarehouseStockController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\Admin\FinanceConfigurationController;
use App\Http\Controllers\Api\V1\Admin\EmiEnquiryController;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('api/v1/admin')->middleware('request_id')->group(function (): void {
    Route::get('auth/csrf', [AdminAuthController::class, 'csrf']);
    Route::post('auth/register', [AdminAuthController::class, 'register'])->middleware('throttle:initial-registration');
    Route::post('auth/login', [AdminAuthController::class, 'login'])->middleware('throttle:admin-login');

    Route::middleware('auth')->group(function (): void {
        Route::get('finance/delivery-status', [FinanceConfigurationController::class, 'deliveryStatus']);
        Route::get('finance/emi-enquiries', [EmiEnquiryController::class, 'index']);
        Route::get('finance/emi-enquiries/{enquiry}', [EmiEnquiryController::class, 'show'])->whereUuid('enquiry');
        Route::post('finance/emi-enquiries/{enquiry}/retry', [EmiEnquiryController::class, 'retry'])->whereUuid('enquiry')->middleware('throttle:10,1');
        Route::get('finance/{kind}', [FinanceConfigurationController::class, 'index'])->whereIn('kind', ['emi-providers', 'emi-plans', 'product-emi-plans', 'flash-sales', 'flash-sale-products']);
        Route::post('finance/{kind}', [FinanceConfigurationController::class, 'store'])->whereIn('kind', ['emi-providers', 'emi-plans', 'product-emi-plans', 'flash-sales', 'flash-sale-products']);
        Route::put('finance/{kind}/{record}', [FinanceConfigurationController::class, 'update'])->whereIn('kind', ['emi-providers', 'emi-plans', 'product-emi-plans', 'flash-sales', 'flash-sale-products'])->whereUuid('record');
        Route::post('auth/logout', [AdminAuthController::class, 'logout']);
        Route::get('auth/me', [AdminAuthController::class, 'me']);

        Route::get('banners', [BannerController::class, 'index']);
        Route::post('banners', [BannerController::class, 'store']);
        Route::get('banners/{banner}', [BannerController::class, 'show'])->whereUuid('banner');
        Route::put('banners/{banner}', [BannerController::class, 'update'])->whereUuid('banner');
        Route::delete('banners/{banner}', [BannerController::class, 'destroy'])->whereUuid('banner');
        Route::get('media', [MediaController::class, 'index']);
        Route::post('media', [MediaController::class, 'store']);
        Route::get('category-faqs', [CategoryFaqController::class, 'index']);
        Route::post('category-faqs', [CategoryFaqController::class, 'store']);
        Route::put('category-faqs/{faq}', [CategoryFaqController::class, 'update'])->whereUuid('faq');
        Route::delete('category-faqs/{faq}', [CategoryFaqController::class, 'destroy'])->whereUuid('faq');
        Route::get('shop-benefits', [ShopBenefitController::class, 'index']);
        Route::post('shop-benefits', [ShopBenefitController::class, 'store']);
        Route::put('shop-benefits/{benefit}', [ShopBenefitController::class, 'update'])->whereUuid('benefit');
        Route::delete('shop-benefits/{benefit}', [ShopBenefitController::class, 'destroy'])->whereUuid('benefit');

        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/abandoned', [OrderController::class, 'abandoned']);
        Route::get('orders/{order}', [OrderController::class, 'show'])->whereUuid('order');
        Route::put('orders/{order}/warehouse', [OrderController::class, 'allocate'])->whereUuid('order');
        Route::post('orders/{order}/reserve', [OrderController::class, 'reserve'])->whereUuid('order');
        Route::post('orders/{order}/status', [OrderController::class, 'updateStatus'])->whereUuid('order');
        Route::post('orders/{order}/payments/{payment}/status', [OrderController::class, 'updatePaymentStatus'])
            ->whereUuid('order')->whereUuid('payment');
        Route::post('orders/{order}/shipments/{shipment}/status', [OrderController::class, 'updateShipmentStatus'])
            ->whereUuid('order')->whereUuid('shipment');

        Route::get('brands', [CatalogMasterController::class, 'index'])->defaults('master', 'brands');
        Route::post('brands', [CatalogMasterController::class, 'store'])->defaults('master', 'brands');
        Route::put('brands/{record}', [CatalogMasterController::class, 'update'])->defaults('master', 'brands');

        Route::get('product-types', [CatalogMasterController::class, 'index'])->defaults('master', 'product-types');
        Route::post('product-types', [CatalogMasterController::class, 'store'])->defaults('master', 'product-types');
        Route::put('product-types/{record}', [CatalogMasterController::class, 'update'])->defaults('master', 'product-types');

        Route::get('categories', [CatalogMasterController::class, 'index'])->defaults('master', 'categories');
        Route::post('categories', [CatalogMasterController::class, 'store'])->defaults('master', 'categories');
        Route::put('categories/{record}', [CatalogMasterController::class, 'update'])->defaults('master', 'categories');
        Route::get('categories/{category}/comparison-specifications', [CategoryComparisonController::class, 'index'])->whereUuid('category');
        Route::put('categories/{category}/comparison-specifications', [CategoryComparisonController::class, 'update'])->whereUuid('category');
        Route::get('categories/{category}/listings', [CategoryListingController::class, 'index'])->whereUuid('category');
        Route::post('categories/{category}/listings', [CategoryListingController::class, 'store'])->whereUuid('category');
        Route::put('categories/{category}/listings/{listing}', [CategoryListingController::class, 'update'])
            ->whereUuid('category')->whereUuid('listing');

        Route::get('hsn-codes', [HsnCodeController::class, 'index']);
        Route::post('hsn-codes', [HsnCodeController::class, 'store']);
        Route::put('hsn-codes/{hsnCode}', [HsnCodeController::class, 'update']);

        Route::get('products', [ProductController::class, 'index']);
        Route::get('product-offers', [ProductOfferController::class, 'index']);
        Route::post('product-offers', [ProductOfferController::class, 'store']);
        Route::put('product-offers/{offer}', [ProductOfferController::class, 'update'])->whereUuid('offer');
        Route::delete('product-offers/{offer}', [ProductOfferController::class, 'destroy'])->whereUuid('offer');
        Route::get('products/export', [ProductController::class, 'export']);
        Route::post('products', [ProductController::class, 'store']);
        Route::get('products/{product}', [ProductController::class, 'show']);
        Route::put('products/{product}', [ProductController::class, 'update']);
        Route::get('attributes', [AttributeController::class, 'index']);
        Route::post('attributes', [AttributeController::class, 'store']);
        Route::put('attributes/{attribute}', [AttributeController::class, 'update']);
        Route::get('products/{product}/attributes', [ProductSpecificationController::class, 'index']);
        Route::post('products/{product}/attributes', [ProductSpecificationController::class, 'store']);
        Route::put('products/{product}/attributes/{productAttribute}', [ProductSpecificationController::class, 'update']);
        Route::delete('products/{product}/attributes/{productAttribute}', [ProductSpecificationController::class, 'destroy']);
        Route::get('products/{product}/highlights', [ProductSpecificationController::class, 'highlights']);
        Route::put('products/{product}/highlights', [ProductSpecificationController::class, 'replaceHighlights']);
        Route::delete('products/{product}', [ProductController::class, 'destroy']);
        Route::post('products/{product}/images', [ProductController::class, 'storeImage']);
        Route::put('products/{product}/images/{image}', [ProductController::class, 'updateImage'])->whereUuid('image');
        Route::post('products/{product}/images/{image}/replace', [ProductController::class, 'replaceImage'])->whereUuid('image');
        Route::delete('products/{product}/images/{image}', [ProductController::class, 'destroyImage'])->whereUuid('image');

        Route::get('combos', [ComboController::class, 'index']);
        Route::get('merchandising/{placement}', [MerchandisingController::class, 'index']);
        Route::get('merchandising/{placement}/eligible-products', [MerchandisingController::class, 'eligible']);
        Route::post('merchandising/{placement}/products', [MerchandisingController::class, 'store']);
        Route::put('merchandising/{placement}/products/{product}', [MerchandisingController::class, 'update']);
        Route::delete('merchandising/{placement}/products/{product}', [MerchandisingController::class, 'destroy']);
        Route::post('combos', [ComboController::class, 'store']);
        Route::put('combos/{combo}', [ComboController::class, 'update']);

        Route::get('warehouses', [WarehouseController::class, 'index']);
        Route::get('warehouse-stocks', [WarehouseStockController::class, 'index']);
        Route::get('stock-movements', [WarehouseStockController::class, 'movements']);
        Route::post('warehouses', [WarehouseController::class, 'store']);
        Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update']);
        Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy']);
        Route::get('warehouses/{warehouse}/products/{product}/stock', [WarehouseStockController::class, 'show'])->withTrashed();
        Route::put('warehouses/{warehouse}/products/{product}/stock', [WarehouseStockController::class, 'update']);
    });
});
