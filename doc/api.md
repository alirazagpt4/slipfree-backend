# API Reference

Base URL for all receipt endpoints: `/api/v1/receipts`

All responses are JSON and include a top-level `success: boolean`.

---

## Utility endpoints

### `GET /`

Root status check.

**Response `200`**
```json
{ "status": "ok", "message": "Digital Receipt System running" }
```

### `GET /health`

Health check.

**Response `200`**
```json
{ "status": "ok" }
```

---

## `POST /api/v1/receipts/ingest`

Creates a new invoice/receipt. Called by POS terminals.

**Auth**: required. Header `X-API-KEY: <POS_API_KEY>`

**Request body**

Validated against `validators/invoiceSchema.js` (Zod).

| Field | Type | Required | Notes |
|---|---|---|---|
| `storeId` | number (positive int) | yes | |
| `invoiceNo` | string | yes | Must be unique |
| `idempotencyKey` | string | yes | Repeating this key returns the existing receipt instead of creating a duplicate |
| `billTo` | string | no | Customer name |
| `customerPhone` | string | no | |
| `paymentMode` | `"Cash"` \| `"Card"` | yes | |
| `items` | array (min 1) | yes | See below |
| `items[].name` | string | yes | |
| `items[].qty` | number (positive) | yes | |
| `items[].price` | number (>= 0) | yes | |
| `items[].gstPercent` | number (>= 0) | yes | |
| `summary` | object | yes | See below |
| `summary.total` | number (>= 0) | yes | |
| `summary.discount` | number (>= 0) | no | Default `0` |
| `summary.gst` | number (>= 0) | yes | |
| `summary.posFee` | number (>= 0) | no | Default `1.0` |
| `summary.payable` | number (>= 0) | yes | |

**Example request**
```json
POST /api/v1/receipts/ingest
X-API-KEY: test-key-123
Content-Type: application/json

{
  "storeId": 1,
  "invoiceNo": "INV-1001",
  "idempotencyKey": "b7e2f8b0-19a3-4e2e-9b7a-3a6c9c5f1d2e",
  "billTo": "John Doe",
  "customerPhone": "9876543210",
  "paymentMode": "Cash",
  "items": [
    { "name": "Coffee", "qty": 2, "price": 150, "gstPercent": 5 }
  ],
  "summary": {
    "total": 300,
    "discount": 0,
    "gst": 15,
    "posFee": 1.0,
    "payable": 316
  }
}
```

**Response `201`** — new invoice created
```json
{
  "success": true,
  "duplicate": false,
  "receiptHash": "e744ca5db55b71251aba0fca93357a99",
  "receiptUrl": "http://localhost:5173/v/e744ca5db55b71251aba0fca93357a99"
}
```

**Response `200`** — same `idempotencyKey` as an existing invoice; no new record created
```json
{
  "success": true,
  "duplicate": true,
  "receiptHash": "e744ca5db55b71251aba0fca93357a99",
  "receiptUrl": "http://localhost:5173/v/e744ca5db55b71251aba0fca93357a99"
}
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `400` | Body fails Zod validation | `{ "success": false, "errors": [ ...zod issues... ] }` |
| `401` | Missing `X-API-KEY` header | `{ "success": false, "error": "Missing X-API-KEY header" }` |
| `403` | `X-API-KEY` doesn't match `POS_API_KEY` | `{ "success": false, "error": "Invalid API key" }` |
| `500` | Unexpected server/DB error | `{ "success": false, "error": "Internal server error" }` |

---

## `GET /api/v1/receipts/:hash`

Fetches a receipt (invoice + line items) by its public hash. Used by the customer-facing receipt page.

**Auth**: none

**Example request**
```
GET /api/v1/receipts/e744ca5db55b71251aba0fca93357a99
```

**Response `200`**
```json
{
  "success": true,
  "invoice": {
    "id": 1,
    "receipt_hash": "e744ca5db55b71251aba0fca93357a99",
    "invoice_no": "INV-1001",
    "idempotency_key": "b7e2f8b0-19a3-4e2e-9b7a-3a6c9c5f1d2e",
    "store_id": 1,
    "customer_name": "John Doe",
    "customer_phone": "9876543210",
    "total_amount": "300.00",
    "discount": "0.00",
    "gst_amount": "15.00",
    "pos_fee": "1.00",
    "payable_amount": "316.00",
    "payment_mode": "Cash",
    "created_at": "2026-08-12T10:00:00.000Z",
    "items": [
      {
        "id": 1,
        "invoice_id": 1,
        "item_name": "Coffee",
        "quantity": 2,
        "unit_price": "150.00",
        "gst_percent": "5.00",
        "total_price": "315.00"
      }
    ]
  }
}
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `404` | No invoice with that hash | `{ "success": false, "error": "Receipt not found" }` |
| `500` | Unexpected server/DB error | `{ "success": false, "error": "Internal server error" }` |

---

## `POST /api/v1/receipts/:hash/feedback`

Submits feedback for a receipt. Can only be called once per receipt.

**Auth**: none

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `rating` | `"worst"` \| `"not_good"` \| `"fine"` \| `"good"` \| `"best"` | yes | |
| `comment` | string | no | |

**Example request**
```json
POST /api/v1/receipts/e744ca5db55b71251aba0fca93357a99/feedback
Content-Type: application/json

{
  "rating": "good",
  "comment": "Fast service, thanks!"
}
```

**Response `201`**
```json
{
  "success": true,
  "feedback": {
    "rating": "good",
    "comment": "Fast service, thanks!",
    "submitted_at": "2026-08-12T10:05:00.000Z"
  }
}
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `400` | Missing/invalid `rating` | `{ "success": false, "error": "rating must be one of: worst, not_good, fine, good, best" }` |
| `404` | No invoice with that hash | `{ "success": false, "error": "Invoice not found" }` |
| `409` | Feedback already submitted for this receipt | `{ "success": false, "error": "Feedback already submitted for this receipt" }` |
| `500` | Unexpected server/DB error | `{ "success": false, "error": "Internal server error" }` |
