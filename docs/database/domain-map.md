# Domain map

| Domain | PDF modules and CRUD | Principal dependencies | Source |
| --- | --- | --- | --- |
| Catalogue | Product types, categories, HSN codes, products; create/edit/delete/search/export | Types/categories/HSN precede products | **[PDF]** |
| Inventory | Warehouse Stock: All, Por, Trichy; update/sync stock | Product or variant and warehouse | **[PDF]** |
| Merchandising | Buy It With Combos; Choose Your Product; Explore Bestsellers | Product/product type and catalogue grouping | **[PDF]** |
| Sales | Orders and Abandon Orders; edit, hold, payment verification/details, logistics, comments, resend mail, KinetIQ push | Customer/address, products, inventory, coupon/payment/logistics | **[PDF]** |
| CRM | Dashboard, All Leads, Offline Camp | Lead sources, agents, stages, follow-ups | **[PDF]** |
| Warranty | List/export/filter/edit warranty registrations | Customer and product | **[PDF]** |
| Content | Contacts, coupons, testimonials/CSV import, FAQs, legal pages, landing/listing banners | Product/product type, brand where displayed | **[PDF]** |
| Dashboard | Aggregate operational metrics | Catalogue, sales and CRM data | **[PDF]** |

### Boundary notes

- Catalogue owns sellable item definitions; inventory owns quantities by location. **[TECHNICAL DECISION]**
- Merchandising only references catalogue records; it must not duplicate price, image, or stock. **[TECHNICAL DECISION]**
- Sales owns transaction history; CRM is lead management, not an order extension. **[TECHNICAL DECISION]**
- The PDF calls “Product Type” in both product classification and content filters. Whether this is the same entity is **[CONFIRMATION REQUIRED]**.
