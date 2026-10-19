01 Customer → Address
        ↓
02 Product → Cart
        ↓
03 Cart → Checkout
        ↓
04 Checkout → Order
        ↓
05 Order → Nearest Warehouse
        ↓
06 Warehouse → Reservation
        ↓
07 Reservation → Payment
        ↓
08 Commit → Fulfillment
        ↓
09 Packing → Invoice
        ↓
10 Invoice → Shipment
        ↓
11 Shipment → Tracking
        ↓
12 Backend → Storefront Tracking
        ↓
13 Backend → Admin Orders
        ↓
14 Order → Admin Detail
        ↓
15 Full E2E