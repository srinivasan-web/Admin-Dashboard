<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryFaqRequest;
use App\Http\Resources\CategoryFaqResource;
use App\Models\CategoryFaq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryFaqController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', CategoryFaq::class);
        $filters = $request->validate([
            'category_id' => ['sometimes', 'nullable', 'uuid', 'exists:categories,id'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return CategoryFaqResource::collection(CategoryFaq::query()
            ->when(array_key_exists('category_id', $filters), fn ($query) => $filters['category_id']
                ? $query->where('category_id', $filters['category_id'])
                : $query->whereNull('category_id'))
            ->orderBy('sort_order')->orderBy('id')->paginate(20));
    }

    public function store(CategoryFaqRequest $request): JsonResponse
    {
        return (new CategoryFaqResource(CategoryFaq::query()->create($request->validated())))
            ->response()->setStatusCode(201);
    }

    public function update(CategoryFaqRequest $request, CategoryFaq $faq): CategoryFaqResource
    {
        $faq->update($request->validated());

        return new CategoryFaqResource($faq->refresh());
    }

    public function destroy(CategoryFaq $faq): JsonResponse
    {
        $this->authorize('delete', $faq);
        $faq->delete();

        return response()->json(['data' => null]);
    }
}
