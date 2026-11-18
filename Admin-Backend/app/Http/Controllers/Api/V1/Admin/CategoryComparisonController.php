<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\SaveCategoryComparison;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateCategoryComparisonRequest;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryComparisonController extends Controller
{
    public function index(Request $request, Category $category): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);

        return $this->response($category);
    }

    public function update(UpdateCategoryComparisonRequest $request, Category $category, SaveCategoryComparison $action): JsonResponse
    {
        $action->execute($category, $request->validated('specifications'));

        return $this->response($category);
    }

    private function response(Category $category): JsonResponse
    {
        $rows = $category->specifications()->where('is_comparable', true)
            ->with('attribute:id,name,unit,is_active')
            ->orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => $rows->map(fn ($row) => [
            'attribute_id' => $row->attribute_id,
            'attribute_name' => $row->attribute?->name,
            'attribute_active' => (bool) $row->attribute?->is_active,
            'unit' => $row->attribute?->unit,
            'label' => $row->label,
            'sort_order' => $row->sort_order,
            'is_active' => $row->is_active,
        ])->values()]);
    }
}
