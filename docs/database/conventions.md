# Proposed conventions

These are **[TECHNICAL DECISION]** conventions for a future Laravel/MySQL base project, not existing repository conventions.

- Laravel-standard plural snake_case table names and singular PascalCase models. `users.id`, `roles.id`, and `permissions.id` use UUID primary keys; a foreign key to either must use the matching UUID type. Other tables retain their explicitly chosen natural keys or await an approved key strategy. **[TECHNICAL DECISION]**
- Permission `name` uses a unique `resource.action` key (for example, `product.view`); this is a design convention, not a PDF-defined permission catalogue. **[TECHNICAL DECISION]**
- `created_at` and `updated_at` on mutable records; `created_by`/`updated_by` only where the PDF exposes actor information (banners, coupons, operational records). **[TECHNICAL DECISION]**
- Use `decimal(12,2)` for displayed rupee values and percentages as decimal values; never floating point. **[TECHNICAL DECISION]**
- Use `is_active` for screens that explicitly display Active/Inactive; use separate constrained status values where the PDF names a workflow status. **[TECHNICAL DECISION]**
- Store file metadata outside business rows. `media` has a unique disk/path storage location; explicit attachment tables (currently `product_images`) own business relationships rather than a polymorphic owner. **[TECHNICAL DECISION]**
- Enforce unique, indexed identifiers where approved: product SKU; product-type/category slugs; HSN code when present. Product slugs, coupon code, and invoice/order identifiers remain **[CONFIRMATION REQUIRED]**.
- Keep order item, price, tax, address, payment and logistics facts historically stable; exact snapshot policy is **[CONFIRMATION REQUIRED]**.
- Do not use PHP enums or database enums until Laravel/MySQL versions and administrator-editable value policy are decided. **[TECHNICAL DECISION]**
