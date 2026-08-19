# Architecture

## Overview

RS-Backend is the backend for a Digital Receipt System. POS terminals (and an automated Oracle sync job) submit invoices (receipts) to the API; customers view their receipt and leave feedback via a public link built from a receipt hash. A separate admin panel and a customer-segmentation feature sit alongside the core receipt flow.

Built with Express 5 + Sequelize (MySQL), using ES modules throughout. `public/` holds a pre-built React SPA served statically; any request path that doesn't start with `/api` falls back to `public/index.html` (client-side routing).

## Request flow

The core receipt/feedback pipeline follows the same layered pattern, entering at `app/app.js`:

```
routes/*.routes.js → middlewares/ → controllers/*.controller.js → services/*.service.js → models/ (Sequelize)
```

Each layer has one job:

- **Routes** (`routes/`) map an HTTP method + path to a controller function, and attach any middleware.
- **Middlewares** (`middlewares/`) handle cross-cutting HTTP concerns: POS API key auth (`auth.js`) and admin JWT auth (`authAdmin.middleware.js`).
- **Controllers** (`controllers/`) own HTTP concerns only: parsing/validating the request (via Zod schemas in `validators/`, or inline checks for admin/segment routes), calling a service, and shaping the JSON response and status code. They never talk to the database directly.
- **Services** (`services/`) own business logic and all database access. They throw plain `Error` objects with a `.statusCode` property for expected failure cases (e.g. 404 invoice not found, 409 duplicate feedback); controllers read `error.statusCode` and default to 500 if absent.
- **Models** (`models/`) define Sequelize schemas, one per table. `models/associations.model.js` is the single place relationships are wired up and is the canonical import point when more than one model is needed together.

Routes are mounted in `app/app.js`:

| Base path | Routes file | Auth |
|---|---|---|
| `/api/v1/receipts` | `invoice.routes.js`, `feedback.routes.js` | `POST /ingest` only (API key) |
| `/api/v1/admin` | `admin.routes.js` | JWT, except `/login` |
| `/api/v1` (i.e. `/api/v1/segments`) | `customerSegment.routes.js` | none |
| `/api/v1/customers` (i.e. `/api/v1/customers/customers-list`) | `customerList.routes.js` | none |

## Two invoice-creation entry points

`services/invoice.service.js::createInvoice` is the single choke point for creating an invoice — everything else calls into it. It's invoked from two places:

1. **`POST /api/v1/receipts/ingest`** — manual POS ingest, guarded by `checkApiKey`.
2. **`jobs/syncRunner.job.js`** — a `node-cron` job started from `server.js` on boot, running every minute (`*/1 * * * *`). It pulls new sales directly from an on-prem Oracle "Retail Pro" database (`services/posSync.service.js`, a hand-written SQL query joining `RPS.DOCUMENT`, `DOCUMENT_ITEM`, `TENDER`, `STORE`, etc.), reshapes each sale via `mapRetailProSaleToOurFormat` into the same payload shape the ingest endpoint expects, and calls `createInvoice` per sale. A module-level `isSyncRunning` flag prevents overlapping runs; each sale is wrapped in its own try/catch so one bad row doesn't abort the batch.

Both paths inherit the same idempotency and transactional behavior described below, and both can trigger a WhatsApp dispatch.

## Key domain behaviors

- **Hash-based public identity**: invoices are never exposed externally by their database primary key. Each invoice gets a `receipt_hash` (16 random bytes, hex-encoded — `utils/hash.js`) generated at creation time. `GET /:hash` and the feedback endpoint both look invoices up by this hash. The customer-facing receipt URL is `${RECEIPT_BASE_URL}/${receipt_hash}`.
- **Idempotent ingest**: invoice creation requires an `idempotencyKey`. If an invoice with that key already exists, the existing receipt is returned with `duplicate: true` (HTTP 200) instead of creating a new one; genuinely new invoices return HTTP 201. The Oracle sync path derives this key as `rp-${DOC_SID}`. See `services/invoice.service.js::createInvoice`.
- **Transactional writes**: an invoice and its line items are inserted together inside a single `sequelize.transaction`, so a failure partway through leaves no partial invoice.
- **One-shot feedback**: each invoice can receive at most one feedback entry. This is enforced twice — a unique constraint on `Feedback.invoice_id` at the DB level, and an explicit existence check in `services/feedback.service.js` that returns a 409 if feedback was already submitted. On success, feedback is also pushed (non-blocking, fire-and-forget, failures only logged) to the same Oracle database via `services/oracleFeedback.service.js`.
- **WhatsApp receipt dispatch**: `services/whatsapp.service.js` sends the receipt link via the Ginkgo Retail WhatsApp API whenever an invoice is created with a customer phone number, from either entry point. This is non-blocking / best-effort — errors are logged and never surfaced to the caller or the POS terminal.
- **Admin invoice listing**: `GET /api/v1/admin/invoices` (JWT-protected) returns every invoice with its items and feedback eager-loaded, for internal review — there's no filtering/pagination.
- **Customer segments**: a lightweight, unauthenticated feature (`customerSegment.*`) for saving a named list of customers (with optional `filter_criteria`) as a single JSON blob per segment — not linked to invoices or any other table.
- **Global customer list**: `GET /api/v1/customers/customers-list` (`customerList.*`) dedupes customers across every saved `CustomerSegment.customer_list` by phone number (first occurrence wins), returning one flat array with `phone`/`name`/`last_feedback` per customer. Read-only, unauthenticated; does not touch any table other than `customer_segments`.
- **Auth model**: two independent mechanisms, neither shared:
  - POS ingest: a static shared secret (`POS_API_KEY`) compared against the `X-API-KEY` request header.
  - Admin routes (except `/login`): a JWT issued by `POST /api/v1/admin/login` (credentials checked against `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`), verified against `JWT_SECRET`.
  - Customer segment routes have no auth at all.

## Code style note

Many existing comments are written in Hinglish (Roman Urdu/Hindi mixed with English), explaining non-obvious *why* decisions — e.g. why request validation lives in the controller rather than the service.
