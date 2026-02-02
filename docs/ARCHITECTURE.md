# ARCHITECTURE.md

## Rating5 Complaints Extension — System Architecture

This document describes the internal architecture of the Rating5 Chrome Extension for automated complaint submission on Wildberries (Valdris UI).

---

## 1. Extension Type

**Manifest Version:** 3 (MV3)

**Key Characteristics:**
- Service Worker (not persistent background page)
- Content Scripts with isolated and main world execution
- Declarative permissions model
- Web-accessible resources for main world bundle

---

## 2. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CHROME BROWSER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              BACKGROUND (Service Worker)                      │ │
│  │              src/background/index.js                          │ │
│  │                                                               │ │
│  │   ┌─────────────────────────────────────────────────────┐    │ │
│  │   │              Message Router                          │    │ │
│  │   │   ├── ComplaintsHandler    (get/mark complaints)    │    │ │
│  │   │   ├── StatusSyncHandler    (sync review statuses)   │    │ │
│  │   │   ├── SettingsHandler      (manage configuration)   │    │ │
│  │   │   ├── ReportsHandler       (API session stats)      │    │ │
│  │   │   └── ReviewsHandler       (send reviews to API)    │    │ │
│  │   └─────────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                    ↑                    ↓                          │
│           chrome.runtime.sendMessage / onMessage                   │
│                    ↑                    ↓                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │        CONTENT SCRIPT — ISOLATED WORLD                        │ │
│  │        src/contents/complaints/content.js                     │ │
│  │                                                               │ │
│  │   • Has access to Chrome Extension APIs                       │ │
│  │   • Bridges messages between Background and Main World        │ │
│  │   • Injects main-world bundle into page                       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                    ↑                    ↓                          │
│              CustomEvent (wb-call-main-world / wb-main-world-response)
│                    ↑                    ↓                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │        CONTENT SCRIPT — MAIN WORLD                            │ │
│  │        dist/content-main-world.bundle.js                      │ │
│  │                                                               │ │
│  │   • Executes in page's JavaScript context                     │ │
│  │   • Direct DOM access to WB interface                         │ │
│  │   • Contains: OptimizedHandler, Services, DOM utilities       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              ↓                                     │
│                    WB Page DOM (seller.wildberries.ru)             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              DIAGNOSTIC UI                                    │ │
│  │              diagnostic.html + src/diagnostic.js              │ │
│  │                                                               │ │
│  │   • User interface for testing and batch operations           │ │
│  │   • Communicates with Background and Content Scripts          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Backend API: http://158.160.217.236/api/...                      │
│   ├── GET  /api/extension/stores/{storeId}/complaints              │
│   ├── POST /api/extension/stores/{storeId}/complaints/{id}/sent    │
│   └── POST /api/extension/review-statuses                          │
│                                                                     │
│   WB Seller Portal: seller.wildberries.ru                          │
│   └── Reviews page with complaint functionality                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Descriptions

### 3.1 Service Worker (Background)

**Location:** `src/background/`

**Entry Point:** `src/background/index.js`

**Purpose:** Central event hub for the extension. Manages all cross-component communication and API state.

**Key Files:**
| File | Responsibility |
|------|----------------|
| `index.js` | Service worker entry, initialization |
| `message-router.js` | Routes incoming messages to handlers |
| `handlers/complaints-handler.js` | Load complaints, mark as sent |
| `handlers/status-sync-handler.js` | Sync review statuses to backend |
| `handlers/settings-handler.js` | Configuration management |
| `handlers/reports-handler.js` | API session statistics |
| `handlers/reviews-handler.js` | Send reviews to external API |

**Message Types Handled:**
- `getComplaints` — Load complaints from backend API
- `sendComplaint` — Mark complaint as sent
- `syncReviewStatuses` — Send statuses to backend
- `getSettings` / `SETTINGS_UPDATED` — Settings operations
- `getAPIReport` / `resetAPISession` — Session management

### 3.2 Content Script — Isolated World

**Location:** `src/contents/complaints/content.js`

**Injection:** Defined in `manifest.json`, runs at `document_idle`

**Purpose:** Bridge between Chrome Extension APIs and page context. Cannot directly access page JavaScript variables but has full Chrome API access.

**Responsibilities:**
1. Inject main-world bundle (`dist/content-main-world.bundle.js`)
2. Listen for `chrome.runtime.onMessage` from background/popup
3. Relay messages to Main World via `CustomEvent`
4. Forward Main World responses back to background

**Bridge Events:**
| Event | Direction | Purpose |
|-------|-----------|---------|
| `wb-call-main-world` | Isolated → Main | Execute action in page context |
| `wb-main-world-response` | Main → Isolated | Return execution result |
| `wb-send-message` | Main → Isolated → Background | Forward to service worker |
| `wb-sync-request` | Main → Isolated | Status sync requests |

