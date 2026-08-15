# Setup Guide

## Prerequisites

- Node.js
- A running MySQL server

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
| `RECEIPT_BASE_URL` | Base URL used to build the public receipt link, e.g. `http://localhost:5173/v` |
| `POS_API_KEY` | Shared secret POS terminals must send in the `X-API-KEY` header to call `POST /api/v1/receipts/ingest` |
| `PORT` | *(optional)* Port for the server to listen on. Defaults to `3000` |

## Database

The database itself must already exist (create it manually, e.g. `CREATE DATABASE receipt_system;`). Tables are **not** managed by migrations — on every server start, Sequelize calls `sequelize.sync()`, which creates/updates tables to match the model definitions in `models/`.

You can verify DB connectivity on its own with:

```bash
node testConnection.js
```

## Run

```bash
npm run dev     # nodemon, auto-restarts on file changes
npm start        # plain node
```

On success the console prints:

```
✅ Database connected & synced.
🚀 Server running at http://localhost:3000
```

## Manual API testing

`api.rest` at the project root contains example requests usable with the VS Code REST Client extension.
