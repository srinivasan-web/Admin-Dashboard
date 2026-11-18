<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\SubmitEmiEnquiry;
use App\Domain\Orders\OrderMoney;
use App\Http\Controllers\Controller;
use App\Http\Requests\ProductEmiRequest;
use App\Services\ProductPurchaseQuote;
use Illuminate\Http\JsonResponse;

class ProductFinanceController extends Controller
{
    public function show(ProductEmiRequest $request, string $product, ProductPurchaseQuote $service): JsonResponse
    {
        $variant = $request->validated('variant_id');
        $item = $service->product($product, $variant);
        $price = $service->price($item);
        $principal = OrderMoney::toMinorUnits($price['selling_price'], 'Principal');
        $plans = $service->eligiblePlans($item, $principal, $variant)->limit(60)->get()
            ->unique('emi_plan_id')->map(fn ($assignment) => $service->calculate($assignment->plan, $principal))->values();

        return response()->json(['data' => ['product_id' => $item->id, 'price' => $price, 'plans' => $plans]])
            ->header('Cache-Control', 'no-store');
    }

    public function calculate(ProductEmiRequest $request, string $product, ProductPurchaseQuote $service): JsonResponse
    {
        $item = $service->product($product, $request->validated('variant_id'));

        return response()->json(['data' => $service->selected($item, $request->validated('plan_id'), $request->validated('variant_id'))])
            ->header('Cache-Control', 'no-store');
    }

    public function enquiry(ProductEmiRequest $request, string $product, SubmitEmiEnquiry $submit): JsonResponse
    {
        $record = $submit->execute($product, $request->validated());

        return response()->json(['data' => ['id' => $record->id, 'message' => 'Your EMI enquiry has been recorded.']], 201)
            ->header('Cache-Control', 'no-store');
    }
}