### 3.3 Content Script — Main World

**Location:** `src/contents/complaints/main-world-entry.js`

**Build Output:** `dist/content-main-world.bundle.js`

**Purpose:** Execute in the page's JavaScript context with full DOM access. This is where all WB interface interaction happens.

**Exposed Globals:**
```javascript
window.WBUtils           // Utility functions
window.DataExtractor     // Extract review data from DOM
window.ElementFinder     // Locate UI elements
window.SearchService     // Find reviews on page
window.NavigationService // Navigate between products/pages
window.ProgressService   // Track and report progress
window.ComplaintService  // Submit complaints
window.OptimizedHandler  // Main orchestration handler
```

**Key Modules:**

| Module | File | Purpose |
|--------|------|---------|
| **OptimizedHandler** | `handlers/optimized-handler.js` | Main orchestration, coordinates all operations |
| **ComplaintService** | `services/complaint-service.js` | Submit individual complaints |
| **SearchService** | `services/search-service.js` | Find reviews by unique key |
| **NavigationService** | `services/navigation-service.js` | Navigate between products |
| **ProgressService** | `services/progress-service.js` | Track and report progress |
| **DataExtractor** | `dom/data-extractor.js` | Extract review data (date, rating, key) |
| **ElementFinder** | `dom/element-finder.js` | Find UI elements (buttons, modals) |

### 3.4 DOM Interaction Layer

**Location:** `src/contents/complaints/dom/`

This layer isolates all direct DOM manipulation and selector logic.

**DataExtractor** (`data-extractor.js`):
- `getReviewDate(row)` — Parse WB datetime format to ISO 8601
- `getReviewKey(row, productId)` — Generate unique review identifier
- Extract rating values from review rows

**ElementFinder** (`element-finder.js`):
- `findMenuButton(row)` — Find three-dot menu button
- `findDropdown()` — Find open dropdown menu
- `findComplaintButton()` — Find "Пожаловаться" button
- `findComplaintModal()` — Find complaint form modal
- `findSubmitButton()` — Find submit button in modal
- `closeOpenDropdown()` — Close any open dropdown

### 3.5 Backend Sync Layer

**Location:** `src/services/` and `src/api/`

**PilotAPI** (`src/api/pilot-api.js`):
- Main backend API client
- Methods: `getComplaints()`, `markComplaintAsSent()`, `getStores()`
- Handles authentication token

**StatusSyncService** (`src/services/status-sync-service.js`):
- Synchronize review statuses with backend
- Batch processing (100 reviews per request)
- Track blocking statuses (rejected, approved, in review)

**ComplaintsAPIService** (`src/services/complaints-api-service.js`):
- Load and process complaints from backend
- Parse complaint text (extract category, text)
- Add unique keys for review matching

### 3.6 Diagnostic UI

**Location:** `diagnostic.html` + `src/diagnostic.js`

**Purpose:** User interface for testing and running batch complaint operations.

**Features:**
- Store selection
- Complaint filtering (rating, category)
- Test modes:
  - **Test 1:** DOM diagnostics (verify selectors)
  - **Test 2:** Extended diagnostics (with pagination)
  - **Test 3:** API integration test (fetch + match)
  - **Test 4:** Real submission test
- Progress tracking and logging
- Stop/cancel mechanism

---

## 4. Message Flow

### 4.1 Complaint Processing Flow

```
diagnostic.js
    │
    ├─── chrome.tabs.sendMessage({ type: "test4Diagnostics", complaints: [...] })
    │
    ▼
content.js (Isolated World)
    │
    ├─── Receives chrome.runtime.onMessage
    ├─── Dispatches CustomEvent('wb-call-main-world', { action, data })
    │
    ▼
main-world-entry.js (Main World)
    │
    ├─── Listens for 'wb-call-main-world'
    ├─── Calls OptimizedHandler.runTest4Diagnostics(complaints)
    │
    ▼
OptimizedHandler
    │
    ├─── Groups complaints by productId
    ├─── For each product:
    │       ├─── SearchService.scanPageForReviews()
    │       ├─── DataExtractor.getReviewKey()
    │       ├─── Match complaints to reviews
    │       ├─── ComplaintService.submitComplaint()
    │       │       ├─── ElementFinder.findMenuButton()
    │       │       ├─── ElementFinder.findComplaintButton()
    │       │       ├─── Fill modal form
    │       │       └─── Submit
    │       └─── NavigationService (next page if needed)
    │
    ├─── ProgressService.report() → CustomEvent → content.js → Background
    │
    └─── Return results via CustomEvent('wb-main-world-response')
```

### 4.2 Status Sync Flow

