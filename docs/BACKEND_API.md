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
    "isActive": true,
    "draftComplaintsCount": 45
  },
  {
    "id": "store_456",
    "name": "Another Store",
    "isActive": false,
    "draftComplaintsCount": 0
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique store identifier |
| name | string | Human-readable store name |
| isActive | boolean | Whether the store is active |
| draftComplaintsCount | number | **NEW (v1.2.0):** Count of complaints in `draft` status for active products |

> **Note:** `draftComplaintsCount` only includes complaints for products with `work_status = 'active'`.
> Products "on stop" are excluded from the count.

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
    "pending": 45,
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
| status | string | Current status: "draft", "pending", "approved", "rejected", "reconsidered" |

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

### 2.3 Mark Complaint as Sent (Pending)

Mark a complaint as submitted to WB. Status changes to `pending` (under review).

**Endpoint:**
```
POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent
```

> **Note:** Updated 2026-02-03. Previously used `/api/stores/...` (without `/extension/`).
> Status `sent` was removed - complaints go directly to `pending`.

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
  "review_id": "complaint_abc123",
  "new_status": "pending",
  "sent_at": "2026-01-28T12:00:00.000Z",
  "message": "Complaint marked as pending (under review)"
}
```

**Response (Not in Draft - 400):**
```json
{
  "error": "Bad request",
  "message": "Complaint is not in draft status (current: pending)"
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Successfully marked as pending |
| 400 | Complaint not in draft status |
| 401 | Invalid or expired token |
| 404 | Review not found |

**Note:** Complaints can only transition from `draft` → `pending`. Subsequent calls return 400.

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
      "canSubmitComplaint": false,
      "chatStatus": "chat_opened"
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
| chatStatus | string\|null | No | Chat button state: `"chat_not_activated"` / `"chat_available"` / `"chat_opened"` / `null` |

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
    "errors": 0,
    "synced": 15,
    "chatStatusSynced": 42,
    "syncErrors": 0
  },
  "message": "Статусы успешно синхронизированы"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| received | number | Total reviews in request |
| created | number | New status records created |
| updated | number | Existing records updated |
| errors | number | Records that failed to process |
| synced | number | Reviews matched and synced with main reviews table |
| chatStatusSynced | number | Reviews where `chat_status_by_review` was updated |
| syncErrors | number | Errors during sync with main reviews table |

**chatStatus Mapping (extension → DB):**

| Extension sends | DB stores (ENUM) |
|----------------|------------------|
| `chat_not_activated` | `unavailable` |
| `chat_available` | `available` |
| `chat_opened` | `opened` |
| `null` | `unknown` |

**Matching logic:** Backend matches by `store_id + product_id + rating + DATE_TRUNC('minute', review_date)`.

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

### 2.6 Chat API — Get Chat Rules

Retrieve chat opening rules for a store's products. Used by merged workflow to decide which reviews need chat opening.

