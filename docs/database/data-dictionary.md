# Data dictionary

Legend: **P** = **[PDF]** visible control/column; **T** = **[TECHNICAL DECISION]** storage support; **C** = **[CONFIRMATION REQUIRED]**.

| Proposed record | Fields observed or minimally required | Source |
| --- | --- | --- |
| Brand | UUID id; unique name and slug; timestamps. No description, logo/media link, status, sort order, or soft-delete lifecycle is supported by the current PDF/repository evidence. | P (brand selection and brand-scoped legal pages); T (UUID/unique identifiers) |
| Role | name, slug, optional description, timestamps; no assignment relationship yet | T (explicit implementation request) |
| Role assignment | user UUID, role UUID; unique pair; no independent lifecycle fields | T (approved many-to-many relationship) |
| Customer | UUID id; required name; nullable, individually unique email and phone; timestamps and soft deletion. It is a standalone commerce/CRM identity with no User, Order, Lead, Warranty, or address relationship in this scope. | P (customer name, phone, and email in Order/Warranty flows); T (UUID, unique identity keys, archival retention) |
| Permission | `resource.action` name, optional description, timestamps; no assignment relationship yet | T (explicit implementation request) |
| Product type | UUID id; unique name and slug; nullable description; `is_active` defaults true; timestamps. No sort order, soft delete, or relationship until dependents exist. | P (name, slug, status, description); T (UUID/constraints) |
| Category | UUID id; unique name and slug; nullable `image_path` storage key; nullable description; `is_active` defaults true; timestamps. It is a flat master: no `parent_id`, sort order, soft delete, media relation, or product relation is supported by current evidence. | P (name, slug, image, status, description); T (UUID/storage key/constraints) |
| HSN code | UUID id; required title; nullable type; nullable, unique `hsn_code`; nullable `decimal(5,2)` SGST and IGST tax multipliers; timestamps. No status, soft delete, product relation, or tax-calculation behavior is supported by current evidence. | P (title, type, HSN code, SGST/IGST multipliers); T (UUID/nullable storage/unique index/decimal precision) |
| Product | UUID id; required brand, category, and product-type UUID FKs; optional HSN UUID FK; name; nullable group name; unique SKU; required `decimal(12,2)` MRP; nullable `decimal(12,2)` sale price; nullable tag; sort order default 0; active default true; trade-product flag default false; nullable rich description; timestamps and soft delete. Images are held through ProductImage records, not Product columns. No Product slug, cost price, tax amount/rate, inventory, or order fields. | P (form controls/search); T (UUID FKs, money precision, defaults, soft delete/constraints) |
| Media | UUID id; storage disk and path; optional original filename, MIME type, and byte size; timestamps. The disk/path pair is unique. It stores metadata only: no binary, polymorphic owner, or retention lifecycle is currently supported. | T (file-storage metadata) |
| Product image | UUID id; required Product and Media UUID FKs; free-text type; sort order default 0; primary flag default false; timestamps. A Product/Media pair is unique. A generated support key enforces at most one primary image per Product. | P (Product image capability); T (attachment storage/ordering/primary constraint) |
| Product variant | UUID id; required Product UUID FK; required label and value; unique SKU; timestamps and soft delete. Label/value is unique within a Product. No variant price, status, stock, image, or tax fields are supported. | P (parent product, label/value, SKU); T (UUID/constraints/soft delete) |
| Warehouse | UUID id; unique name; timestamps. The PDF-visible `Por` and `Trichy` records are seed data. No code, address, city, state, postal code, status, or soft delete is supported yet. | P (warehouse labels); T (UUID/unique constraint) |
| Warehouse stock | UUID id; required Warehouse and Product UUID FKs; unsigned quantity defaulting to zero; timestamps. The Warehouse/Product pair is unique. Movement history is held separately in StockMovement; no reserved quantity, reorder level, variant, or soft-delete fields are supported. | P (warehouse stock by product); T (current-state record/UUID FKs/constraints) |
| Stock movement | UUID id; required WarehouseStock UUID FK; required free-text movement type; required non-zero signed quantity delta; nullable `created_by` User UUID FK; creation timestamp only. Movement records are immutable and have no polymorphic reference, update timestamp, or soft delete. | P (stock update/sync activity); T (audit-event storage/constraints) |
| Combo | UUID id; required name (the Buy-It-With custom title); active flag defaulting true; timestamps. No slug, description, Product target, sort order, or soft delete is supported. Products are held through ComboItem rows. | P (Buy-It-With custom title/active configuration); T (UUID/status storage) |
| Combo item | UUID id; required Combo and Product UUID FKs; unsigned quantity defaulting one; timestamps. The Combo/Product pair is unique. | P (Buy-It-With add-on products); T (pivot/UUID constraints) |
| Merchandising section | UUID id; name, unique slug, free-text type, sort order, active flag, timestamps. It represents a data-driven display section such as the PDF's Choose Your Product or Explore Bestsellers. | P (placement groups); T (UUID/status/order storage) |
| Merchandising product | UUID id; required MerchandisingSection and Product UUID FKs; sort order, active flag, timestamps. The Section/Product pair is unique. | P (section Product placements); T (pivot/UUID constraints) |
| Product recommendation | target kind (specific product/product type), target, custom title, active, sort, add-on products (maximum four shown) | P; T (header/item records) |
| Product placement | placement group (Choose Your Product/Explore Bestsellers), product type section, product, ordering | P; T (record) |
| Coupon | code, title, description, discount type, discount value, max discount, min/max order amount, usage limit, valid from/till, product type, status, show-on-website, optional UTM source, creator | P |
| Testimonial | product, customer name, title, description, rating, source, images, active, featured | P |
| FAQ | optional product type, question, answer, sort order, active | P |
| Legal page | page name, slug, status, body | P for first three; T for body storage |
| Banner | title, desktop image, mobile image, page (Landing/Listing), sort order, redirect URL, start/end date-time, active, creator/updater | P |
| Contact detail | contact purpose (Sales Enquiry/Assembly & Service), phone number, email | P |
| Lead | name, mobile, email, address, stage, source, assigned agent, created date | P |
| Lead follow-up | lead, scheduled time, completion/overdue state | P dashboard evidence; T (record) |
| Offline-camp lead | lead, society name, coupon, date | P |
| Warranty registration | customer name, phone, email, address, state, city, pincode, product name, serial number, invoice number/date, purchase source/date, status, admin notes, registered on | P |
| Order | UUID id; unique order number; required Customer UUID FK; nullable Warehouse UUID FK; required free-text order status; nullable payment and fulfillment statuses; required subtotal and total plus discount defaulting to zero as `decimal(12,2)`; placed-at and timestamps. It is the transaction header; payment, fulfillment, coupon, invoice, and logistics implementations remain out of scope. | P (order ID/customer/amount/status/payment/delivery/warehouse); T (UUID/FKs/money snapshots) |
| Order item | UUID id; required Order UUID FK; nullable Product UUID FK; required product-name and SKU snapshots; required workflow quantity; required unit price and line total as `decimal(12,2)`; timestamps. | P (order/product/quantity); T (UUID/FK and historical item snapshots) |
| Order address | UUID id; required Order UUID FK; required billing/shipping usage marker and recipient name; optional phone/email; required address with optional state, city, and postal code; creation timestamp only. One address per Order/usage marker is unique and immutable. | P (billing/shipping address; warranty address/state/city/pincode fields); T (snapshot/UUID/uniqueness) |
| Order status history | UUID id; required Order UUID FK; nullable prior status, required new status, nullable User actor, creation timestamp only. It is append-only. | P (order status); T (audit storage/UUID) |
| Payment/logistics/comment | order, payment verification/details; warehouse/AWB/logistics company/shipping date/delivery status; comment | P; T (separate records) |
| User | authentication identity, display name | T; P shows current/created users |

Fields such as IDs, foreign keys, timestamps, media storage keys, and audit keys are technical support fields, not PDF business requirements.