```
OptimizedHandler (after complaint batch)
    │
    ├─── Extract statuses from page
    │
    ▼
CustomEvent('wb-sync-request')
    │
    ▼
content.js (Isolated World)
    │
    ├─── chrome.runtime.sendMessage({ type: "syncReviewStatuses", ... })
    │
    ▼
Background Service Worker
    │
    ├─── StatusSyncHandler receives message
    ├─── StatusSyncService.syncStatuses(reviews)
    │       ├─── Format data
    │       ├─── POST /api/extension/review-statuses
    │       └─── Return { created, updated, errors }
    │
    └─── Response sent back through chain
```

---

## 5. Repository Structure

```
R5 подача жалоб/
├── manifest.json                    # Extension manifest (MV3)
├── webpack.config.js                # Build configuration
├── package.json                     # Dependencies
├── diagnostic.html                  # Diagnostic UI entry
├── popup.html                       # Browser action popup
│
├── dist/                            # Build output
│   └── content-main-world.bundle.js
│
├── src/
│   ├── diagnostic.js                # Diagnostic page logic
│   ├── popup.js                     # Popup logic
│   │
│   ├── background/                  # SERVICE WORKER
│   │   ├── index.js                 # Entry point
│   │   ├── message-router.js        # Message routing
│   │   └── handlers/                # Message handlers
│   │
│   ├── contents/complaints/         # CONTENT SCRIPTS
│   │   ├── content.js               # Isolated world entry
│   │   ├── main-world-entry.js      # Main world entry
│   │   ├── utils.js                 # Utilities
│   │   │
│   │   ├── dom/                     # DOM LAYER
│   │   │   ├── data-extractor.js
│   │   │   └── element-finder.js
│   │   │
│   │   ├── services/                # BUSINESS LOGIC
│   │   │   ├── complaint-service.js
│   │   │   ├── search-service.js
│   │   │   ├── navigation-service.js
│   │   │   └── progress-service.js
│   │   │
│   │   └── handlers/
│   │       └── optimized-handler.js
│   │
│   ├── services/                    # SHARED SERVICES
│   │   ├── complaints-api-service.js
│   │   ├── status-sync-service.js
│   │   ├── settings-service.js
│   │   └── store-manager.js
│   │
│   ├── api/                         # API CLIENTS
│   │   ├── pilot-api.js
│   │   └── external-api.js
│   │
│   ├── config/                      # CONFIGURATION
│   │   └── complaints-config.js
│   │
│   └── utils/                       # UTILITIES
│       ├── api-helpers.js
│       ├── complaints-parser.js
│       └── fetch-retry.js
│
├── docs/                            # DOCUMENTATION
│
└── styles/                          # CSS
```

---

## 6. Where to Change What

| Change Type | Location |
|-------------|----------|
| UI/DOM selectors | `src/contents/complaints/dom/element-finder.js` |
| Data extraction from page | `src/contents/complaints/dom/data-extractor.js` |
| Complaint submission logic | `src/contents/complaints/services/complaint-service.js` |
| Review search logic | `src/contents/complaints/services/search-service.js` |
| Page navigation | `src/contents/complaints/services/navigation-service.js` |
| Main orchestration | `src/contents/complaints/handlers/optimized-handler.js` |
| API endpoints/payloads | `src/api/pilot-api.js`, `src/config/complaints-config.js` |
| Status sync | `src/services/status-sync-service.js` |
| Background message routing | `src/background/message-router.js` |
| Settings management | `src/services/settings-service.js` |
| Diagnostic UI | `diagnostic.html`, `src/diagnostic.js` |

---

## 7. Build Process

```bash
npm run build
```

**Webpack Configuration:**
- **Entry:** `src/contents/complaints/main-world-entry.js`
- **Output:** `dist/content-main-world.bundle.js`
- **Optimization:** Terser (minify, preserve console, no name mangling)

The build bundles all Main World modules into a single file that is injected into the page context.

---

## 8. Key Architectural Decisions

1. **Dual-World Content Scripts:** Separates Chrome API access (Isolated) from DOM manipulation (Main) for security and functionality.

2. **Centralized Message Router:** All cross-component communication goes through the background service worker for traceability.

3. **DOM Layer Isolation:** All selectors and DOM operations are in dedicated files, making UI changes localized.

4. **Idempotent Operations:** Review keys (`productId_rating_timestamp`) ensure safe retries without duplicates.

5. **Batch Processing:** Complaints are grouped by product and processed in batches for efficiency.

6. **Progress Reporting:** Real-time progress updates via CustomEvents for user feedback.

---

## 9. Quick Reference

**Where do I change UI logic?**
→ `src/contents/complaints/dom/`

**Where do I change API sync?**
→ `src/services/` or `src/api/`

**Where does orchestration happen?**
→ `src/contents/complaints/handlers/optimized-handler.js`

**Where is the message routing?**
→ `src/background/message-router.js`

**Where are settings managed?**
→ `src/services/settings-service.js`
