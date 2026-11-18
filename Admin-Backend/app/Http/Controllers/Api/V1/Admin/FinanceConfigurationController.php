<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinanceConfigurationRequest;
use App\Models\EmiPlan;
use App\Models\EmiProvider;
use App\Models\FlashSale;
use App\Models\FlashSaleProduct;
use App\Models\ProductEmiPlan;
use App\Services\EmiEnquiryDelivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceConfigurationController extends Controller
{
    public function deliveryStatus(Request $request, EmiEnquiryDelivery $delivery): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);

        return response()->json(['data' => ['configuration_issue' => $delivery->configurationIssue()]])->header('Cache-Control', 'no-store');
    }

    private const MODELS = ['emi-providers' => EmiProvider::class, 'emi-plans' => EmiPlan::class,
        'product-emi-plans' => ProductEmiPlan::class, 'flash-sales' => FlashSale::class, 'flash-sale-products' => FlashSaleProduct::class];

    public function index(Request $request, string $kind): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);
        $input = $request->validate(['page' => ['sometimes', 'integer', 'min:1'], 'search' => ['sometimes', 'nullable', 'string', 'max:100']]);
        $query = self::MODELS[$kind]::query();
        $relations = match ($kind) {
            'emi-plans' => ['provider:id,name'], 'product-emi-plans' => ['product:id,name', 'plan.provider:id,name'],
            'flash-sale-products' => ['product:id,name', 'sale:id,name'], default => [],
        };
        $query->with($relations);
        if ($search = $input['search'] ?? null) {
            if (in_array($kind, ['emi-providers', 'flash-sales'], true)) {
                $query->where('name', 'like', '%'.$search.'%');
            } elseif ($kind === 'emi-plans') {
                $query->whereHas('provider', fn ($q) => $q->where('name', 'like', '%'.$search.'%'));
            } else {
                $query->whereHas('product', fn ($q) => $q->where('name', 'like', '%'.$search.'%')->orWhere('sku', 'like', '%'.$search.'%'));
            }
        }

        return response()->json($query->orderBy('id')->paginate(20))->header('Cache-Control', 'no-store');
    }

    public function store(FinanceConfigurationRequest $request, string $kind): JsonResponse
    {
        $record = self::MODELS[$kind]::query()->create($request->validated());

        return response()->json(['data' => $record->refresh()], 201);
    }

    public function update(FinanceConfigurationRequest $request, string $kind, string $record): JsonResponse
    {
        $model = self::MODELS[$kind]::query()->findOrFail($record);
        $model->update($request->validated());

        return response()->json(['data' => $model->refresh()]);
    }
}
