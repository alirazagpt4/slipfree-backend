# RS-Backend — Project Flow

Digital Receipt System backend for a retail chain (shop name seen in code: "Logo Opia"). It turns POS sales into
digital receipts customers can view online, collects post-purchase feedback, and gives staff an admin view plus
basic customer-segmentation tools. It also syncs sales directly out of an on-prem Oracle "Retail Pro" POS database,
so invoices land in the system with or without the POS terminal calling this API directly.

## Tech stack

- **Runtime**: Node.js, ESM (`"type": "module"` in `package.json`)
- **Web framework**: Express 5
- **ORM / DB**: Sequelize on MySQL (`mysql2` driver)
- **Secondary DB**: Oracle (`oracledb`) — the store's existing Retail Pro POS database, read-only source of truth for sales, write target for feedback
- **Validation**: Zod (only used for the invoice-ingest payload)
- **Auth**: `jsonwebtoken` (admin panel), static shared-secret header (POS ingest)
- **Scheduling**: `node-cron` (in-process, runs inside the same Node process as the API)
- **Outbound integration**: Ginkgo Retail WhatsApp API (via `axios` + `form-data`) to text customers their receipt link
- **Frontend**: a pre-built React SPA sitting in `public/`, served statically by this same Express app (no server-side rendering, no separate frontend repo wiring visible here)

No test runner, no linter config, no migrations — Sequelize `sync()` creates/alters tables automatically, but **only when `NODE_ENV !== 'production'`**. In production there is no schema-sync and no migration files, so schema changes must be applied to the production DB by hand.

## Boot sequence (`server.js`)

1. Load `.env` via `dotenv`.
2. `sequelize.authenticate()` — fail fast (process exits) if MySQL isn't reachable.
3. If not production: `sequelize.sync()` — auto-creates/alters tables from the model definitions.
4. `app.listen(PORT)` (default 3000).
5. Once listening, `initSyncScheduler()` starts a `node-cron` job that runs **every 1 minute** for the rest of the process's life, pulling new sales from the Oracle POS DB.

There is no separate worker process — the cron job, the WhatsApp dispatch, and the HTTP API all run in the same Node event loop.

## Request pipeline

Every feature route (except the Oracle sync path, which calls the service layer directly) follows the same strict layering:

```
routes/*.routes.js → middlewares/ → controllers/*.controller.js → services/*.service.js → models/ (Sequelize)
```

- **Routes** just wire a URL + HTTP verb to a controller function, and attach any middleware.
- **Controllers** only do HTTP-shaped work: parse/validate the request body, call one service function, map the result (or thrown error) to a status code and JSON body. They never touch Sequelize models directly.
- **Services** hold all business logic and all DB access. Expected failure cases (not found, duplicate, bad credentials) are thrown as `Error` objects with a `.statusCode` property; controllers read that property and default to 500 if it's missing.
- **Models** are one file per table; `models/associations.model.js` is the single place relationships are declared and the import point used whenever more than one model is needed together.

## Route map

| Method | Path | Auth | Controller | Purpose |
|---|---|---|---|---|
| POST | `/api/v1/receipts/ingest` | `X-API-KEY` header (`checkApiKey`) | `invoice.controller.ingestInvoice` | POS terminal pushes a completed sale in |
| GET | `/api/v1/receipts/:hash` | none (public) | `invoice.controller.getReceipt` | Customer views their receipt by hash |
| POST | `/api/v1/receipts/:hash/feedback` | none (public) | `feedback.controller.postFeedback` | Customer submits one rating/comment for that receipt |
| POST | `/api/v1/admin/login` | none (issues the token) | `admin.controller.login` | Admin logs in, gets a JWT |
| GET | `/api/v1/admin/invoices` | JWT bearer (`verifyAdminToken`) | `admin.controller.listInvoices` | Admin sees every invoice with items + feedback |
| POST | `/api/v1/segments` | none | `customerSegment.controller.createSegment` | Save a named customer segment (manual list) |
| GET | `/api/v1/segments` | none | `customerSegment.controller.getAllSegments` | List saved segments |
| GET | `/api/v1/customers/customers-list` | none | `customerList.controller.getGlobalUniqueCustomers` | Dedup'd master customer list, sourced live from Oracle |
| GET | `/health` | none | inline in `app.js` | Liveness check |
| GET | `*` (anything not starting `/api`) | none | inline in `app.js` | Falls back to `public/index.html` — the React SPA's router takes over client-side |

