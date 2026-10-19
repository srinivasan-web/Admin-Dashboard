<?php

namespace App\Actions;

use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeleteWarehouse
{
    public function execute(Warehouse $warehouse): void
    {
        DB::transaction(function () use ($warehouse): void {
            $locked = Warehouse::query()->lockForUpdate()->findOrFail($warehouse->getKey());

            if ($locked->stocks()->exists() || $locked->orders()->exists()) {
                throw ValidationException::withMessages([
                    'warehouse' => ['This warehouse has stock records or orders and cannot be deleted.'],
                ]);
            }

            $locked->delete();
        });
    }
}
