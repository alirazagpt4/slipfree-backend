# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start with nodemon (auto-restart)
npm start        # start with node
node testConnection.js   # standalone script to verify DB connectivity only
```

There is no build step, lint config, or test suite/runner in this repo. Manual API testing is done via `api.rest` (REST Client format) against `http://localhost:3000`.

The server requires a running MySQL instance matching the credentials in `.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_DIALECT`). On startup (`server.js`), Sequelize calls `authenticate()` then `sync()` — tables are created/altered automatically from the model definitions, there are no migration files.

## Architecture

Digital Receipt System backend: POS terminals ingest invoices via API key auth; customers view receipts and leave feedback via a public hash-based URL. ESM throughout (`"type": "module"` in package.json).

Request flow is a strict layered pipeline, and each layer has one job:

```
routes/*.routes.js → middlewares/ → controllers/*.controller.js → services/*.service.js → models/ (Sequelize)
```

- **Routes** wire URLs to controllers and attach middleware (e.g. `checkApiKey` only guards `POST /ingest`, not the public read/feedback endpoints).
- **Controllers** own HTTP concerns only: request validation (Zod schemas from `validators/`) and shaping the JSON response/status code. They do not talk to the DB directly.
- **Services** own business logic and all DB access (via the Sequelize models). They throw `Error` objects with a `.statusCode` property for expected failure cases (e.g. 404 invoice not found, 409 duplicate feedback); controllers read `error.statusCode` and fall back to 500.
- **Models** (`models/*.model.js`) define Sequelize schemas individually; `models/associations.model.js` is the single place where relationships between them are wired up (`Invoice.hasMany(InvoiceItem)`, `Invoice.hasOne(Feedback)`) and is the canonical import point for models used together.

All routes are mounted under `/api/v1/receipts` in `app/app.js`.

### Key domain behaviors

- **Public identifier**: invoices are looked up externally by `receipt_hash` (random 16-byte hex from `utils/hash.js`), never by DB primary key. `RECEIPT_BASE_URL` + hash forms the customer-facing receipt URL.
- **Idempotency**: `POST /ingest` is keyed on `idempotencyKey` in the request body — if an invoice with that key already exists, the existing receipt is returned (200) instead of creating a duplicate (201 for genuinely new invoices). See `services/invoice.service.js::createInvoice`.
- **Transactional writes**: invoice creation and its line items are inserted together inside one `sequelize.transaction`.
- **Feedback is one-shot**: enforced both at the DB level (`invoice_id` unique constraint on the `Feedback` model) and explicitly in `services/feedback.service.js` (returns 409 if feedback already exists for that invoice).
- **Auth**: only the POS ingest endpoint is protected, via a static shared secret compared against `POS_API_KEY` in the `X-API-KEY` header (`middlewares/auth.js`). No user auth/sessions exist anywhere else in the API.

### Code comments

Many existing comments are written in Hinglish (Roman Urdu/Hindi mixed with English) to explain non-obvious *why* decisions (e.g. why validation lives in the controller instead of the service). Match this style if adding comments to the same files rather than switching to English-only.

## Working style

Act as a junior developer on this project, not an autonomous lead. The repo owner reviews and directs all decisions.

- Follow the owner's instructions strictly and literally. Do not take initiative on scope, architecture, refactors, or "obvious" improvements they didn't ask for.
- If an instruction is ambiguous, or a change would ripple beyond the specific files/behavior asked about, stop and ask rather than deciding unilaterally.
- Do not make judgment calls on tradeoffs (e.g. libraries, patterns, DB schema changes) — surface the options and let the owner pick.
- Keep changes minimal and scoped to exactly what was requested.
