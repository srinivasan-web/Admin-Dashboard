<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\AllocateOrderWarehouse;
use App\Actions\ReserveOrderStock;
use App\Actions\TransitionOrderPayment;
use App\Actions\TransitionOrderShipment;
use App\Actions\TransitionOrderStatus;
use App\Domain\Orders\OrderStatusConflict;
use App\Http\Controllers\Controller;
use App\Http\Requests\ListOrdersRequest;
use App\Http\Requests\OrderInventoryRequest;
use App\Http\Requests\UpdateOrderPaymentStatusRequest;
use App\Http\Requests\UpdateOrderShipmentStatusRequest;
use App\Http\Requests\UpdateOrderStatusRequest;
use App\Http\Resources\OrderListResource;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Shipment;
use App\Models\Warehouse;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class OrderController extends Controller
{
    public function index(ListOrdersRequest $request): AnonymousResourceCollection
    {
        return $this->listing($request);
    }

    public function abandoned(ListOrdersRequest $request): AnonymousResourceCollection
    {
        // Existing domain status is explicit; pending carts do not qualify.
        return $this->listing($request, 'abandoned');
    }

    public function show(Order $order): OrderResource
    {
        $this->authorize('view', $order);

        return new OrderResource($order->load($this->detailRelations()));
    }

    public function allocate(OrderInventoryRequest $request, Order $order, AllocateOrderWarehouse $allocate): OrderResource
    {
        try {
            $warehouseId = $request->validated()['warehouse_id'] ?? null;
            $allocate->execute($order, $warehouseId ? Warehouse::query()->findOrFail($warehouseId) : null, $request->user());
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['warehouse_id' => $exception->getMessage()]);
        }

        return new OrderResource($order->fresh()->load($this->detailRelations()));
    }

    public function reserve(OrderInventoryRequest $request, Order $order, ReserveOrderStock $reserve): OrderResource
    {
        try {
            $reserve->execute($order, $request->user());
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['inventory' => $exception->getMessage()]);
        }

        return new OrderResource($order->fresh()->load($this->detailRelations()));
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order, TransitionOrderStatus $transition): OrderResource|JsonResponse
    {
        $data = $request->validated();

        try {
            $updated = $transition->execute(
                $order,
                orderStatus: $data['status'],
                changedBy: $request->user(),
                expectedOrderStatus: $data['current_status'],
            );
        } catch (OrderStatusConflict $exception) {
            return response()->json(['error' => [
                'code' => 'order.status_conflict',
                'message' => $exception->getMessage(),
            ]], 409);
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['status' => [$exception->getMessage()]]);
        }

        return new OrderResource($updated->load($this->detailRelations()));
    }

    public function updatePaymentStatus(UpdateOrderPaymentStatusRequest $request, Order $order, Payment $payment, TransitionOrderPayment $transition): OrderResource
    {
        try {
            $transition->execute($order, $payment, $request->validated('status'), $request->user());
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['status' => [$exception->getMessage()]]);
        }

        return new OrderResource($order->fresh()->load($this->detailRelations()));
    }

    public function updateShipmentStatus(UpdateOrderShipmentStatusRequest $request, Order $order, Shipment $shipment, TransitionOrderShipment $transition): OrderResource
    {
        try {
            $transition->execute($order, $shipment, $request->validated('status'));
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['status' => [$exception->getMessage()]]);
        }

        return new OrderResource($order->fresh()->load($this->detailRelations()));
    }

    private function listing(ListOrdersRequest $request, ?string $forcedStatus = null): AnonymousResourceCollection
    {
        $data = $request->validated();
        $query = Order::query()->with([
            'customer' => fn ($customer) => $customer->withTrashed(),
            'warehouse',
        ]);

        $search = trim($data['search'] ?? '');
        if ($search !== '') {
            $query->where(function (Builder $orders) use ($search): void {
                $orders->where('order_number', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn (Builder $customers) => $customers->withTrashed()
                        ->where(function (Builder $customer) use ($search): void {
                            $customer->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%")
                                ->orWhere('phone', 'like', "%{$search}%");
                        }));
            });
        }

        $status = $forcedStatus ?? ($data['status'] ?? null);
        if ($status === 'pending') {
            $query->whereIn('status', ['pending', 'PENDING_PAYMENT']);
        } elseif ($status !== null) {
            $query->where('status', $status);
        }
        $paymentStatus = $data['payment_status'] ?? null;
        if ($paymentStatus === 'pending') {
            $query->whereIn('payment_status', ['pending', 'PENDING']);
        } elseif ($paymentStatus !== null) {
            $query->where('payment_status', $paymentStatus);
        }
        $query->when($data['date_from'] ?? null, fn (Builder $orders, string $date) => $orders->where('placed_at', '>=', $date.' 00:00:00'))
            ->when($data['date_to'] ?? null, fn (Builder $orders, string $date) => $orders->where('placed_at', '<', CarbonImmutable::parse($date)->addDay()->format('Y-m-d 00:00:00')))
            ->orderBy($data['sort'] ?? 'placed_at', $data['direction'] ?? 'desc')
            ->orderBy('id', 'desc');

        return OrderListResource::collection($query->paginate($data['per_page'] ?? 20)->withQueryString());
    }

    /** @return array<int|string, mixed> */
    private function detailRelations(): array
    {
        return [
            'customer' => fn ($customer) => $customer->withTrashed(),
            'warehouse', 'billingAddress', 'shippingAddress', 'items',
            'payments' => fn ($payments) => $payments->orderBy('created_at')->orderBy('id'),
            'shipments' => fn ($shipments) => $shipments->with('warehouse')->orderBy('created_at')->orderBy('id'),
            'stockReservations' => fn ($reservations) => $reservations->orderBy('created_at')->orderBy('id'),
            'statusHistories' => fn ($history) => $history->orderBy('created_at')->orderBy('id'),
        ];
    }
}