`app.use(cors())` is wide open (no origin restriction) and `express.json()` is the only body parser mounted.

## Data model

Four MySQL tables, defined individually and linked in `associations.model.js`:

- **`invoices`** — one row per sale. Identified externally by `receipt_hash` (random 16-byte hex, `utils/hash.js`), never by the numeric PK. Also carries `invoice_no`, `fbr_invoice_no` (Pakistan FBR tax invoice number, optional), `idempotency_key` (unique — this is what prevents duplicate invoices), store/shop/cashier snapshot fields, customer name/phone snapshot, and the full money breakdown (`price_excl_tax`, `total_amount`, `discount`, `gst_amount`, `pos_fee`, `payable_amount`, `payment_mode`).
- **`invoice_items`** — line items, `belongsTo` `Invoice` via `invoice_id`. No timestamps.
- **`invoice_feedback`** — at most one row per invoice (`invoice_id` is unique), `rating` is an ENUM (`worst | not_good | fine | good | best`), optional free-text `comment`. `Invoice.hasOne(Feedback, { as: 'feedback' })`.
- **`customer_segments`** — ad-hoc named groups of customers for marketing/targeting. `filter_criteria` and `customer_list` are stored as raw JSON columns, not normalized — `customer_list` is an array of `{ customer_name, customer_phone, feedback }` snapshots taken at save time, not a live query.

There is no `Customer` table. "Customers" only exist as (a) denormalized snapshot fields on `Invoice`/`Feedback`, (b) JSON blobs inside `customer_segments`, or (c) rows pulled live from Oracle at request time (see Customer List below).

## Feature flows

### 1. Invoice creation — the two entry points

`services/invoice.service.js::createInvoice(data)` is the single choke point every invoice goes through, called from two different places:

**A. Manual POS ingest** — `POST /api/v1/receipts/ingest`
1. `checkApiKey` middleware requires header `X-API-KEY` to exactly match `POS_API_KEY` env var (401 if missing, 403 if wrong).
2. Controller validates the body against `invoiceSchema` (Zod) — requires `storeId`, `invoiceNo`, `idempotencyKey`, `paymentMode` (`Cash`/`Card`), at least one item, and a `summary` object. Fails 400 with the Zod issues array if invalid.
3. Controller calls `createInvoice(parsed.data)`.
4. If the invoice is new (not a duplicate) and a `customerPhone` was given, the controller *also* calls `sendReceiptWhatsApp` directly, fire-and-forget.
5. Responds `201` (new) or `200` (duplicate) with `{ receiptHash, receiptUrl }`.

**B. Automated Oracle sync** — `jobs/syncRunner.job.js`, on a 1-minute cron tick
1. Guarded by a module-level `isSyncRunning` boolean so overlapping ticks can't run concurrently if a fetch takes >60s.
2. `posSync.service.js::fetchNewSalesFromRetailPro()` runs a large hand-written SQL query (`DELTA_SALES_QUERY`) against Oracle tables `RPS.DOCUMENT` / `DOCUMENT_ITEM` / `TENDER` / `STORE` / `SUBSIDIARY`, pulling sales from the last 24 hours (hardcoded lookback when no `sinceDate` arg is passed — the cron caller never passes one), capped at the 100 most recent documents (`maxDocuments`), filtered to non-held, non-order, active-store, posted (`status > 3`) receipts.
3. Rows (one per sold item) are grouped back into one object per document (`DOC_SID`) with a nested `items` array.
4. `mapRetailProSaleToOurFormat()` reshapes each grouped sale into the exact same payload shape the manual `/ingest` endpoint expects — derives `idempotencyKey` as `` `rp-${DOC_SID}` `` (this is what makes re-running the same Oracle row a no-op), normalizes the tender/payment string down to `Cash`/`Card`/raw-split-string, and computes summary totals by summing the mapped items.
5. Each mapped sale is passed to `createInvoice()` individually, inside its own try/catch, so one malformed row logs a warning and skips rather than aborting the whole batch.
6. This path does **not** call `sendReceiptWhatsApp` itself from the job file — it relies entirely on the dispatch that already happens inside `createInvoice` (see below). The job only logs that a dispatch is pending.