**Endpoint:**
```
GET /api/extension/chat/stores/{storeId}/rules
```

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "storeId": "store_123",
  "globalLimits": {
    "maxChatsPerRun": 50,
    "cooldownBetweenChatsMs": 3000
  },
  "items": [
    {
      "nmId": "649502497",
      "productTitle": "Футболка мужская",
      "isActive": true,
      "chatEnabled": true,
      "starsAllowed": [1, 2, 3],
      "requiredComplaintStatus": "rejected"
    }
  ]
}
```

**Usage:** `src/services/chat-api.js:getChatRules()`

---

### 2.7 Chat API — Register Chat Opened

Register that the extension opened a chat tab for a review. Idempotent (UPSERT by store_id + review_key).

**Endpoint:**
```
POST /api/extension/chat/opened
```

**Request Body:**
```json
{
  "storeId": "store_123",
  "reviewContext": {
    "nmId": "649502497",
    "rating": 1,
    "reviewDate": "2026-01-07T20:09:37.000Z",
    "reviewKey": "649502497_1_2026-01-07T20:09"
  },
  "chatUrl": "https://seller.wildberries.ru/chat-with-clients?chatId=a8775c6f-049b-da67-1045-421477a8bfcb",
  "openedAt": "2026-02-19T14:30:00.000Z",
  "status": "CHAT_OPENED"
}
```

**Response:**
```json
{
  "success": true,
  "chatRecordId": "uuid-here",
  "reviewMatched": true,
  "message": "Chat record created"
}
```

**HTTP Status:** 201 (new) or 200 (existing UPSERT).

**Usage:** `src/services/chat-api.js:chatOpened()`

---

### 2.8 Chat API — Send Anchor Data

Send parsed system anchor message from the chat tab.

**Endpoint:**
```
POST /api/extension/chat/{chatRecordId}/anchor
```

**Request Body:**
```json
{
  "systemMessageText": "Чат с покупателем по товару 649502497",
  "parsedNmId": "649502497",
  "parsedProductTitle": "",
  "anchorFoundAt": "2026-02-19T14:30:05.000Z",
  "status": "ANCHOR_FOUND"
}
```

**Status values:** `ANCHOR_FOUND`, `ANCHOR_NOT_FOUND`

**Usage:** `src/services/chat-api.js:sendAnchor()`

---

### 2.9 Chat API — Log Error

Log an error during chat workflow processing.

**Endpoint:**
```
POST /api/extension/chat/{chatRecordId}/error
```

**Request Body:**
```json
{
  "errorCode": "ERROR_TAB_TIMEOUT",
  "errorMessage": "Chat tab not detected within 10s",
  "stage": "TAB_DETECTION",
  "occurredAt": "2026-02-19T14:30:10.000Z"
}
```

**Error Codes:** `ERROR_TAB_TIMEOUT`, `ERROR_ANCHOR_NOT_FOUND`, `ERROR_DOM_CHANGED`, `ERROR_SEND_FAILED`, `ERROR_UNKNOWN`

**Usage:** `src/services/chat-api.js:logError()`

---

### 2.10 Get Unified Tasks (v4.0)

Retrieve all pending tasks for a store in a single request. Replaces separate calls to `GET /complaints` and `GET /chat/rules`.

**Endpoint:**
```
GET /api/extension/stores/{storeId}/tasks
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Response:**
```json
{
  "storeId": "store_123",
  "articles": {
    "649502497": {
      "statusParses": [
        { "reviewKey": "649502497_1_2026-01-07T20:09", "rating": 1 }
      ],
      "chatOpens": [
        { "reviewKey": "649502497_2_2026-01-10T14:30", "rating": 2, "type": "open" },
        { "reviewKey": "649502497_1_2026-01-07T20:09", "rating": 1, "type": "link" }
      ],
      "complaints": [
        {
          "reviewKey": "649502497_1_2026-01-07T20:09",
          "rating": 1,
          "reasonId": 16,
          "reasonName": "Ненастоящий отзыв",
          "complaintText": "Данный отзыв содержит недостоверную информацию..."
        }
      ]
    }
  },
  "totals": {
    "statusParses": 150,
    "chatOpens": 42,
    "complaints": 88
  },
  "limits": {
    "maxComplaintsPerRun": 300,
    "cooldownBetweenComplaintsMs": 1500,
    "cooldownBetweenChatsMs": 2000
  }
}
```

**Task Types:**

| Type | Description |
|------|-------------|
| statusParses | Reviews that need status parsing on WB page |
| chatOpens | Chats to open/link. `type: "link"` = link existing chat, `type: "open"` = open new chat |
| complaints | Complaints to submit via WB UI |

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| storeId | string | Store identifier |
| articles | object | Tasks grouped by article (nmId) |
| totals | object | Total counts per task type |
| limits | object | Processing limits and cooldowns |

**reviewKey Format:** `{nmId}_{rating}_{YYYY-MM-DDTHH:mm}` — normalized (no seconds).

**reasonId:** Number (11-20), not string. Extension converts to string for WB radio button matching.

**Multi-round:** One GET = one round. Repeat until `totals` sum is 0. Backend excludes completed tasks from subsequent requests.

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Invalid or expired token |
| 404 | Store not found |
| 429 | Rate limit exceeded |

**Usage:** `src/api/pilot-api.js:getTasks()`

**Deprecates (not removed):** `GET /complaints` + `GET /chat/rules` — old endpoints remain for backward compatibility.

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

3. Extension marks complaint as pending
   POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent

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

### Mark as Sent (Pending)
```bash
curl -X POST \
  -H "Authorization: Bearer wbrm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"sentAt":"2026-01-28T12:00:00.000Z"}' \
  "http://158.160.217.236/api/extension/stores/STORE_ID/reviews/REVIEW_ID/complaint/sent"
```

### Sync Statuses
```bash
curl -X POST \
  -H "Authorization: Bearer wbrm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"xxx","reviews":[...]}' \
  "http://158.160.217.236/api/extension/review-statuses"
```
