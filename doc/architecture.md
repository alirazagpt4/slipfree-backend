# Architecture

## Overview

RS-Backend is the backend for a Digital Receipt System. POS terminals submit invoices (receipts) to the API; customers view their receipt and leave feedback via a public link built from a receipt hash.

Built with Express 5 + Sequelize (MySQL), using ES modules throughout.

## Request flow

Every request follows the same layered pipeline, entering at `app/app.js` and mounted under `/api/v1/receipts`:

```
routes/*.routes.js → middlewares/ → controllers/*.controller.js → services/*.service.js → models/ (Sequelize)
```

Each layer has one job:

- **Routes** (`routes/`) map an HTTP method + path to a controller function, and attach any middleware. For example, `checkApiKey` only guards `POST /ingest` — the read (`GET /:hash`) and feedback (`POST /:hash/feedback`) endpoints are public.
- **Middlewares** (`middlewares/`) handle cross-cutting HTTP concerns — currently just API key auth (`auth.js`).
- **Controllers** (`controllers/`) own HTTP concerns only: parsing/validating the request (via Zod schemas in `validators/`), calling a service, and shaping the JSON response and status code. They never talk to the database directly.
- **Services** (`services/`) own business logic and all database access. They throw plain `Error` objects with a `.statusCode` property for expected failure cases (e.g. 404 invoice not found, 409 duplicate feedback); controllers read `error.statusCode` and default to 500 if absent.
- **Models** (`models/`) define Sequelize schemas, one per table. `models/associations.model.js` is the single place relationships are wired up and is the canonical import point when more than one model is needed together.

## Key domain behaviors

- **Hash-based public identity**: invoices are never exposed externally by their database primary key. Each invoice gets a `receipt_hash` (16 random bytes, hex-encoded — `utils/hash.js`) generated at creation time. `GET /:hash` and the feedback endpoint both look invoices up by this hash. The customer-facing receipt URL is `${RECEIPT_BASE_URL}/${receipt_hash}`.
- **Idempotent ingest**: `POST /ingest` requires an `idempotencyKey` in the body. If an invoice with that key already exists, the existing receipt is returned with `duplicate: true` (HTTP 200) instead of creating a new one. Only genuinely new invoices return HTTP 201. See `services/invoice.service.js::createInvoice`.
- **Transactional writes**: an invoice and its line items are inserted together inside a single `sequelize.transaction`, so a failure partway through leaves no partial invoice.
- **One-shot feedback**: each invoice can receive at most one feedback entry. This is enforced twice — a unique constraint on `Feedback.invoice_id` at the DB level, and an explicit existence check in `services/feedback.service.js` that returns a 409 if feedback was already submitted.
- **Auth model**: there is no user/session auth anywhere in the API. The only protected route is POS ingest, gated by a static shared secret (`POS_API_KEY`) compared against the `X-API-KEY` request header.

## Code style note

Many existing comments are written in Hinglish (Roman Urdu/Hindi mixed with English), explaining non-obvious *why* decisions — e.g. why request validation lives in the controller rather than the service.
