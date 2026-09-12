# Decisions, gaps, and risks

## Confirm before implementation

1. Which Laravel, PHP and MySQL versions, starter kit, authentication mechanism, and admin UI approach form the requested base project? **[CONFIRMATION REQUIRED]**
2. Brand is a reusable reference because the product form selects it and legal pages are brand-scoped. Confirm whether multiple brands are supported in production and which future domains require `brand_id`. **[CONFIRMATION REQUIRED]**
3. Are Por and Trichy fixed warehouse records, administrator-managed locations, or external inventory sources? What does “Sync All Stock” do? **[CONFIRMATION REQUIRED]**
4. Is a product variant separately sellable/inventory-tracked, and what attributes besides the shown labels/SKUs are needed? **[CONFIRMATION REQUIRED]**
5. Define exact product, coupon, warranty and order status values and all allowed transitions, including what “Abandon” and “Hold” mean. **[CONFIRMATION REQUIRED]**
6. Does an order need immutable snapshots for product, price, tax, coupon and addresses? What payment providers and KinetIQ contract apply? **[CONFIRMATION REQUIRED]**
7. Define coupon applicability: “Product Type” versus all products, per-customer versus global usage, stackability, and fixed-discount field behavior. **[CONFIRMATION REQUIRED]**
8. Define CRM assignment, stage transition, follow-up, duplicate-lead and retention rules. **[CONFIRMATION REQUIRED]**
9. Who can create/edit/delete/export/sync/verify/push each module? The PDF proves an authenticated admin experience but contains no permission matrix. **[CONFIRMATION REQUIRED]**
10. Confirm file-storage provider, image retention/deletion policy, testimonial CSV failure handling, and whether soft deletes are required. **[CONFIRMATION REQUIRED]**
11. Users and roles have an approved many-to-many assignment through `role_user`; permitted role values and authorization effects remain **[CONFIRMATION REQUIRED]**.
12. Which permission values are approved, and how will they be assigned to roles? `resource.action` is the identifier convention only; it does not define a permission catalogue. **[CONFIRMATION REQUIRED]**
13. Define the permitted Order, payment, and fulfillment statuses; cancellation/completion transitions; whether status changes may amend items or addresses; and the Order-number generation format. **[CONFIRMATION REQUIRED]**
14. Confirm whether Order address snapshots must include country, locality, recipient identity fields beyond those shown, and whether a future Customer address book should feed snapshots. **[CONFIRMATION REQUIRED]**

## Risks

- Building database enums or hard-coded statuses now would invent lifecycle rules. **[TECHNICAL DECISION]**
- The screen mapping uses current display values as examples; do not treat displayed sample brands, names, amounts, or sources as seed-data requirements. **[TECHNICAL DECISION]**
- Product Type is used in several contexts; conflating classification, HSN type, coupon targeting, FAQ targeting and placement grouping without confirmation risks an inflexible schema. **[TECHNICAL DECISION]**
- Sales controls imply external integrations and auditability, but their API and retention requirements are absent. **[CONFIRMATION REQUIRED]**
- Identity migrations are timestamped in dependency order: `users`, then `roles`, then `role_user`. The users rollback also drops `sessions` before `users`, so MySQL foreign-key creation and rollback are safe. **[TECHNICAL DECISION]**

## Final safety record

- **No migrations created or modified.**
- **No application code modified.**
- **No business requirements invented:** unanswered behavior is labelled confirmation-required.
- **Repository inspected completely:** it is empty.
- **PDF inspected completely:** all 46 pages were visually reviewed.
