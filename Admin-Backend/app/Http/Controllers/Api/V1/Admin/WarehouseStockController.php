<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\SetWarehouseStock;
use App\Http\Controllers\Controller;
use App\Http\Requests\ListInventoryRequest;
use App\Http\Requests\SetWarehouseStockRequest;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\StockReservation;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class WarehouseStockController extends Controller
{
    public function index(ListInventoryRequest $request): JsonResponse
    {
        $data = $request->validated();
        if (($data['view'] ?? null) === 'matrix') {
            $products = Product::query()->select(['id', 'name', 'sku'])
                ->with(['warehouseStocks' => fn ($query) => $query
                    ->select(['id', 'warehouse_id', 'product_id', 'quantity', 'reserved_quantity'])
                    ->when($data['warehouse_id'] ?? null, fn ($query, $id) => $query->where('warehouse_id', $id))]);
            if (! empty($data['search'])) {
                $search = $data['search'];
                $products->where(fn ($query) => $query->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"));
            }
            $page = $products->orderBy('name')->orderBy('id')->paginate($data['per_page'] ?? 20);
            $page->setCollection($page->getCollection()->map(fn ($product) => [
                'id' => $product->id, 'name' => $product->name, 'sku' => $product->sku,
                'warehouses' => $product->warehouseStocks->map(fn ($stock) => [
                    'warehouse_id' => $stock->warehouse_id,
                    'available' => $stock->available_quantity,
                ])->values(),
            ]));

            return response()->json($page);
        }
        $query = WarehouseStock::query()->with(['warehouse', 'product' => fn ($query) => $query->withTrashed()]);
        $query->when($data['warehouse_id'] ?? null, fn ($query, $id) => $query->where('warehouse_id', $id))
            ->when($data['product_id'] ?? null, fn ($query, $id) => $query->where('product_id', $id))
            ->when($data['search'] ?? null, fn ($query, $search) => $query->whereHas('product', fn ($products) => $products->withTrashed()->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"))));
        $page = $query->orderBy('warehouse_id')->orderBy('product_id')->paginate($data['per_page'] ?? 20);
        $page->setCollection($page->getCollection()->map(fn ($stock) => [
            'id' => $stock->id, 'product' => $stock->product?->only(['id', 'name', 'sku']),
            'warehouse' => $stock->warehouse?->only(['id', 'name']), 'physical' => $stock->quantity,
            'reserved' => $stock->reserved_quantity, 'available' => $stock->available_quantity,
        ]));

        return response()->json($page);
    }

    public function movements(ListInventoryRequest $request)
    {
        $data = $request->validated();
        $types = ['RESERVE' => ['RESERVE', 'RESERVATION_CREATED'], 'RELEASE' => ['RELEASE', 'RESERVATION_RELEASED'],
            'COMMIT' => ['COMMIT', 'ORDER_COMMITTED'], 'RESTORE' => ['RESTORE', 'CANCELLATION_RESTORE']];
        $query = StockMovement::query()->with(['warehouseStock.warehouse', 'warehouseStock.product' => fn ($q) => $q->withTrashed(), 'order', 'createdBy']);
        foreach (['warehouse_id', 'product_id'] as $field) {
            if (! empty($data[$field])) {
                $query->whereHas('warehouseStock', fn ($q) => $q->where($field, $data[$field]));
            }
        }
        if (! empty($data['movement_type'])) {
            $query->whereIn('movement_type', $types[$data['movement_type']] ?? [$data['movement_type']]);
        }
        if (! empty($data['order'])) {
            $query->whereHas('order', fn ($q) => $q->where('order_number', 'like', '%'.$data['order'].'%'));
        }
        if (! empty($data['search'])) {
            $query->whereHas('warehouseStock.product', fn ($q) => $q->withTrashed()->where(fn ($q) => $q->where('name', 'like', '%'.$data['search'].'%')->orWhere('sku', 'like', '%'.$data['search'].'%')));
        }
        if (! empty($data['date_from'])) {
            $query->where('created_at', '>=', CarbonImmutable::parse($data['date_from'])->format('Y-m-d 00:00:00'));
        }
        if (! empty($data['date_to'])) {
            $query->where('created_at', '<', CarbonImmutable::parse($data['date_to'])->addDay()->format('Y-m-d 00:00:00'));
        }

        return StockMovementResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate($data['per_page'] ?? 20));
    }

    public function show(Warehouse $warehouse, Product $product, Request $request): JsonResponse
    {
        $this->authorize('update', $warehouse);
        $request->validate([
            'include_history' => ['sometimes', 'boolean'],
            'history_page' => ['sometimes', 'integer', 'min:1'],
            'history_per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $includeHistory = $request->boolean('include_history', true);
        $historyPage = $request->integer('history_page', 1);
        $historyPerPage = $request->integer('history_per_page', 50);

        $stock = WarehouseStock::query()
            ->whereBelongsTo($warehouse)
            ->whereBelongsTo($product)
            ->first();
        $movements = $includeHistory && $stock ? $stock->movements()
            ->with('createdBy')->orderByDesc('created_at')->orderByDesc('id')
            ->simplePaginate($historyPerPage, ['*'], 'history_page', $historyPage) : null;
        $reservations = $includeHistory ? StockReservation::query()
            ->where('warehouse_id', $warehouse->id)->where('product_id', $product->id)
            ->with('order')->orderByDesc('reserved_at')->orderByDesc('id')
            ->simplePaginate($historyPerPage, ['*'], 'history_page', $historyPage) : null;

        return response()->json(['data' => [
            'reservations' => $reservations ? $reservations->getCollection()->map(fn ($reservation) => [
                    'id' => $reservation->id, 'order_number' => $reservation->order?->order_number,
                    'quantity' => $reservation->quantity, 'status' => $reservation->status,
                    'expires_at' => $reservation->expires_at?->toISOString(),
                    'reserved_at' => $reservation->reserved_at?->toISOString(), 'committed_at' => $reservation->committed_at?->toISOString(),
                    'released_at' => $reservation->released_at?->toISOString(), 'restored_at' => $reservation->restored_at?->toISOString(),
                ])->all() : [],
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'quantity' => $stock?->quantity ?? 0,
            'reserved_quantity' => $stock?->reserved_quantity ?? 0,
            'available_quantity' => $stock?->available_quantity ?? 0,
            'movements' => $movements ? $this->movementRows($movements->getCollection()) : [],
            'history' => $includeHistory ? [
                'page' => $historyPage,
                'per_page' => $historyPerPage,
                'movements_has_more' => $movements?->hasMorePages() ?? false,
                'reservations_has_more' => $reservations?->hasMorePages() ?? false,
            ] : null,
        ]]);
    }

    public function update(Warehouse $warehouse, Product $product, SetWarehouseStockRequest $request, SetWarehouseStock $setWarehouseStock): JsonResponse
    {
        $this->authorize('update', $warehouse);

        try {
            $stock = $setWarehouseStock->execute(
                $warehouse,
                $product,
                $request->integer('quantity'),
                $request->string('operation', 'adjustment')->toString(),
                $request->user(),
                $request->validated('idempotency_key'),
            );
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['quantity' => [$exception->getMessage()]]);
        }

        $includeHistory = $request->boolean('include_history', true);
        $historyPage = $request->integer('history_page', 1);
        $historyPerPage = $request->integer('history_per_page', 50);
        $movements = $includeHistory ? $stock->movements()
            ->with('createdBy')->orderByDesc('created_at')->orderByDesc('id')
            ->simplePaginate($historyPerPage, ['*'], 'history_page', $historyPage) : null;

        return response()->json(['data' => [
            'id' => $stock->id,
            'warehouse_id' => $stock->warehouse_id,
            'product_id' => $stock->product_id,
            'quantity' => $stock->quantity,
            'reserved_quantity' => $stock->reserved_quantity,
            'available_quantity' => $stock->available_quantity,
            'movements' => $movements ? $this->movementRows($movements->getCollection()) : [],
            'history' => $includeHistory ? [
                'page' => $historyPage,
                'per_page' => $historyPerPage,
                'movements_has_more' => $movements?->hasMorePages() ?? false,
            ] : null,
        ]]);
    }

    /** @param Collection<int, StockMovement> $movements */
    private function movementRows(Collection $movements): array
    {
        return $movements->map(fn ($movement) => [
            'id' => $movement->id,
            'movement_type' => $movement->movement_type,
            'quantity_delta' => $movement->quantity_delta,
            'quantity' => $movement->quantity,
            'order_id' => $movement->order_id,
            'order_item_id' => $movement->order_item_id,
            'idempotency_key' => $movement->idempotency_key,
            'created_at' => $movement->created_at?->toISOString(),
            'created_by' => $movement->createdBy?->only(['id', 'name']),
        ])->all();
    }
}
