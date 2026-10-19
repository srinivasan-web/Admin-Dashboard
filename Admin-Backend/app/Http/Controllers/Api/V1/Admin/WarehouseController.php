<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\DeleteWarehouse;
use App\Http\Controllers\Controller;
use App\Http\Requests\SaveWarehouseRequest;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;

class WarehouseController extends Controller
{
    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->hasPermission('inventory.manage'), 403);

        return response()->json(['data' => Warehouse::query()->orderBy('name')->get(['id', 'name', 'address', 'city', 'state', 'postal_code', 'latitude', 'longitude'])]);
    }

    public function store(SaveWarehouseRequest $request): JsonResponse
    {
        $warehouse = Warehouse::query()->create($request->validated());

        return response()->json(['data' => $warehouse->only(['id', 'name', 'address', 'city', 'state', 'postal_code', 'latitude', 'longitude'])], 201);
    }

    public function update(SaveWarehouseRequest $request, Warehouse $warehouse): JsonResponse
    {
        $warehouse->update($request->validated());

        return response()->json(['data' => $warehouse->fresh()->only(['id', 'name', 'address', 'city', 'state', 'postal_code', 'latitude', 'longitude'])]);
    }

    public function destroy(Warehouse $warehouse, DeleteWarehouse $deleteWarehouse): JsonResponse
    {
        $this->authorize('update', $warehouse);
        $deleteWarehouse->execute($warehouse);

        return response()->json(['data' => null]);
    }
}
