<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $type = match ($this->movement_type) {
            'RESERVATION_CREATED' => 'RESERVE', 'RESERVATION_RELEASED' => 'RELEASE',
            'ORDER_COMMITTED' => 'COMMIT', 'CANCELLATION_RESTORE' => 'RESTORE',
            default => $this->movement_type,
        };

        return [
            'id' => $this->id, 'movement_type' => $type,
            'quantity_delta' => $this->quantity_delta, 'quantity' => $this->quantity,
            'reservation_delta' => $type === 'RESERVE' ? $this->quantity : (in_array($type, ['RELEASE', 'COMMIT'], true) ? -$this->quantity : 0),
            'product' => $this->warehouseStock?->product?->only(['id', 'name', 'sku']),
            'warehouse' => $this->warehouseStock?->warehouse?->only(['id', 'name']),
            'order_id' => $this->order_id, 'order_number' => $this->order?->order_number,
            'order_item_id' => $this->order_item_id,
            'reference' => $this->reference_type ? $this->reference_type.':'.$this->reference_id : null,
            'idempotency_key' => $this->idempotency_key,
            'created_by' => $this->createdBy?->only(['id', 'name']),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
