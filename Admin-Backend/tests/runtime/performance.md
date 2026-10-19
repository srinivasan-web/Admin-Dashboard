# Local API performance investigation — 2026-10-11

## Result and limits

The reproduced bottleneck was repeated PHP/Laravel loading in the local Windows
development server with OPcache absent. Enabling OPcache for that process reduced
public endpoint HTTP latency while preserving response content. It does not cache
API data: each request still reads current MySQL data.

The reported 28-second categories request was **not reproduced**. The original
CMD performance log was not found in the supplied workspace. Its cause remains
unconfirmed; the result below explains the reproducible local slowdown only.

No application SQL, API responses, migrations, indexes, global PHP configuration,
inventory locks or business rules changed in this pass.

## Reproduction

From a Windows CMD terminal:

```bat
cd /d "E:\Durafit - Admin\Admin-Backend"
serve-local.cmd --check
serve-local.cmd
```

The launcher uses the installed WinGet PHP 8.4 distribution also referenced by
`test.cmd`. It checks OPcache, PDO MySQL, mbstring and JPEG-capable GD, then binds
only `127.0.0.1:8000`, which matches the existing Vite API targets. A port already
in use causes startup to fail; the launcher does not stop other processes. Stop
with Ctrl+C and restart after changing `.env` or PHP configuration.

