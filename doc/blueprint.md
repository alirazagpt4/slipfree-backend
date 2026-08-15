# Blueprint

A single-page overview of what RS-Backend is and how its pieces fit together. For details, see the linked docs.

## What it is

Backend for a Digital Receipt System ("Slipfree"). POS terminals (and an automated Oracle sync job) create invoices; customers view their receipt and leave feedback via a public hash-based link; an internal admin panel reviews all invoices; a customer-segmentation feature manages named customer lists for marketing. A pre-built React SPA is served from the same Express app.

Stack: Node.js (ESM), Express 5, Sequelize (MySQL), `node-cron`, `oracledb` (for the Retail Pro integration), JWT + bcrypt (admin auth), Zod (POS ingest validation), Axios (WhatsApp dispatch). No build step, no test suite, no migrations — schema is Sequelize-synced from model definitions. Runs on a VPS (deployed via manual SSH, no CI/CD pipeline in this repo).

## Feature map

| Feature | Entry points | Auth | Docs |
|---|---|---|---|
| Receipt ingest & retrieval | `POST /api/v1/receipts/ingest`, `GET /api/v1/receipts/:hash` | API key (ingest only) | [api.md](api.md), [architecture.md](architecture.md) |
| Retail Pro → receipt sync | `jobs/syncRunner.job.js` (cron, every minute) → same `createInvoice` as ingest | n/a (server-side job) | [architecture.md](architecture.md) |
| Customer feedback | `POST /api/v1/receipts/:hash/feedback` | none | [api.md](api.md) |
| WhatsApp receipt delivery | fired automatically after invoice creation | n/a | [architecture.md](architecture.md) |
| Admin login & invoice review | `POST /api/v1/admin/login`, `GET /api/v1/admin/invoices` | JWT | [api.md](api.md) |
| Customer segments | `POST /api/v1/segments`, `GET /api/v1/segments` | none | [api.md](api.md) |
| React SPA hosting | any non-`/api` path → `public/index.html` | n/a | — |

## Data flow

```
POS terminal ──POST /ingest──┐
                              ├──> invoice.service.createInvoice ──> MySQL (invoices, invoice_items)
Retail Pro (Oracle) ──cron───┘         │
                                        ├──> WhatsApp (Ginkgo API), if phone present
                                        └──> receipt_hash returned / used to build public URL

Customer ──GET /:hash──> MySQL (invoice + items)
Customer ──POST /:hash/feedback──> MySQL (invoice_feedback) ──async──> Oracle (invoice_feedback)

Admin ──POST /login──> JWT
Admin ──GET /invoices (JWT)──> MySQL (all invoices + items + feedback)

Marketer ──POST/GET /segments──> MySQL (customer_segments)
```

## Layering (core receipt pipeline)

```
routes/*.routes.js → middlewares/ → controllers/*.controller.js → services/*.service.js → models/ (Sequelize)
```

Routes wire URLs to controllers; controllers own HTTP concerns (validation, status codes) and never touch the DB; services own business logic and all DB/external-system access, throwing `Error` objects with `.statusCode` for expected failures; models define schema, with `models/associations.model.js` as the canonical place relationships are wired. Full explanation: [architecture.md](architecture.md).

## Data stores

- **MySQL** (via Sequelize) — system of record: `invoices`, `invoice_items`, `invoice_feedback`, `customer_segments`. Schema: [database.md](database.md).
- **Oracle "Retail Pro"** (via `oracledb`, read for sync / write for feedback) — the POS/retail system of record this backend integrates with. Not modeled in Sequelize; queried directly in `services/posSync.service.js` and `services/oracleFeedback.service.js`.

## External services

- **Ginkgo Retail WhatsApp API** — delivers the receipt link to the customer's phone (`services/whatsapp.service.js`), best-effort/non-blocking.

## Config surface

All runtime config is environment variables (`.env`, git-ignored) — DB connection, `POS_API_KEY`, `RECEIPT_BASE_URL`, admin/JWT secrets, Oracle connection, Ginkgo WhatsApp credentials. Full list: [setup.md](setup.md).

## Where things live

```
app/app.js                 Express app assembly, route mounting, SPA fallback
server.js                  boot: DB connect/sync, start HTTP server, start cron sync
jobs/syncRunner.job.js     Retail Pro → invoice sync cron job
routes/                    URL → controller wiring + middleware
middlewares/               API key auth (POS), JWT auth (admin)
controllers/               HTTP request/response shaping, input validation
validators/                Zod schemas (POS ingest only)
services/                  business logic + all DB/external I/O
models/                    Sequelize schema + associations
public/                    pre-built React SPA (served statically)
doc/                       this documentation set
```
