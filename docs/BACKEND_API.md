# BACKEND_API.md

## Rating5 Complaints Extension — Backend API Contract

This document defines the API contract between the Chrome Extension and the Backend server.

---

## 1. General Information

### 1.1 Base URL

```
http://158.160.217.236
```

**Note:** This is hardcoded in `src/config/complaints-config.js` and `src/services/settings-service.js`.

### 1.2 Authentication

All API requests require Bearer token authentication.

**Header:**
```
Authorization: Bearer {token}
```

**Current Token (hardcoded):**
```
wbrm_0ab7137430d4fb62948db3a7d9b4b997
```

**Token Format:** `wbrm_{32_hex_characters}`

**Token Location:**
- `src/services/settings-service.js:91` (hardcoded)
- `src/diagnostic.js:15` (hardcoded)

### 1.3 Content Type

All requests and responses use JSON:

```
Content-Type: application/json
```

---

## 2. Endpoints

### 2.1 Get Stores

Retrieve list of available stores for the current token.

**Endpoint:**
```
GET /api/extension/stores
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Response:**
```json
[
  {
    "id": "store_123",
    "name": "Store Name",
    "isActive": true
  },
  {
    "id": "store_456",
    "name": "Another Store",
    "isActive": false
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique store identifier |
| name | string | Human-readable store name |
| isActive | boolean | Whether the store is active |

**Usage:** `diagnostic.js:loadStores()`

---

### 2.2 Get Complaints

Retrieve complaints for a store with filtering and pagination.

**Endpoint:**
```
GET /api/extension/stores/{storeId}/complaints
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| storeId | string | Yes | Store identifier |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 100 | Maximum number of complaints to return |
| filter | string | - | Filter by status (e.g., "draft") |
| rating | string | - | Filter by rating, comma-separated (e.g., "1,2,3") |

**Example Request:**
```
GET /api/extension/stores/store_123/complaints?limit=300&filter=draft&rating=1,2,3
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Response:**
```json
{
  "complaints": [
    {
      "id": "complaint_abc123",
      "productId": "649502497",
      "nmId": "649502497",
      "rating": 1,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "text": "Terrible product, not as described...",
      "authorName": "Покупатель",
      "complaintText": {
        "reasonId": "fake",
        "reasonName": "Ненастоящий отзыв",
        "complaintText": "Данный отзыв содержит недостоверную информацию..."
      },
      "status": "draft"
    }
  ],
  "total": 150,
  "stats": {
    "draft": 150,
    "sent": 45,
    "rejected": 10
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| complaints | array | Array of complaint objects |
| total | number | Total number of complaints matching filter |
| stats | object | Statistics by status |

**Complaint Object:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique complaint identifier (used for marking as sent) |
| productId | string | WB product article number |
| nmId | string | WB nmId (same as productId) |
| rating | number | Review rating (1-5 stars) |
| reviewDate | string | Review date in ISO 8601 format |
| text | string | Original review text |
| authorName | string | Review author name |
| complaintText | object | Parsed complaint data |
| status | string | Current status: "draft", "sent", "rejected" |

**complaintText Object:**

| Field | Type | Description |
|-------|------|-------------|
| reasonId | string | WB complaint reason ID (e.g., "fake", "spam") |
| reasonName | string | Human-readable reason name |
| complaintText | string | Generated complaint text |

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Invalid or expired token |
| 404 | Store not found |
| 429 | Rate limit exceeded |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706450000
```

**Usage:** `src/api/pilot-api.js:getComplaints()`

---

### 2.3 Mark Complaint as Sent

Mark a complaint as submitted to WB.

**Endpoint:**
```
POST /api/stores/{storeId}/reviews/{reviewId}/complaint/sent
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| storeId | string | Yes | Store identifier |
| reviewId | string | Yes | Complaint/Review identifier |

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "sentAt": "2026-01-28T12:00:00.000Z",
  "duration": 5.2
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sentAt | string | No | Submission timestamp (ISO 8601), defaults to now |
| duration | number | No | Time taken to submit in seconds |

**Response (Success):**
```json
{
  "success": true,
  "reviewId": "complaint_abc123",
  "status": "sent",
  "sentAt": "2026-01-28T12:00:00.000Z"
}
```

**Response (Already Sent - 409):**
```json
{
  "success": true,
  "message": "Complaint already sent",
  "duplicate": true,
  "reviewId": "complaint_abc123"
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Successfully marked as sent |
| 401 | Invalid or expired token |
| 404 | Review not found |
| 409 | Already marked as sent (idempotent) |

**Note:** The 409 response is treated as success for idempotency. Repeated calls with the same reviewId are safe.

**Usage:** `src/api/pilot-api.js:markComplaintAsSent()`

---

### 2.4 Sync Review Statuses

Send parsed review statuses from WB page to backend for optimization.

**Endpoint:**
```
POST /api/extension/review-statuses
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "storeId": "store_123",
  "parsedAt": "2026-01-28T12:00:00.000Z",
  "reviews": [
    {
      "reviewKey": "649502497_1_2026-01-07T20:09",
      "productId": "649502497",
      "rating": 1,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "statuses": ["Жалоба отклонена", "Выкуп"],
      "canSubmitComplaint": false
    }
  ]
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | string | Yes | Store identifier |
| parsedAt | string | No | When statuses were parsed (ISO 8601) |
| reviews | array | Yes | Array of review status objects |

**Review Status Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reviewKey | string | Yes | Normalized key: `{productId}_{rating}_{timestamp}` |
| productId | string | Yes | WB product article |
| rating | number | Yes | Review rating (1-5) |
| reviewDate | string | Yes | Review date (ISO 8601) |
| statuses | array | Yes | Array of status strings from WB UI |
| canSubmitComplaint | boolean | Yes | Whether new complaint can be submitted |

**Key Normalization:**
The reviewKey timestamp is normalized to remove seconds:
```
649502497_1_2026-01-07T20:09:37.000Z
→ 649502497_1_2026-01-07T20:09
```

**Response:**
```json
{
  "success": true,
  "data": {
    "received": 50,
    "created": 30,
    "updated": 20,
    "errors": 0
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| received | number | Total reviews in request |
| created | number | New status records created |
| updated | number | Existing records updated |
| errors | number | Records that failed to process |

**Batch Limit:** Maximum 100 reviews per request.

**Usage:** `src/services/status-sync-service.js:syncStatuses()`

---

### 2.5 Health Check

Check API availability.

**Endpoint:**
```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

---

## 3. Error Responses

### 3.1 Standard Error Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### 3.2 Common Error Codes

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Invalid or missing token |
| 403 | FORBIDDEN | Token doesn't have access to resource |
| 404 | NOT_FOUND | Resource not found |
| 409 | ALREADY_SENT | Complaint already marked as sent |
| 429 | RATE_LIMIT | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

### 3.3 Extension Error Handling

```javascript
// pilot-api.js error handling
if (response.status === 401) {
  throw new Error('Ошибка авторизации: проверьте Backend Token');
} else if (response.status === 404) {
  throw new Error('Магазин не найден: проверьте Store ID');
} else if (response.status === 429) {
  throw new Error('Превышен лимит запросов. Пожалуйста, подождите.');
}
```

---

## 4. Retry Behavior

### 4.1 Automatic Retry

The extension uses `fetchWithRetry` for complaint loading:

```javascript
{
  maxRetries: 3,
  baseDelay: 1000,  // 1 second
  shouldRetry: (response) => response.status === 503
}
```

Only 503 (Service Unavailable) triggers automatic retry.

### 4.2 Rate Limit Protection

Status sync batches include 500ms delay between requests:
```javascript
// Between status sync batches
await sleep(500);
```

---

## 5. Data Flow

### 5.1 Complaint Processing Flow

```
1. Extension loads complaints
   GET /api/extension/stores/{storeId}/complaints?filter=draft

2. Extension processes each complaint on WB page
   (DOM interaction, form submission)

3. Extension marks complaint as sent
   POST /api/stores/{storeId}/reviews/{reviewId}/complaint/sent

4. Extension syncs statuses (background)
   POST /api/extension/review-statuses
```

### 5.2 Review Key Generation

```javascript
// Generated in extension
const reviewKey = `${productId}_${rating}_${reviewDate}`;

// Example
"649502497_1_2026-01-07T20:09:37.000Z"

// Normalized for API (remove seconds)
"649502497_1_2026-01-07T20:09"
```

---

## 6. Configuration

### 6.1 Current Settings

| Setting | Value | Location |
|---------|-------|----------|
| Base URL | `http://158.160.217.236` | settings-service.js |
| Token | `wbrm_0ab7137430d4fb62948db3a7d9b4b997` | settings-service.js |
| Batch size | 200 | complaints-config.js |
| Status sync batch | 100 | status-sync-service.js |

### 6.2 Changing Configuration

Token and endpoint are currently hardcoded. To change:

1. Update `src/services/settings-service.js`
2. Update `src/config/complaints-config.js`
3. Update `src/diagnostic.js` (if applicable)
4. Rebuild extension

**Future:** Move to `chrome.storage.sync` for dynamic configuration.

---

## 7. Blocking Statuses

Statuses that prevent new complaint submission:

| Status (Russian) | Meaning |
|-----------------|---------|
| Жалоба отклонена | Complaint rejected |
| Жалоба одобрена | Complaint approved |
| Проверяем жалобу | Complaint under review |
| Жалоба пересмотрена | Complaint reconsidered |

When any of these statuses is present in `statuses[]` array, `canSubmitComplaint` should be `false`.

---

## 8. API Versioning

Current API has no versioning. Endpoints are under `/api/`.

**Recommendation:** Future versions should use `/api/v2/` path prefix.

---

## 9. Quick Reference

### Get Complaints
```bash
curl -H "Authorization: Bearer wbrm_xxx" \
  "http://158.160.217.236/api/extension/stores/STORE_ID/complaints?limit=100&filter=draft"
```

### Mark as Sent
```bash
curl -X POST \
  -H "Authorization: Bearer wbrm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"sentAt":"2026-01-28T12:00:00.000Z"}' \
  "http://158.160.217.236/api/stores/STORE_ID/reviews/REVIEW_ID/complaint/sent"
```

### Sync Statuses
```bash
curl -X POST \
  -H "Authorization: Bearer wbrm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"xxx","reviews":[...]}' \
  "http://158.160.217.236/api/extension/review-statuses"
```