**What `createInvoice()` itself does, regardless of caller:**
1. **Idempotency check** — looks up `Invoice` by `idempotency_key`. If found, returns `{ duplicate: true, receiptHash, receiptUrl }` immediately (200 to the caller) without touching anything else.
2. **Transaction** — inside one `sequelize.transaction`: generates a fresh `receipt_hash`, inserts the `Invoice` row, maps and bulk-inserts the `InvoiceItem` rows.
3. Builds the public receipt URL as `` `${RECEIPT_BASE_URL}/${receiptHash}` `` (falls back to a hardcoded `https://slipfree.nexonsys.com/v` if the env var is unset).
4. **WhatsApp dispatch** — if the invoice has a non-`N/A` `customer_phone`, calls `sendReceiptWhatsApp(phone, url, shopName)` fire-and-forget (`.then/.catch`, never awaited, never affects the response).
5. Returns `{ duplicate: false, receiptHash, receiptUrl }`.

> **Note on double-dispatch**: for the manual `/ingest` path specifically, `sendReceiptWhatsApp` gets called twice for the same new invoice — once inside `createInvoice()` (step 4 above) and again separately by `ingestInvoice` in the controller. The Oracle sync path only triggers it once (from inside the service), since the job never calls it itself. This is existing behavior, not something changed here.

### 2. Viewing a receipt — `GET /api/v1/receipts/:hash`
Public, no auth. `getInvoiceByHash` looks up the `Invoice` by `receipt_hash` with its `items` included. 404 JSON if not found, otherwise the full invoice + items as JSON (the SPA presumably renders this into a receipt page — the API itself has no HTML receipt view).

