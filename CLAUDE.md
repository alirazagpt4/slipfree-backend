# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start with nodemon (auto-restart)
npm start        # start with node
```

There is no build step, lint config, or test suite/runner in this repo. Manual API testing is done via `api.rest` (REST Client format).

The server requires a running MySQL instance matching the credentials in `.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_DIALECT`). On startup (`server.js`), Sequelize calls `authenticate()`, then `sync()` **only when `NODE_ENV !== 'production'`** — tables are created/altered automatically from the model definitions in dev, but not synced in production (no migration files exist either way).

`generateHash.js` is a one-off script (not wired into any route) for generating a bcrypt hash to put in `ADMIN_PASSWORD_HASH`.

## Architecture

Digital Receipt System backend: POS terminals (and an automated Oracle sync job) ingest invoices; customers view receipts and leave feedback via a public hash-based URL; an admin panel and a customer-segmentation feature sit alongside. ESM throughout (`"type": "module"` in package.json). `public/` holds a pre-built React SPA served statically, with a catch-all route in `app/app.js` falling back to `public/index.html` for any non-`/api` path.

Request flow for the core receipt pipeline is a strict layered pipeline, and each layer has one job:

```
routes/*.routes.js → middlewares/ → controllers/*.controller.js → services/*.service.js → models/ (Sequelize)
```

- **Routes** wire URLs to controllers and attach middleware (e.g. `checkApiKey` only guards `POST /ingest`, not the public read/feedback endpoints).
- **Controllers** own HTTP concerns only: request validation (Zod schemas from `validators/`) and shaping the JSON response/status code. They do not talk to the DB directly.
- **Services** own business logic and all DB access (via the Sequelize models). They throw `Error` objects with a `.statusCode` property for expected failure cases (e.g. 404 invoice not found, 409 duplicate feedback); controllers read `error.statusCode` and fall back to 500.
- **Models** (`models/*.model.js`) define Sequelize schemas individually; `models/associations.model.js` is the single place where relationships between them are wired up (`Invoice.hasMany(InvoiceItem)`, `Invoice.hasOne(Feedback)`) and is the canonical import point for models used together.

Routes are mounted in `app/app.js`: receipts + feedback under `/api/v1/receipts`, admin under `/api/v1/admin`, customer segments under `/api/v1` (i.e. `/api/v1/segments`).

### Two invoice-creation entry points

`services/invoice.service.js::createInvoice` is the single choke point for creating an invoice, but it's called from two places:

1. `POST /api/v1/receipts/ingest` — manual POS ingest, guarded by `checkApiKey`.
2. `jobs/syncRunner.job.js` — a `node-cron` job started from `server.js` on boot, running every minute. It pulls new sales directly from an on-prem Oracle "Retail Pro" DB (`services/posSync.service.js`, a large hand-written SQL query against `RPS.DOCUMENT`/`DOCUMENT_ITEM`/`TENDER`), maps them to the same shape via `mapRetailProSaleToOurFormat`, and calls `createInvoice` per sale. A module-level `isSyncRunning` flag prevents overlapping runs. Per-sale errors are caught individually so one bad row doesn't stop the batch.

Both paths therefore inherit the same idempotency and transactional behavior described below, and both can trigger a WhatsApp dispatch.

### Key domain behaviors

- **Public identifier**: invoices are looked up externally by `receipt_hash` (random 16-byte hex from `utils/hash.js`), never by DB primary key. `RECEIPT_BASE_URL` + hash forms the customer-facing receipt URL.
- **Idempotency**: invoice creation is keyed on `idempotencyKey` — if an invoice with that key already exists, the existing receipt is returned (200) instead of creating a duplicate (201 for genuinely new invoices). The Oracle sync path derives this key as `rp-${DOC_SID}`.
- **Transactional writes**: invoice creation and its line items are inserted together inside one `sequelize.transaction`.
- **Feedback is one-shot**: enforced both at the DB level (`invoice_id` unique constraint on the `Feedback` model) and explicitly in `services/feedback.service.js` (returns 409 if feedback already exists for that invoice). On successful submission, feedback is also pushed (non-blocking, fire-and-forget) to the same Oracle DB via `services/oracleFeedback.service.js`.
- **WhatsApp receipts**: `services/whatsapp.service.js` sends the receipt link via the Ginkgo Retail WhatsApp API whenever an invoice with a customer phone number is created (from either entry point). Dispatch is non-blocking/best-effort — failures are logged, never surfaced to the caller.
- **Auth**: two independent auth mechanisms, neither shared:
  - POS ingest: static shared secret compared against `POS_API_KEY` in the `X-API-KEY` header (`middlewares/auth.js`).
  - Admin routes (`/api/v1/admin/*` except `/login`): JWT bearer token issued by `POST /api/v1/admin/login` (checked against `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`), verified by `middlewares/authAdmin.middleware.js` using `JWT_SECRET`.
  - Customer segment routes (`/api/v1/segments`) have no auth.

### Code comments

Many existing comments are written in Hinglish (Roman Urdu/Hindi mixed with English) to explain non-obvious *why* decisions (e.g. why validation lives in the controller instead of the service). Match this style if adding comments to the same files rather than switching to English-only.

## Working style

Act as a junior developer on this project, not an autonomous lead. The repo owner reviews and directs all decisions.

- Follow the owner's instructions strictly and literally. Do not take initiative on scope, architecture, refactors, or "obvious" improvements they didn't ask for.
- If an instruction is ambiguous, or a change would ripple beyond the specific files/behavior asked about, stop and ask rather than deciding unilaterally.
- Do not make judgment calls on tradeoffs (e.g. libraries, patterns, DB schema changes) — surface the options and let the owner pick.
- Keep changes minimal and scoped to exactly what was requested.
