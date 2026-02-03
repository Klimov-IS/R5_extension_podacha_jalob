# WORKFLOWS.md

## Rating5 Complaints Extension — Business Workflows

This document describes the step-by-step workflows implemented by the extension.

---

## Table of Contents

1. [Complaint Submission Workflow](#1-complaint-submission-workflow)
2. [Status Synchronization Workflow](#2-status-synchronization-workflow)
3. [Diagnostic/Manual Run Workflow](#3-diagnosticmanual-run-workflow)
4. [Error Handling and Retry Behavior](#4-error-handling-and-retry-behavior)

---

## 1. Complaint Submission Workflow

### 1.1 Overview

The main workflow that automates complaint submission on Wildberries reviews page.

**Entry Point:** `OptimizedHandler.handle(request)` or `OptimizedHandler.runTest4Diagnostics(options)`

**Trigger:** User clicks "Start Test" in `diagnostic.html` after selecting a store

### 1.2 Step-by-Step Sequence

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLAINT SUBMISSION WORKFLOW                         │
└─────────────────────────────────────────────────────────────────────────┘

1. LOAD COMPLAINTS FROM BACKEND
   │
   ├── diagnostic.js sends: { type: 'getComplaints', storeId, skip, take }
   ├── Background fetches from: GET /api/extension/stores/{storeId}/complaints
   ├── Filter: status=draft, limit=300
   │
   └── Result: Array of complaint objects with:
       - id, productId, rating, reviewDate
       - complaintText (category + text)
       - reviewKey (unique identifier)

2. SHOW PREVIEW (User Confirmation)
   │
   ├── Group complaints by productId (article)
   ├── Display statistics and complaint details
   ├── User clicks "Confirm" to proceed
   │
   └── Exit: User can cancel here

3. FIND WB TAB & VERIFY CONTENT SCRIPT
   │
   ├── Search for tab: seller.wildberries.ru/feedbacks
   ├── Send ping message to verify content script is loaded
   │
   └── Failure: Error "WB tab not found" or "Content script not ready"

4. GROUP COMPLAINTS BY ARTICLE
   │
   ├── Create Map<productId, complaints[]>
   ├── Filter by selected rating (default: 1, 2 stars)
   ├── Validate: productId and reviewDate must exist
   │
   └── Result: complaintsMap with grouped complaints

5. FOR EACH ARTICLE (productId):
   │
   5.1. SEARCH BY ARTICLE
   │    │
   │    ├── NavigationService.searchByArticle(productId)
   │    ├── Find search input field
   │    ├── Insert productId, press Enter
   │    ├── Wait 7.5 seconds for results
   │    │
   │    └── Failure: Skip article, increment errors
   │
   5.2. CREATE COMPLAINTS MAP
   │    │
   │    ├── SearchService.createComplaintsMap(articleComplaints)
   │    ├── Normalize review keys (remove seconds from timestamp)
   │    │
   │    └── Result: Map<normalizedKey, complaint> + Set<remainingKeys>
   │
   5.3. SCAN PAGES (while remainingKeys.size > 0):
        │
        5.3.1. SCAN CURRENT PAGE
        │      │
        │      ├── Find reviews table
        │      ├── For each row: DataExtractor.extractReviewData(row, productId)
        │      ├── Generate normalized key
        │      ├── Check if key exists in remainingKeys
        │      │
        │      └── Result: Array of { complaint, row } matches
        │
        5.3.2. FOR EACH MATCHED REVIEW:
        │      │
        │      ├── Check statuses (blocking check)
        │      │   └── If has complaint status → skip (already processed)
        │      │
        │      ├── ComplaintService.submitComplaint(row, complaint, index)
        │      │   │
        │      │   ├── Check if already processed (_isAlreadyProcessed)
        │      │   ├── Find menu button (ElementFinder.findMenuButton)
        │      │   ├── Open menu (_openMenu with retries)
        │      │   ├── Find "Пожаловаться" button
        │      │   ├── Click → Wait for modal
        │      │   ├── Select category (radio button)
        │      │   ├── Enter complaint text (textarea)
        │      │   ├── Click "Отправить" button
        │      │   │
        │      │   └── Result: true | false | "NEED_RELOAD" | "CANCELLED"
        │      │
        │      ├── If success:
        │      │   ├── Mark as sent in Backend API
        │      │   ├── Remove from remainingKeys
        │      │   ├── Increment sent counter
        │      │   └── Wait 800ms before next
        │      │
        │      └── If "NEED_RELOAD":
        │          └── Reload page and stop processing
        │
        5.3.3. SYNC STATUSES (Background)
        │      │
        │      ├── Collect all reviews from page (not just matches)
        │      ├── POST /api/extension/review-statuses
        │      │
        │      └── Runs asynchronously, does not block main flow
        │
        5.3.4. NAVIGATE TO NEXT PAGE
               │
               ├── NavigationService.goToNextPage()
               ├── Find "Next" button
               ├── Click, wait 4 seconds
               ├── Verify page changed (compare first row date)
               │
               └── If no next page → break loop

6. FINAL REPORT
   │
   ├── progressService.sendFinalStats()
   ├── Send complaintComplete message with stats
   ├── Display results in diagnostic.html
   │
   └── Stats include: sent, skipped, errors, not found
```

### 1.3 Decision Points

| Point | Condition | Action |
|-------|-----------|--------|
| Rating filter | complaint.rating not in selectedStars | Skip complaint |
| Missing productId | complaint.productId is null | Skip, increment errors |
| Missing reviewDate | complaint.reviewDate is null | Skip, increment errors |
| Search failed | searchByArticle returns false | Skip entire article |
| Already processed | Row contains complaint status | Skip, mark as sent in API |
| Menu not opened | 3 attempts failed | Skip complaint, increment errors |
| Modal not appeared | After 1.8s timeout | Return "NEED_RELOAD" |
| Textarea not found | After 10s timeout | Return "NEED_RELOAD" |
| Submit button not found | After form fill | Increment errors |
| Last page reached | No "Next" button or disabled | Break page loop |
| User stopped | window.stopProcessing = true | Break all loops |

### 1.4 Exit Conditions

- All complaints processed
- User clicked "Stop" button
- User cancelled confirmation dialog
- Page reload required (UI error)
- Maximum pages scanned (10 per article)

### 1.5 Failure Scenarios

| Scenario | Handling |
|----------|----------|
| WB tab not found | Error shown, test aborted |
| Content script not ready | Error "Refresh WB page" |
| Search returns no results | Article skipped |
| Element not found (menu, button) | Complaint skipped |
| Modal stuck | Page reload triggered |
| Network error during API call | Logged, processing continues |

---

## 2. Status Synchronization Workflow

### 2.1 Overview

Syncs review statuses from WB page to Backend for GPT token optimization (~80% savings).

**Entry Point:** `StatusSyncService.syncStatuses(storeId, reviews)`

**Trigger:** Called automatically during complaint processing (after each page scan)

### 2.2 Step-by-Step Sequence

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATUS SYNC WORKFLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

1. COLLECT REVIEWS FROM PAGE
   │
   ├── For each row in table:
   │   └── DataExtractor.extractReviewData(row, productId)
   │       ├── productId
   │       ├── rating
   │       ├── reviewDate (ISO 8601)
   │       ├── key (productId_rating_timestamp)
   │       └── statuses[] (array of status strings)
   │
   └── Result: Array of review objects

2. FORMAT FOR API
   │
   ├── Normalize review key (remove seconds)
   │   "649502497_1_2026-01-07T20:09:37.000Z"
   │   → "649502497_1_2026-01-07T20:09"
   │
   ├── Calculate canSubmitComplaint flag
   │   └── true if no blocking statuses present
   │
   └── Result: Array of formatted review objects

3. SPLIT INTO BATCHES
   │
   ├── Batch size: 100 reviews (API limit)
   │
   └── Result: Array of batches

4. SEND BATCHES TO BACKEND
   │
   ├── For each batch:
   │   │
   │   ├── POST /api/extension/review-statuses
   │   │   {
   │   │     storeId: "123",
   │   │     parsedAt: "2026-01-28T12:00:00.000Z",
   │   │     reviews: [...]
   │   │   }
   │   │
   │   ├── Wait for response
   │   ├── Accumulate stats (created, updated, errors)
   │   │
   │   └── Wait 500ms between batches (rate limit protection)
   │
   └── Result: Total stats

5. RETURN RESULT
   │
   └── { success, data: { received, created, updated, errors } }
```

### 2.3 Blocking Statuses

These statuses prevent new complaint submission:

| Status | Meaning |
|--------|---------|
| Жалоба отклонена | Complaint rejected |
| Жалоба одобрена | Complaint approved |
| Проверяем жалобу | Complaint under review |
| Жалоба пересмотрена | Complaint reconsidered |

### 2.4 Sync Trigger Points

1. **During Test 3:** After scanning each article
2. **During Test 4:** After scanning each page (background, non-blocking)
3. **Manual:** Can be called from console via `OptimizedHandler.syncReviewStatuses()`

---

## 3. Diagnostic/Manual Run Workflow

### 3.1 Overview

User interface for testing and running batch complaint operations.

**Entry Point:** `diagnostic.html`

**UI Flow:** Select store → Load complaints → Preview → Confirm → **Multi-round Execute**

### 3.2 Multi-Round Processing (v2.2.0)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-ROUND WORKFLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

Constants:
- MAX_ROUNDS = 10
- COMPLAINTS_PER_ROUND = 300
- Max total = 3000 complaints per session

Flow:
┌─────────────────────────────────────────────────────────────────────────┐
│  ROUND 1                                                                 │
│  ├── GET complaints (filter=draft, limit=300)                           │
│  ├── Process on WB page                                                 │
│  ├── Mark submitted as pending                                          │
│  └── Accumulate stats                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ROUND 2                                                                 │
│  ├── GET complaints (filter=draft) → processed ones won't appear        │
│  ├── Process remaining                                                  │
│  └── Accumulate stats                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ... (up to 10 rounds)                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  EXIT CONDITIONS:                                                        │
│  ├── API returns 0 complaints → SUCCESS                                 │
│  ├── Round 10 reached → WARNING                                         │
│  ├── User cancelled → CANCELLED                                         │
│  └── Error occurred → ERROR                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Step-by-Step Sequence

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DIAGNOSTIC WORKFLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

1. PAGE LOAD
   │
   ├── Load stores from Backend
   │   GET /api/extension/stores
   │
   └── Populate store dropdown (only active stores)

2. STORE SELECTION
   │
   ├── User selects store from dropdown
   ├── Save storeId to chrome.storage.local
   │
   └── Enable "Get Complaints" button

3. LOAD COMPLAINTS (First batch)
   │
   ├── Load complaints from Backend
   │   GET /api/extension/stores/{storeId}/complaints?filter=draft&limit=300
   │
   ├── Group by article
   │
   └── Show preview accordion with stats

4. PREVIEW
   │
   ├── User reviews complaints in accordion
   ├── Can expand each article to see details
   │
   └── Button: "Submit" enabled

5. CONFIRM
   │
   ├── Show confirmation dialog:
   │   - Store name
   │   - First batch count (e.g., 300)
   │   - Max rounds (10)
   │   - Warning about real submission
   │
   └── If cancelled → Reset UI

6. MULTI-ROUND EXECUTE
   │
   ├── Find WB tab (seller.wildberries.ru/feedbacks)
   ├── Verify content script ready (ping)
   │
   └── WHILE (round <= 10):
       │
       ├── GET /api/extension/stores/{storeId}/complaints?filter=draft&limit=300
       │
       ├── IF 0 complaints → EXIT with SUCCESS
       │
       ├── Send test4Diagnostics to WB tab
       │
       ├── Accumulate round stats to totalStats
       │
       ├── IF cancelled → EXIT with CANCELLED
       │
       ├── round++
       │
       └── Wait 2 seconds before next round

7. DISPLAY RESULTS
   │
   ├── Show rounds completed (e.g., "3 из 10")
   ├── Show cumulative statistics:
   │   - Total complaints received
   │   - Total reviews synced
   │   - Total submitted
   │   - Total errors
   │
   └── Show overall status (SUCCESS/WARNING/CANCELLED/ERROR)
```

### 3.3 Test Modes

| Mode | Description | Submits? |
|------|-------------|----------|
| Test 1 | DOM diagnostics (verify selectors) | No |
| Test 2 | Extended diagnostics (with pagination) | No |
| Test 3 | API integration (fetch + find + match) | No |
| Test 4 | Full test with real submission | **Yes** |

### 3.4 Test Mode Flag

Located in `complaint-service.js`:

```javascript
const TEST_MODE = false; // Set to true for dry-run
```

When `TEST_MODE = true`:
- Forms are filled but NOT submitted
- Success is simulated for workflow testing
- Useful for UI validation without side effects

---

## 4. Error Handling and Retry Behavior

### 4.1 Menu Open Retry

```javascript
// Location: ComplaintService._openMenu()
// Retries: 3 attempts

while (!complaintBtn && attempts < 3) {
  attempts++;
  await sleep(500);
  menuButton.focus();
  menuButton.click();
  await sleep(600);
  complaintBtn = findComplaintButton();
}
```

### 4.2 Dropdown Open Retry

```javascript
// Location: OptimizedHandler.runDiagnostics()
// Retries: 3 attempts with 300ms delay

for (let attempt = 0; attempt < 3; attempt++) {
  dropdown = ElementFinder.findOpenDropdown();
  if (dropdown) break;
  await sleep(300);
}
```

### 4.3 Page Navigation Verification

```javascript
// Location: NavigationService.goToNextPage()
// Strategy: Compare first row date before/after click

const firstRowDateBefore = getReviewDate(firstRow);
// ... click next button ...
await sleep(4000);
const firstRowDateAfter = getReviewDate(firstRow);

const pageChanged = (firstRowDateBefore !== firstRowDateAfter);
```

### 4.4 Textarea Input Methods

```javascript
// Location: ComplaintService._enterComplaintText()
// Strategy: Try multiple methods in order

1. execCommand('insertText')  // Best for React
2. DataTransfer + paste event // Fallback
3. InputEvent + setter        // Last resort
```

### 4.5 Page Reload Trigger

Conditions that trigger `"NEED_RELOAD"`:
- Modal does not appear after 1.8s
- Textarea not found after 10s

Handling:
```javascript
if (result === "NEED_RELOAD") {
  sessionStorage.setItem('wb_reload_reason', 'UI_ERROR');
  location.reload();
  return;
}
```

### 4.6 Rate Limiting

| Operation | Delay |
|-----------|-------|
| Between complaints | 800ms |
| Between articles | 1500ms |
| Between status sync batches | 500ms |
| Search result wait | 7500ms |
| Page navigation wait | 4000ms |

### 4.7 Safety Limits

| Limit | Value | Configurable | Location |
|-------|-------|--------------|----------|
| Max rounds per session | 10 | Yes | diagnostic.js:18 |
| Complaints per round | 300 | Yes | diagnostic.js:19 |
| Max complaints per session | 3000 | Calculated | 10 × 300 |
| Max pages per article | 10 | Yes | optimized-handler.js |
| Status sync batch size | 100 | Yes | status-sync-service.js |
| Sync timeout | 30s | Yes | optimized-handler.js |
| Pause between rounds | 2s | Yes | diagnostic.js |

---

## 5. Review Key Matching

### 5.1 Key Format

```
{productId}_{rating}_{ISO8601timestamp}

Example:
649502497_1_2026-01-07T20:09:37.000Z
```

### 5.2 Normalization

API and page may have different timestamp precision. Keys are normalized:

```javascript
// Remove seconds and milliseconds
"649502497_1_2026-01-07T20:09:37.000Z"
→ "649502497_1_2026-01-07T20:09"
```

### 5.3 Matching Strategy

1. API provides complaint with `reviewKey`
2. Extension parses reviews from page
3. For each page review, generate key using `DataExtractor.getReviewKey()`
4. Normalize both keys
5. Match by exact string comparison

---

## 6. Workflow Limits and Recommendations

### 6.1 Recommended Batch Size

- **Ideal:** 50-100 complaints per run
- **Maximum:** 300 complaints per run
- **Reason:** UI stability, rate limiting, error recovery

### 6.2 Network Considerations

- Slow internet: Increase wait times
- WB API latency: 4-7.5 seconds for page load
- Status sync: Runs in background, non-blocking

### 6.3 UI Stability

WB UI can change. When issues occur:
1. Check `docs/DOM_CONTRACT.md` for expected elements
2. Update selectors in `element-finder.js`
3. Log which specific element failed to find
