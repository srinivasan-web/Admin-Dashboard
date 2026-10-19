# Reservation expiry

`config/inventory.php` defines `INVENTORY_RESERVATION_TTL_MINUTES` (default: 30).
The deadline is persisted once; retrying reserve never extends it.

Deploy `2026_09_27_100000_add_stock_reservation_expiry.php` through the normal migration workflow.
The migration adds a nullable deadline and `(status, expires_at)` index. Existing ACTIVE
reservations receive `reserved_at + configured TTL`; older holds may be immediately due.
Terminal historical rows remain unchanged. No stock is modified by the migration.

The Laravel scheduler runs `inventory:expire-reservations` every minute. Configure the
host to invoke `php artisan schedule:run` every minute (or use `schedule:work` locally).
The command can also be run manually. Repeated or concurrent executions are safe through
the existing order/reservation/stock locks and unique movement keys. A failed order is
logged, rolled back and retried on the next run; other orders continue processing.

Expiry persists EXPIRED, sets `released_at`, and records one existing RELEASE movement.
Physical quantity is unchanged. `expires_at` is the deadline, and `released_at` records
when the hold was actually released. Payment rejects overdue holds even before the
scheduler processes them. Committed holds never expire. Expiry alone does not change
order/payment status or permit re-reservation; those existing state rules remain in force.

Admin allocation immediately invokes the existing reserve endpoint. Allocation remains
stock-neutral; a failed reserve leaves the order pending, displays the error and reloads
authoritative data. The backend blocks payment commitment without matching valid holds.
Order Detail's existing 15-second refresh and manual refresh show scheduled expiry.
Warehouse Stock's existing refresh displays the current aggregate balances, including
other orders' reservations; an individual expired order does not imply aggregate reserved=0.

Verification:

```sh
php artisan test --filter='StockReservationExpiryTest|OrderInventoryIntegrationTest|OrderAdminApiTest|InventoryReadApiTest'
php tests/runtime/verify-inventory-mysql.php
# Without CREATE DATABASE permission, on a local/testing database after migration:
php tests/runtime/verify-inventory-mysql.php --transactional
# From admin/ (pass the PHP executable path if needed):
node tests/inventoryUi.integration.mjs php
node tests/inventoryUi.integration.mjs php --mysql
node tests/inventoryFlow.browser.mjs php
```

The MySQL runner creates a random `durafit_inventory_check_*` database, migrates it,
verifies competing reservations and the expiry/payment/shipment lifecycle, and removes
only that owned test database. It requires CREATE/DROP DATABASE privileges for the
verification namespace. It never migrates or modifies the application's database.
The UI integration runner renders real React components from Laravel API responses
produced by application actions in an isolated SQLite test database; it is not a browser test.
`--mysql` renders the same component using API Resource responses from application-created
MySQL records. Transactional verification checks InnoDB first, modifies only new verification
records, and rolls them all back; it does not exercise parallel workers or create/drop a database.
The browser runner uses Chrome, real React/Laravel requests and a guarded disposable SQLite
database to verify login, immediate allocation/reservation, payment commitment, expiry/retry,
reload and warehouse balances. It requires free local ports 18093, 15193 and 19393.
