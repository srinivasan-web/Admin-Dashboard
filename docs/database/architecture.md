# Database architecture assessment

## Scope and evidence

The repository is empty: no Laravel/PHP project, `.env`, Composer manifest, migrations, models, routes, controllers, services, authentication, frontend, or tests exist. Therefore Laravel/PHP/MySQL versions and repository conventions are **[CONFIRMATION REQUIRED]**. No existing schema conflicts or duplicate database concepts were found.

The source is the 46-page `Admin - Mapping.pdf`, visually inspected in full. It maps an authenticated Durafit admin interface; it does not specify a Laravel or database implementation.

## Proposed bounded domains

| Domain | Purpose | Source |
| --- | --- | --- |
| Identity | Admin users, standalone role definitions, and ownership/audit references | **[TECHNICAL DECISION]**; PDF displays current user and created/updated-by labels |
| Customer | A standalone commerce/CRM identity for the customer name, phone, and email shown in sales and warranty workflows; it is not an admin User. | **[PDF]** + **[TECHNICAL DECISION]** |
| Catalogue | Product types, categories, HSN codes, products, variants, inventory | **[PDF]** |
| Merchandising | Buy-it-with combos and curated product placements | **[PDF]** |
| Sales | Orders, order items, payments, logistics, comments and outbound push state | **[PDF]** |
| CRM | Leads, sources, stages, agents and follow-ups | **[PDF]** |
| Warranty | Registrations and admin processing notes | **[PDF]** |
| Content | Contact details, testimonials, FAQs, legal pages and banners | **[PDF]** |

## Candidate table map (not migrations)

All tables below are proposed names, not implementation instructions. `*` identifies a necessary inferred storage structure, while each business attribute remains sourced in the data dictionary.

`users*` (UUID key) ↔ `role_user*` ↔ `roles*` (UUID key); `permissions*` (UUID key) remains independent. `brands*`, `product_types*`, flat `categories*`, `hsn_codes*`, and `warehouses*` (all UUID-keyed) are catalogue masters. `products*` (UUID key, soft deletable) → required `brands`, `categories`, `product_types`, and optional `hsn_codes`; each master restricts deletion while referenced. `media*` stores file metadata; `product_images*` → `products` and `media`; `product_variants*` (UUID key, soft deletable) → `products`; `warehouse_stocks*` → `warehouses` and `products`, with both parents restricted while referenced; immutable `stock_movements*` → `warehouse_stocks` and optional `users` actor. No variant-level inventory exists yet.

`combos*` (UUID key) ↔ `combo_items*` ↔ `products` implements Buy-It-With add-on Products. Target configuration remains pending. `product_recommendations*` → assigned product/type and add-on products; `product_placements*` → product and placement section.

`merchandising_sections*` (UUID key) ↔ `merchandising_products*` ↔ `products` implements ordered, active product placements without category-specific tables.

`orders*` (UUID key) → `order_items*`, `order_addresses*`, and immutable `order_status_histories*`. Orders reference a Customer and optionally a Warehouse; items retain Product, SKU, name, and price snapshots, while billing/shipping records retain immutable contact/address snapshots. Payment, logistics, comments, coupon redemption, and stock mutation remain separate future domains.

`leads*` → `lead_follow_ups*`, `lead_sources*`, `lead_stages*`; `warranty_registrations`; `testimonials`, `testimonial_images*`, `faqs`, `legal_pages`, `banners`, `contact_details`.

## Implementation stance

Do not create tables until the confirmations in `decisions.md` are answered. In particular, the PDF shows two warehouse labels (Por and Trichy), product variants, brand-specific legal pages, product-type-targeted content, and sale actions, but does not define their data ownership or lifecycle semantics.
