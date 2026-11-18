<?php

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'brand_id', 'category_id', 'product_type_id', 'hsn_code_id', 'name', 'group_name',
    'sku', 'mrp_price', 'sale_price', 'tag', 'sort_order', 'is_active',
    'is_trade_product', 'description', 'slug', 'short_description',
])]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'mrp_price' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'is_active' => 'boolean',
            'is_trade_product' => 'boolean',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return HasMany<CategoryProductListing, $this> */
    public function categoryListingPlacements(): HasMany
    {
        return $this->hasMany(CategoryProductListing::class);
    }

    /** @return BelongsTo<ProductType, $this> */
    public function productType(): BelongsTo
    {
        return $this->belongsTo(ProductType::class);
    }

    /** @return BelongsTo<HsnCode, $this> */
    public function hsnCode(): BelongsTo
    {
        return $this->belongsTo(HsnCode::class);
    }

    /** @return HasMany<ProductImage, $this> */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class);
    }

    /** @return HasMany<ProductDetail, $this> */
    public function details(): HasMany
    {
        return $this->hasMany(ProductDetail::class);
    }

    /** @return \Illuminate\Database\Eloquent\Relations\HasOne<ProductAdditionalDetail, $this> */
    public function additionalDetails(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(ProductAdditionalDetail::class);
    }

    /** @return HasMany<ProductAdditionalBenefit, $this> */
    public function benefits(): HasMany
    {
        return $this->hasMany(ProductAdditionalBenefit::class);
    }

    /** @return HasMany<ProductVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function productAttributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class);
    }

    public function highlights(): HasMany
    {
        return $this->hasMany(ProductHighlight::class);
    }

    /** @return HasMany<ProductPrice, $this> */
    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }

    public function emiPlans(): HasMany
    {
        return $this->hasMany(ProductEmiPlan::class);
    }

    public function flashSaleProducts(): HasMany
    {
        return $this->hasMany(FlashSaleProduct::class);
    }

    /** @return HasMany<WarehouseStock, $this> */
    public function warehouseStocks(): HasMany
    {
        return $this->hasMany(WarehouseStock::class);
    }

    /** @return HasMany<OrderItem, $this> */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** @return BelongsToMany<Combo, $this, ComboItem> */
    public function combos(): BelongsToMany
    {
        return $this->belongsToMany(Combo::class, 'combo_items')
            ->using(ComboItem::class)
            ->withPivot(['id', 'quantity'])
            ->withTimestamps();
    }

    /** @return BelongsToMany<MerchandisingSection, $this, MerchandisingProduct> */
    public function merchandisingSections(): BelongsToMany
    {
        return $this->belongsToMany(MerchandisingSection::class, 'merchandising_products', 'product_id', 'section_id')
            ->using(MerchandisingProduct::class)
            ->withPivot(['id', 'sort_order', 'is_active'])
            ->withTimestamps();
    }
}
