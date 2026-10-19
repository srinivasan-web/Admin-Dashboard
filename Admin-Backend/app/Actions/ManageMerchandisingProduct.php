<?php

namespace App\Actions;

use App\Models\MerchandisingSection;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManageMerchandisingProduct
{
    /** @param array{product_id: string, sort_order?: int, is_active?: bool} $data */
    public function add(string $placement, array $data): MerchandisingSection
    {
        return DB::transaction(function () use ($placement, $data): MerchandisingSection {
            $section = MerchandisingSection::query()->firstOrCreate(
                ['slug' => $placement],
                ['name' => $placement === 'featured' ? 'Featured Products' : 'Explore Bestsellers', 'type' => $placement],
            );
            $section = MerchandisingSection::query()->lockForUpdate()->findOrFail($section->id);
            $product = Product::query()->with(['category', 'productType'])->findOrFail($data['product_id']);

            if (! $product->is_active || ! $product->category->is_active || ! $product->productType->is_active) {
                throw ValidationException::withMessages(['product_id' => ['Product and its classification must be active.']]);
            }

            if ($section->products()->whereKey($product->id)->exists()) {
                throw ValidationException::withMessages(['product_id' => ['Product is already assigned to this placement.']]);
            }

            $section->products()->attach($product->id, [
                'sort_order' => $data['sort_order'] ?? 0,
                'is_active' => $data['is_active'] ?? true,
            ]);

            return $section;
        });
    }

    /** @param array{sort_order?: int, is_active?: bool} $data */
    public function update(MerchandisingSection $section, Product $product, array $data): void
    {
        DB::transaction(function () use ($section, $product, $data): void {
            $section = MerchandisingSection::query()->lockForUpdate()->findOrFail($section->id);
            $this->ensureAssigned($section, $product);
            if (($data['is_active'] ?? false) && (! $product->is_active || ! $product->category->is_active || ! $product->productType->is_active)) {
                throw ValidationException::withMessages(['is_active' => ['Inactive products cannot be activated in a placement.']]);
            }
            $section->products()->updateExistingPivot($product->id, $data);
        });
    }

    public function remove(MerchandisingSection $section, Product $product): void
    {
        DB::transaction(function () use ($section, $product): void {
            $section = MerchandisingSection::query()->lockForUpdate()->findOrFail($section->id);
            $this->ensureAssigned($section, $product);
            $section->products()->detach($product->id);
        });
    }

    private function ensureAssigned(MerchandisingSection $section, Product $product): void
    {
        abort_unless($section->products()->whereKey($product->id)->exists(), 404);
    }
}
