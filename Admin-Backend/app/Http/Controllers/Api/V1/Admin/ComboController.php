<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\SaveCombo;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreComboRequest;
use App\Http\Requests\UpdateComboRequest;
use App\Http\Resources\ComboResource;
use App\Models\Combo;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ComboController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        abort_unless(request()->user()?->hasPermission('catalog.manage'), 403);

        return ComboResource::collection(Combo::query()->with('products:id,name,sku')->orderBy('name')->get());
    }

    public function store(StoreComboRequest $request, SaveCombo $saveCombo): ComboResource
    {
        return new ComboResource($saveCombo->execute($request->validated()));
    }

    public function update(Combo $combo, UpdateComboRequest $request, SaveCombo $saveCombo): ComboResource
    {
        return new ComboResource($saveCombo->execute($request->validated(), $combo));
    }
}
