# API Reference

Base URL for all receipt endpoints: `/api/v1/receipts`

All responses are JSON and include a top-level `success: boolean`.

---

## Utility endpoints

### `GET /health`

Health check.

**Response `200`**
```json
{ "status": "ok" }
```

Any other request path that doesn't start with `/api` is served the React SPA (`public/index.html`), not a JSON response.

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
        "product_name": "Coffee",
        "color": "Unknown Color",
        "size": "Unknown Size",
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

---

## Admin endpoints

Base path: `/api/v1/admin`

### `POST /api/v1/admin/login`

Exchanges admin credentials for a JWT (24h expiry).

**Auth**: none

**Request body**

| Field | Type | Required |
|---|---|---|
| `username` | string | yes |
| `password` | string | yes |

**Response `200`**
```json
{ "success": true, "token": "<jwt>" }
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `401` | Wrong `username` or `password` | `{ "success": false, "error": "Invalid credentials" }` |

### `GET /api/v1/admin/invoices`

Lists every invoice with its items and feedback eager-loaded, newest first. No filtering or pagination.

**Auth**: required. Header `Authorization: Bearer <jwt>` (from `/login`)

**Response `200`**
```json
{
  "success": true,
  "invoices": [
    {
      "id": 1,
      "receipt_hash": "e744ca5db55b71251aba0fca93357a99",
      "invoice_no": "INV-1001",
      "...": "all invoice columns",
      "items": [ "..." ],
      "feedback": { "rating": "good", "comment": "Fast service, thanks!", "submitted_at": "..." }
    }
  ]
}
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `401` | Missing `Authorization` header | `{ "success": false, "error": "Login required" }` |
| `403` | Invalid/expired JWT | `{ "success": false, "error": "Invalid or expired session" }` |
| `500` | Unexpected server/DB error | `{ "success": false, "error": "Internal server error" }` |

---

## Customer segment endpoints

Base path: `/api/v1`. No auth on either endpoint.

### `POST /api/v1/segments`

Saves a named list of customers as a segment.

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `segment_name` | string | yes | Non-empty |
| `filter_criteria` | object | no | Arbitrary, stored as-is |
| `customer_list` | array | yes | Non-empty. Each entry may have `customer_name`/`name`, `customer_phone`/`phone`, `feedback` — normalized server-side, missing name defaults to `"Walk-In Customer"`, missing phone to `"N/A"` |

**Response `201`**
```json
{
  "success": true,
  "message": "Segment saved successfully.",
  "data": {
    "id": 1,
    "segment_name": "VIP Customers",
    "filter_criteria": null,
    "customer_list": [ { "customer_name": "John Doe", "customer_phone": "9876543210", "feedback": "" } ],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `400` | Missing/empty `segment_name` | `{ "success": false, "message": "Segment name required." }` |
| `400` | Missing/empty `customer_list` | `{ "success": false, "message": "Customer list cannot be empty." }` |
| `500` | Unexpected server/DB error | `{ "success": false, "message": "<error message>" }` |

### `GET /api/v1/segments`

Lists all segments, newest first, with a computed `total_customers` count.

**Response `200`**
```json
{
  "success": true,
  "count": 1,
  "segments": [
    {
      "id": 1,
      "segment_name": "VIP Customers",
      "filter_criteria": null,
      "total_customers": 1,
      "created_at": "...",
      "customer_list": [ "..." ]
    }
  ]
}
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `500` | Unexpected server/DB error | `{ "success": false, "message": "<error message>" }` |

---

## Customer list endpoints

Base path: `/api/v1/customers`. No auth.

### `GET /api/v1/customers/customers-list`

Returns a deduplicated master list of customers across all saved segments (dedupes by phone number, first occurrence wins).

**Response `200`**
```json
{
  "success": true,
  "total_count": 1,
  "data": [
    { "phone": "9876543210", "name": "John Doe", "last_feedback": "Fast service, thanks!" }
  ]
}
```

**Errors**

| Status | Cause | Body |
|---|---|---|
| `500` | Unexpected server/DB error | `{ "success": false, "message": "Failed to retrieve unique customers list", "error": "<error message>" }` |