### 3. Submitting feedback — `POST /api/v1/receipts/:hash/feedback`
Public, no auth.
1. Controller does a minimal check that `rating` is one of the five allowed enum values (this duplicates the DB-level ENUM constraint, done here so a bad rating gets a clean 400 instead of a raw SQL error).
2. Service looks up the `Invoice` by hash (404 if missing), checks for an existing `Feedback` row for that `invoice_id` (409 if one already exists — feedback is strictly one-shot per invoice, enforced both here and by the DB's `unique` constraint on `invoice_id`).
3. Creates the `Feedback` row, snapshotting `invoice_no` and `shop_name` off the invoice at submit time.
4. Fire-and-forget pushes the same feedback into the Oracle DB's `invoice_feedback` table via `oracleFeedback.service.js::pushFeedbackToOracle` — failure there is logged only, never surfaced to the customer.
5. Responds 201 with the saved rating/comment/timestamp.

### 4. Admin panel — `/api/v1/admin/*`
- **Login** (`POST /login`): checks `username`/`password` against `ADMIN_USERNAME` + `bcrypt.compareSync` against `ADMIN_PASSWORD_HASH` (both env vars — there's no admin table). On success, signs a JWT (`{ username }`, 24h expiry) with `JWT_SECRET`. 401 on any mismatch.
- **List invoices** (`GET /invoices`, JWT-protected): `verifyAdminToken` middleware reads `Authorization: Bearer <token>`, verifies it with `JWT_SECRET`, 401 if missing / 403 if invalid or expired. Service returns every `Invoice` with its `items` and `feedback` eager-loaded, newest first.
- `generateHash.js` at the repo root is a standalone one-off script (not wired into any route) — run manually with `node generateHash.js` to produce a bcrypt hash to paste into `ADMIN_PASSWORD_HASH`.

### 5. Customer segments — `/api/v1/segments`
No auth on either route.
- **Create** (`POST`): requires non-empty `segment_name` and a non-empty `customer_list` array. Service sanitizes each entry to `{ customer_name, customer_phone, feedback }` (defaulting name to `Walk-In Customer` and phone to `N/A` if missing) and stores the whole thing as JSON on one `customer_segments` row. This is a snapshot, not a saved filter that re-runs later — `filter_criteria` is stored alongside but isn't used to regenerate the list.
- **List** (`GET`): returns all segments, newest first, with a computed `total_customers` count.

### 6. Master customer list — `GET /api/v1/customers/customers-list`
No auth. Bypasses MySQL entirely — `masterCustomers.service.js::fetchMasterCustomers()` opens a **separate live Oracle connection** and runs a query across `rps.customer` / `customer_phone` / `customer_address` / `customer_email` / `store` / `subsidiary`, then deduplicates in Node by phone number (falling back to a `name_createdDate` composite key when phone is missing), returning one row per unique customer across the entire chain. This is a different Oracle query/connection than the one used for sales sync, but both share the same Oracle credential env vars.

## Auth mechanisms (two, completely independent)

1. **POS ingest** — static shared secret. `X-API-KEY` header must equal `POS_API_KEY`. No expiry, no rotation logic, one key for every POS terminal.
2. **Admin panel** — JWT bearer token from `/admin/login`, verified per-request by `authAdmin.middleware.js`. No refresh-token flow; token is just valid for 24h then the admin has to log in again.

Everything else (`/receipts/:hash`, `/receipts/:hash/feedback`, `/segments`, `/customers/customers-list`) is unauthenticated by design — receipts/feedback are meant to be reachable from a link with no login, and segments/customers currently have no access control at all.

## External integrations

- **Oracle "Retail Pro" DB** — used three separate ways, each with its own connection lifecycle (a connection is opened and closed per call, no pooling visible):
  1. `posSync.service.js` — read sales for the sync job.
  2. `oracleFeedback.service.js` — write submitted feedback back into Oracle.
  3. `masterCustomers.service.js` — read the full customer master list on demand.
- **Ginkgo Retail WhatsApp API** — `whatsapp.service.js` posts a template message (`retail_sale_receipt` by default) with the receipt link as `body_1`. Phone numbers are normalized to a bare-digits E.164-ish form (`92XXXXXXXXXX`). Failures are caught and logged, never thrown — a WhatsApp outage cannot break invoice creation.

## Environment variables in use

| Variable | Used by | Notes |
|---|---|---|
| `PORT` | `server.js` | defaults to 3000 |
| `NODE_ENV` | `server.js` | gates `sequelize.sync()` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_DIALECT` | `config/database.js` | MySQL connection |
| `POS_API_KEY` | `middlewares/auth.js` | shared secret for `/ingest` |
| `RECEIPT_BASE_URL` | `invoice.service.js` | public receipt link prefix; has a hardcoded fallback |
| `JWT_SECRET` | `admin.service.js`, `authAdmin.middleware.js` | signs/verifies admin tokens |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` | `admin.service.js` | the one hardcoded admin identity |
| `ORA_USER`, `ORA_PASS`, `ORA_HOST`, `ORA_PORT`, `ORA_SERVICE_NAME` | `posSync.service.js`, `oracleFeedback.service.js`, `masterCustomers.service.js` | Oracle connection; each file has its own fallback defaults |
| `GINKGO_WHATSAPP_URL`, `GINKGO_API_KEY`, `WHATSAPP_TEMPLATE_NAME` | `whatsapp.service.js` | WhatsApp dispatch; both URL and API key have hardcoded fallbacks in code |

The current `.env` in this working copy only sets the DB block, `POS_API_KEY`, and `RECEIPT_BASE_URL` — the admin, Oracle, and WhatsApp variables aren't present there, so those features would currently be running on whatever hardcoded fallback exists in code, or fail outright where no fallback exists (e.g. `ADMIN_PASSWORD_HASH` has no fallback, so admin login would always fail as configured).

## Loose ends / things noticed while reading (not changed)

- `oracletest.js` at the repo root imports from `./services/customerlist.service.js` (lowercase, no such file — the real file is `masterCustomers.service.js`). This script would throw immediately if run; it's not imported by any route.
- The WhatsApp API key and base URL have real-looking values hardcoded as fallbacks in `whatsapp.service.js` rather than only living in `.env`.
- Manual `/ingest` triggers a WhatsApp send twice per new invoice (see note under Invoice creation above).
