# Setup Guide

## Prerequisites

- Node.js
- A running MySQL server
- (Optional, only needed for the Retail Pro sync job and Oracle feedback push) network access to an Oracle database and Oracle client libraries required by `oracledb`

## Install

```bash
npm install
```

## Configure environment

Create a `.env` file in the project root (already git-ignored) with:

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (e.g. `3306`) |
| `DB_NAME` | Database name |
| `DB_USER` | MySQL user |
| `DB_PASS` | MySQL password |
| `DB_DIALECT` | Sequelize dialect (`mysql`) |
| `PORT` | *(optional)* Port for the server to listen on. Defaults to `3000` |
| `NODE_ENV` | When set to `production`, disables `sequelize.sync()` on startup (schema must already exist) |
| `RECEIPT_BASE_URL` | Base URL used to build the public receipt link, e.g. `http://localhost:5173/v` |
| `POS_API_KEY` | Shared secret POS terminals must send in the `X-API-KEY` header to call `POST /api/v1/receipts/ingest` |
| `ADMIN_USERNAME` | Username accepted by `POST /api/v1/admin/login` |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password, checked against the login request. Generate one with `generateHash.js` |
| `JWT_SECRET` | Signing secret for admin session tokens (24h expiry) |
| `ORA_USER` / `ORA_PASS` | Oracle DB credentials used by the Retail Pro sync job and Oracle feedback push |
| `ORA_HOST` / `ORA_PORT` / `ORA_SERVICE_NAME` | Oracle connection details |
| `GINKGO_WHATSAPP_URL` | Ginkgo Retail WhatsApp API endpoint used to dispatch receipt links |
| `GINKGO_API_KEY` | API key for the Ginkgo WhatsApp API |
| `WHATSAPP_TEMPLATE_NAME` | WhatsApp template name used for the receipt message |

`services/posSync.service.js` and `services/oracleFeedback.service.js` fall back to hardcoded defaults for some of the above (host/service name, and notably a default `GINKGO_API_KEY` in `whatsapp.service.js`) if the env vars are unset — always set them explicitly rather than relying on those defaults.

## Database

The database itself must already exist (create it manually, e.g. `CREATE DATABASE receipt_system;`). Tables are **not** managed by migrations — on server start, Sequelize calls `authenticate()`, and then `sync()` only when `NODE_ENV !== 'production'`, which creates/updates tables to match the model definitions in `models/`. In production, the schema must already be in place before starting the server.

## Run

```bash
npm run dev     # nodemon, auto-restarts on file changes
npm start        # plain node
```

On success the console prints:

```
✅ Database models synchronized.   (only outside production)
✅ Database connected & synced.
🚀 Server running at http://localhost:3000
⚙️ Retail Pro background sync engine initialized.
```

The last line means the `node-cron` job in `jobs/syncRunner.job.js` is now polling the Oracle Retail Pro database every minute for new sales — this requires the `ORA_*` env vars to be correctly configured, or it will log a fetch error each run and keep retrying.

## Manual API testing

`api.rest` at the project root contains example requests usable with the VS Code REST Client extension.

## Utility scripts

- `generateHash.js` — standalone script (not wired into any route) that prints a bcrypt hash for a given password, for use as `ADMIN_PASSWORD_HASH`.