It sets `opcache.enable_cli=1`, `opcache.validate_timestamps=1` and
`opcache.revalidate_freq=0` for that server process. Timestamp validation remains
enabled so source edits are checked on every request. PHP's
[OPcache configuration reference](https://www.php.net/manual/en/opcache.configuration.php)
documents these settings. The launcher invokes PHP's server directly because
Laravel's `artisan serve` starts a child PHP process without forwarding parent
`-d` options.

In another CMD terminal, select the same PHP executable and run the read-only profiler:

```bat
set "DURAFIT_PROFILE_PHP=%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
"%DURAFIT_PROFILE_PHP%" tests/runtime/profile-public-api.php --samples=20 --explain
"%DURAFIT_PROFILE_PHP%" tests/runtime/profile-public-api.php --http=http://127.0.0.1:8000 --samples=20
```

The default mode measures a booted Laravel HTTP kernel, SQL timings, query counts,
slowest SQL, request memory deltas and optional MySQL `EXPLAIN`. HTTP mode measures
actual request latency through the local server. Compare both to distinguish SQL
work from bootstrap/transport overhead. Neither mode measures image downloads.
The script prints JSON to stdout; it does not install middleware or permanent
query logging, emit bindings or response bodies, seed data, or change schema.
It is restricted to local/testing environments, known public GET endpoints,
2–100 samples, and loopback HTTP origins. It stops on the first non-200 response
or five-second HTTP timeout. HTTP mode does not claim to measure server memory or SQL.

## Read-only audit

The migration/model and route inventory groups the existing tables as follows.
This inventory is not a claim that each table has received a representative load test.

| Domain | Tables / relationships | Main callers |
| --- | --- | --- |
| Identity | users, roles, permissions; role_user and permission_role pivots; sessions, password_reset_tokens | AdminAuthController, policies, User permission checks |
| Catalog | products independently references brands, categories, product_types, hsn_codes; product_variants belongs to products | PublicCatalogController, ProductController, catalog master controllers |
| Product content | product_images → media; product_prices → products; product_attributes → products + attributes; product_highlights → product_attributes | ProductResource, product/specification/media actions |
| Inventory | warehouse_stocks → warehouses + products; stock_movements → balances/order references; stock_reservations → order items/product/warehouse | WarehouseStockController, OrderInventoryService and inventory actions |
| Merchandising | combos → combo_items → products; merchandising_sections → merchandising_products → products | ComboController, MerchandisingController, public catalog |
| CMS | banners → desktop/mobile media | BannerController, PublicBannerController |
| Commerce | customers → customer_addresses; orders → customer/warehouse; order_items, order_addresses, order_status_histories, payments, shipments → orders | OrderController, order/payment/shipment actions |
| Framework | cache, cache_locks, migrations | Laravel infrastructure |

| Read path | Actual query behavior | Evidence / next check |
| --- | --- | --- |
| Public categories | Active categories, name order, one query, no joins or media reads | Measured first; no demonstrated SQL bottleneck |
| Public products | 24-row pagination; stock existence/sums; eager master/media/specification/highlight relations | 9 queries on current data; larger populated specifications still need measurement |
| Bestsellers / featured | Active section + pivot + product/category/type/stock conditions; eager relations; no pagination | 2 / 9 queries here; bestsellers response is empty, so this is not a populated bestsellers baseline |
| Public filters | Active/filterable attributes, distinct available-product values | Empty attribute data currently short-circuits after one query; populated fixture required |
| Admin products / orders / media / stock / movements | Existing bounded pagination and eager relations | Protected session/RBAC baselines still pending |
| Catalog masters / combos / merchandising selections | Unpaginated master/curated collections | Need realistic cardinality before proposing contract changes |
| Per-product stock detail | Loads movement/reservation history without a page boundary | Candidate for a growing-history benchmark; preserve current response contract |
| CSV export | Existing 500-row lazy iteration, eager related masters and stock sums | Further offset/snapshot/browser-download limits remain; prior SQLite result is not a MySQL scale test |

### MySQL baseline

PHP 8.4.25, MySQL 8.0.45, Windows local disk, existing data: 2 categories,
8 products, 10 warehouse balances, 0 attributes, 0 product attributes and
6 merchandising memberships. No application data was inserted or updated.

Twenty requests per endpoint in one booted kernel produced:

| Endpoint | Request p50 / p95 / p99 ms | SQL p95 ms | Query count | Errors |
| --- | --- | ---: | ---: | ---: |
| categories | 3.52 / 4.87 / 122.25 | 1.50 | 1 | 0 |
| products | 17.86 / 21.40 / 98.93 | 9.94 | 9 | 0 |
| merchandising/bestsellers | 7.92 / 9.18 / 17.49 | 3.50 | 2 | 0 |
| merchandising/featured | 15.65 / 20.43 / 21.35 | 10.13 | 9 | 0 |
| filters | 2.34 / 3.34 / 3.84 | 0.87 | 1 | 0 |

Initial process probes measured approximately 490–659 ms of bootstrap and one
33 ms connection establishment. A warm kernel excludes that repeated bootstrap
cost, so these timings must not be reported as ordinary HTTP response times.

`EXPLAIN` for categories used a table scan and filesort with an estimate of three
rows (the exact table count was two). This small-table plan does not justify a
new index. Product plans used `products_is_active_sort_order_index`, master primary
keys and `warehouse_stocks_product_id_foreign`; product ordering still used filesort.
Featured membership used its existing section/product unique index. These are
optimizer estimates, not measured rows examined; no indexes were added.

### HTTP before / after

Same PHP executable, local database, loopback origin `127.0.0.1:18080`, router,
endpoint order and twenty sequential requests per endpoint. Only the process
OPcache settings changed. All response hashes matched within and between the
paired runs. Each run completed 100 HTTP 200 responses.

| Endpoint | No OPcache p50 / p95 / p99 ms | OPcache p50 / p95 / p99 ms | Sequential requests/sec before → after |
| --- | --- | --- | --- |
| categories | 501.79 / 636.75 / 639.19 | 55.95 / 74.20 / 1081.80 | 1.95 → 9.11 |
| products | 575.27 / 618.64 / 633.44 | 88.82 / 113.53 / 259.99 | 1.73 → 10.10 |
| merchandising/bestsellers | 497.23 / 564.02 / 584.82 | 70.14 / 89.53 / 92.68 | 1.96 → 13.76 |
| merchandising/featured | 648.04 / 989.89 / 1141.02 | 91.37 / 117.32 / 134.27 | 1.38 → 10.55 |
| filters | 561.35 / 665.67 / 710.77 | 52.38 / 68.39 / 72.59 | 1.73 → 18.07 |

The first categories request warmed the opcode cache and took 1081.80 ms, which
is slower than the uncached cold request. With twenty samples p99 is effectively
the maximum; these are diagnostic observations, not stable production percentiles.

Before validating the delivered launcher, local acceptance criteria were set to
zero errors, category p95 below 150 ms, and other listed endpoint p95 below 200 ms
on this dataset. The independent `serve-local.cmd` run on port 8000 passed:
categories 81.93 ms, products 125.46 ms, bestsellers 94.89 ms, featured 119.12 ms,
filters 77.05 ms; 100/100 requests returned 200. Product pagination links contain
the origin, so their body hash changes when the port changes.

### Bounded concurrency pilot

Mixed public GETs against the warm delivered server, same eight-product dataset.
The preset stop threshold was any error or p95 exceeding 1500 ms.

| Concurrent requests | Requests / duration | p50 / p95 / p99 ms | Throughput | Errors |
| ---: | --- | --- | ---: | ---: |
| 1 | 20 / 2.087 s | 97.90 / 156.05 / 194.15 | 9.58/s | 0 |
| 5 | 20 / 1.816 s | 258.89 / 454.64 / 499.23 | 11.01/s | 0 |
| 10 | 20 / 1.914 s | 461.50 / 923.67 / 986.34 | 10.45/s | 0 |
| 25 | 50 / 4.833 s | 1215.68 / 2342.14 / 2405.77 | 10.35/s | 0 |

The pilot stopped at 25. Fifty/hundred-way concurrency and soak testing were not
run after that threshold. The throughput plateau and growing queue latency are
consistent with the [single-worker Windows development server](https://www.php.net/manual/en/features.commandline.webserver.php).
This is not a production server or a million-customer capacity result.

## Verification and remaining work

- Full regression suite: **220 passed, 1,141 assertions, 21.92 seconds** using the configured in-memory SQLite database.
- Real MySQL public GETs and `EXPLAIN` completed; paired HTTP payload hashes matched.
- Launcher preflight and actual startup passed. Profiler rejects production environment, external origins and invalid sample counts.
- New profiler PHP syntax and targeted Pint passed; `git diff --check` passed.
- Repository-wide Pint still reports **13 existing style issues across 249 files**: SaveCustomerAddress, OrderStatusConflict, AdminAuthController, BannerController, MediaController, Banner, OrderInventoryService, the single-primary-image migration, routes/api.php, routes/web.php, MerchandisingApiTest, StockReservationExpiryTest and verify-inventory-mysql.php. They were not changed.

Next: capture the original categories outlier with its request ID, active PHP
binary/server command and simultaneous requests. Then measure a production-like
staging server with populated products/specifications/merchandising and realistic
orders/history at 1k, 10k, 100k and feasible 1m rows. Those dataset stages have not
been run; the current application database is not a load-test fixture. Define
customer/product/order distributions, concurrency targets, CPU/DB observers and
stop thresholds before that run. Server memory, CPU, storage throughput, actual
rows examined, lock waits and deadlocks were not collected in this HTTP pilot.

The protected admin lists, growing warehouse histories, export consistency during
concurrent changes, and media download timings still need isolated measurements.
No cache, Redis, replica, queue or partitioning change is justified by this small
read-only dataset alone.
