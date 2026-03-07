# UI_CHANGELOG.md

## Rating5 Complaints Extension — UI Change Log

This document tracks Wildberries (Valdris) UI changes and the corresponding extension updates.

---

## Format

Each entry should include:
- **Date** - When the change was discovered
- **UI Change** - What changed in WB interface
- **Impact** - What broke in the extension
- **Fix** - What was updated (selectors/logic)
- **Commit** - Reference to the fix commit

---

## 2026

### March 2026

#### 2026-03-07: chatId URL Validation + ratingExcluded Scoping

**Change Type:** Bug Fix (chat linking reliability + ratingExcluded enforcement)

**What Changed:**

1. **chatId URL validation (`chat-handler.js`):**
   - `processChatTab()` now waits up to 15s for `chatId=` to appear in the tab URL
   - Previously: took URL after 6s render wait, even if WB hadn't finished client-side redirect
   - Root cause of 56 duplicate `review_chat_links`: URL without chatId → backend `reconcileChatWithLink()` matched wrong records
   - Fallback: if chatId never appears, proceeds with warning log

2. **ratingExcluded — scoped blocking:**
   - `type="open"` → blocked by `ratingExcluded` (не открываем новый чат для исключённого отзыва)
   - `type="link"` → **НЕ** блокируется (чат уже открыт → привязываем, чтобы бэкенд мог заблокировать общение)
   - Phase 2.5 ретро-привязка → **НЕ** блокируется (аналогично link — чат уже открыт)
   - Принцип: если чат УЖЕ открыт, всегда привязываем вне зависимости от блокаторов

**Files Changed:**
- `src/background/handlers/chat-handler.js` — chatId URL validation loop in `processChatTab()`
- `src/contents/complaints/handlers/optimized-handler.js` — `ratingExcluded` scoped to `type="open"` only

---

#### 2026-03-04: Retroactive Chat Linking + Enhanced Chat Button Loading

**Change Type:** Feature (chat linking + reliability)

**What Changed:**

1. **Retroactive chat linking (Phase 2.5):**
   - When the extension detects `chat_opened` status on a review row that has NO matching chat task from backend → automatically clicks the button, opens the existing chat tab, captures the URL, and calls `POST /api/extension/chat/opened` to create the `review_chat_links` record
   - Uses the existing pipeline (sequential clicks + parallel background processing)
   - Does NOT check `ratingExcluded` — always links already-opened chats (backend needs the link to block communication)
   - API is idempotent (UNIQUE on store_id + review_key) — safe for repeated calls
   - New report counters: `retroactiveLinksDetected`, `retroactiveLinksOpened`

2. **Enhanced chat button loading retry:**
   - `_waitForTableReady()` now accepts `chatButtonRetryAttempts` parameter
   - Each attempt polls for 5s with 500ms intervals
   - When backend has chat tasks (`hasChatTasks`): 5 attempts (up to 25s total)
   - Otherwise: 1 attempt (5s) for accurate chatStatus in status sync
   - Chat buttons always waited for now (`requireChatButtons: true` always) — improves chatStatus accuracy

3. **Always wait for chat buttons:**
   - Previously: chat buttons only waited for when backend had chat tasks
   - Now: always waited for (1 attempt = 5s for status-only, 5 attempts = 25s for chat tasks)
   - Improves accuracy of `chatStatus` field in status sync payload

**Files Changed:**
- `src/contents/complaints/handlers/optimized-handler.js` — Phase 2.5 logic, `_waitForTableReady` retry, report counters, pipeline differentiation

**Docs Updated:**
- `docs/WORKFLOWS.md` — Phase 2.5 in per-row processing, report shape
- `docs/TROUBLESHOOTING.md` — chat button loading section
- `docs/UI_CHANGELOG.md` — this entry

---

#### 2026-03-03: Chat Link Tasks Bypass Blocking Statuses + reviewResolved API

**Change Type:** Feature (chat linking logic)

**What Changed:**

1. **Chat link tasks (`type: "link"`) no longer blocked by review statuses:**
   - Previously: both `"open"` and `"link"` chat tasks were skipped if the review had blocking statuses (`Жалоба одобрена`, `Снят с публикации`, `Исключён из рейтинга`, `Дополнен`) or `ratingExcluded` flag
   - Now: `"link"` tasks bypass these checks — the extension always opens the chat to link it
   - Backend auto-closes resolved chats, so the extension's job is just to link once

2. **Backend returns `reviewResolved` / `resolvedReason` in `POST /chat/opened` response:**
   - Extension logs a warning when `reviewResolved=true`
   - No blocking behavior — backend handles closure autonomously

**Files Changed:**
- `src/contents/complaints/handlers/optimized-handler.js` — pre-checks skip for `isLinkTask`
- `src/background/handlers/chat-handler.js` — log `reviewResolved` / `resolvedReason`
- `docs/BACKEND_API.md` — new response fields for `/chat/opened`

---

#### 2026-03-02: Dual Date Format Support + Timezone-Agnostic Parsing

**Change Type:** Bug Fix (critical)

**What Changed:**

1. **WB changed date display format:**
   - Old format (text): `"19 февр. 2026 г. в 20:11"`
   - New format (numeric): `"31.01.2026 в 16:55"`
   - Both formats may coexist on the same page

2. **Timezone handling was hardcoded to Moscow (UTC+3):**
   - `parseWBDatetime()` in `data-extractor.js` used `hours - 3` to convert MSK → UTC
   - This only worked for users in Moscow timezone
   - Users in other timezones (e.g. UTC+7 Thailand) got mismatched review keys → reviews silently not found

3. **Two inconsistent `parseWBDatetime()` copies:**
   - `data-extractor.js` subtracted 3 hours (MSK → UTC)
   - `api-helpers.js` did not subtract (assumed UTC input)
   - Same function name, different behavior

**Impact:**
- Reviews with old text dates → `getReviewDate()` returned `null` → complaints silently skipped
- Users outside Moscow → review keys didn't match backend keys → all reviews not found
- `getReviewText()` could capture old-format date strings as review text

**Fix:**

1. **Dual format support in `parseWBDatetime()`:**
   - Primary: numeric `DD.MM.YYYY в HH:MM`
   - Fallback: text `D месяц YYYY г. в HH:MM` (with Russian month abbreviations)
   - Added `RUSSIAN_MONTHS_SHORT` mapping for abbreviated months

2. **Timezone-agnostic parsing:**
   - Replaced `Date.UTC(year, month, day, hours - 3, ...)` with `new Date(year, month, day, hours, minutes)`
   - `new Date()` creates date in local browser timezone
   - `.toISOString()` automatically converts to UTC
   - Works correctly for any user timezone

3. **Synchronized both `parseWBDatetime()` copies** — identical behavior now

4. **Updated date patterns in `getReviewDate()` and `getReviewText()`** to match both formats

**Files Updated:**
- `src/contents/complaints/dom/data-extractor.js` — `parseWBDatetime()`, `getReviewDate()`, `getReviewText()`
- `src/utils/api-helpers.js` — `parseWBDatetime()`
- `src/contents/complaints/dom/selectors.catalog.js` — `DATETIME_SELECTORS` (added `patternText`)
- `docs/DOM_CONTRACT.md` — DateTime section rewritten
- `docs/SELECTORS.md` — DateTime section updated
- `docs/UI_CHANGELOG.md` — this entry

---

### February 2026

#### 2026-02-22: Pipeline Chat Opening + Chat Button Wait Fix

**Change Type:** Performance + Bug Fix

**What Changed:**

1. **Pipeline chat opening:**
   - Chats now open in pipeline mode: clicks are sequential (3s apart), but background tab processing runs in parallel
   - Previously: each chat waited for full background processing + 10s cooldown before next click
   - Now: all clicks happen first, then all background processing runs simultaneously via `Promise.allSettled`
   - ~2x speedup for 5 chats (85s vs 175s), ~2.4x for 10 chats

2. **Direct tabId passing:**
   - `wb-create-tab` bridge now returns `tabId` back to MAIN world via `wb-create-tab-response` event
   - `processChatTab` accepts direct `tabId` — eliminates `_findChatTab()` polling race condition
   - Critical for parallel processing: multiple concurrent `processChatTab` calls no longer compete for the same tab

3. **Chat button SVG wait fix:**
   - `_waitForTableReady()` now accepts `{ requireChatButtons: true }` option
   - When set, waits for SVG chat button icons to render (2-3s delay after table rows appear)
   - Prevents incorrect `chatStatus` detection due to premature parsing

**Files Modified:**
- `src/contents/complaints/services/chat-service.js` — `clickAndCapture()`, `processCaptured()` methods
- `src/contents/complaints/content.js` — `wb-create-tab-response` relay
- `src/background/handlers/chat-handler.js` — accept direct `tabId`
- `src/contents/complaints/handlers/optimized-handler.js` — pipeline loop, `_waitForTableReady` enhancement
- `src/contents/complaints/dom/selectors.catalog.js` — `CHAT_PARALLEL` config

**Selectors Added:**
- `CHAT_PARALLEL.clickIntervalMs` = 3000 (delay between clicks)
- `CHAT_PARALLEL.urlCaptureTimeoutMs` = 25000 (max wait for window.open)

---

#### 2026-02-21: Transparent Stars + Centralized Blocking Statuses

**Change Type:** Feature + Refactor

**What Changed:**

1. **Transparent Stars (new WB feature):**
   - WB now marks some reviews as "excluded from rating" — stars rendered with `Rating--disabled` CSS class
   - Warning icon (!) appears next to rating in `Valuation-rating--right-icon` container
   - These reviews are no longer counted in product rating by WB

2. **New blocker: `ratingExcluded`:**
   - Reviews with transparent stars are now skipped for both complaints and chats
   - `DataExtractor.isRatingExcluded(row)` detects this via:
     - Primary: `[class*="Rating--disabled"]` on star divs
     - Fallback: `[class*="Valuation-rating--right-icon"]` container presence
   - `extractReviewData()` now returns `ratingExcluded: boolean` field
   - Status sync sends `ratingExcluded` to backend

3. **Centralized blocking statuses:**
   - `REVIEW_BLOCKING` object added to `selectors.catalog.js` — single source of truth
   - `complaintStatuses`: statuses blocking complaint submission
   - `chatStatuses`: statuses blocking chat opening
   - Removed hardcoded duplicate arrays from `optimized-handler.js` (4 places)
   - Fixed `complaint-service.js`: was checking `'Жалоба на рассмотрении'` (incorrect) instead of `'Проверяем жалобу'`

**Files Updated:**
- `src/contents/complaints/dom/selectors.catalog.js` — `REVIEW_BLOCKING`, `RATING_SELECTORS` updated
- `src/contents/complaints/dom/data-extractor.js` — `isRatingExcluded()`, `extractReviewData()`
- `src/contents/complaints/handlers/optimized-handler.js` — deduplicated statuses, added ratingExcluded checks
- `src/contents/complaints/services/complaint-service.js` — `_isAlreadyProcessed()` fixed
- `src/services/status-sync-service.js` — sync comment added
- `docs/DOM_CONTRACT.md` — transparent stars documented
- `docs/UI_CHANGELOG.md` — this entry

---

#### 2026-02-19: Unified Tasks API Migration (v4.0)

**Change Type:** Feature — Unified tasks workflow replacing separate complaints + chat rules endpoints

**What Was Added:**

1. **`pilotAPI.getTasks(storeId)`** — calls `GET /api/extension/stores/{storeId}/tasks`
2. **`OptimizedHandler.runTaskWorkflow(options)`** — unified handler processing 3 task types per article:
   - `statusParses`: passive status collection for sync
   - `chatOpens`: chat opening/linking (type: "open" | "link")
   - `complaints`: complaint submission via WB modal
3. **`'runTaskWorkflow'` content bridge** — MAIN ↔ ISOLATED world message passing
4. **`'getTasks'` message route** — background handler routing
5. **`diagnostic.js` v4.0** — migrated UI from `getComplaints` → `getTasks`, multi-round loop with `runTaskWorkflow`

**Architecture:** Backend acts as "brain" — decides which tasks to execute. Extension acts as "executor" — processes matched tasks per review row within page loop. Multi-round: repeat until backend returns 0 tasks.

**Files Modified:** `pilot-api.js`, `complaints-handler.js`, `message-router.js`, `content.js`, `main-world-entry.js`, `optimized-handler.js`, `diagnostic.js`, `diagnostic.html`

**Docs Updated:** `BACKEND_API.md` (section 2.10), `WORKFLOWS.md` (section 3b), `UI_CHANGELOG.md`

**Backward Compatibility:** Old `getComplaints` + `test4Diagnostics` flow preserved, not removed.

---

#### 2026-02-19: Chat Status Parsing Added to Status Sync (Sprint 2)

**Change Type:** Feature — New field `chatStatus` in review status sync

**What Was Added:**

1. **`ElementFinder.findChatButton(row)`** — finds chat button in review row by SVG viewBox `0 0 16 16`
2. **`DataExtractor.getChatStatus(row)`** — determines chat button state using computed color luminance:
   - `chat_not_activated` — button disabled (transparent)
   - `chat_available` — grey active button (luminance >= 0.4)
   - `chat_opened` — black active button (luminance < 0.4)
3. **`chatStatus` field** added to `POST /api/extension/review-statuses` payload
4. **`CHAT_STATUS_DETECTION`** config added to selectors catalog (luminance threshold)

**Files Modified:** `element-finder.js`, `data-extractor.js`, `optimized-handler.js`, `status-sync-service.js`, `selectors.catalog.js`

**Docs Created:** `docs/Sprint 2. Chats/TZ_CHAT_STATUS_API.md` — backend team technical spec

**Backend Integration (same day):** Backend deployed migration `017_add_chat_status_opened.sql`. Extension values mapped to DB ENUM: `chat_not_activated` → `unavailable`, `chat_available` → `available`, `chat_opened` → `opened`. New response field `chatStatusSynced`. UI filter "Статус чата" added to Reviews tab.

---

#### 2026-02-17: Chat Button & Chat Page DOM Recon (Sprint 2)

**Change Type:** Discovery / Documentation (no code fix needed)

**What Was Documented:**

1. **Chat Button in review row** — 3 states identified:
   - Grey (not opened): `button:not([disabled])` — clickable, opens new chat
   - Black (already opened): `button:not([disabled])` — clickable, opens existing chat
   - Transparent (disabled): `button[disabled]` — cabinet feature not enabled
   - All use same SVG icon (viewBox `0 0 16 16`)
   - Located in `Buttons-cell` container alongside menu button (three dots)

2. **Chat page URL format confirmed:**
   - `https://seller.wildberries.ru/chat-with-clients?chatId={UUID}`
   - chatId is UUID: `a8775c6f-049b-da67-1045-421477a8bfcb`

3. **System anchor message:**
   - Text: `"Чат с покупателем по товару {nmId}"`
   - Stable selectors: `[data-testid="message"]`, `span[data-name="Text"]`
   - nmId extractable via regex `/товару\s+(\d+)/i`

4. **Message input field:**
   - `textarea#messageInput[name="messageInput"]` inside `[data-name="TextAreaInput"]`

**Files Updated:**
- `src/contents/complaints/dom/selectors.catalog.js` — added CHAT_BUTTON, CHAT_PAGE, CHAT_MESSAGE, CHAT_ANCHOR, CHAT_INPUT, CHAT_TIMING
- `docs/DOM_CONTRACT.md` — added sections 2.16 (Chat Button) and 2.17 (Chat Page)
- `docs/UI_CHANGELOG.md` — this entry
- `docs/Sprint 2. Chats/TASK_чаты.md` — updated MVP scope

**Commit:** TBD

---

#### 2026-02-08: Store Dropdown Shows Draft Complaints Count

**Change Type:** Feature (API v1.2.0)

**What Changed:**
- Backend API now returns `draftComplaintsCount` in `/api/extension/stores` response
- Extension displays complaint count next to store name in dropdown

**UI Update:**
- Store dropdown now shows: `ИП Артюшина — 45 жалоб`
- If count is 0: no suffix shown
- Shows exact count (no limit)

**Files Updated:**
- `src/diagnostic.js:loadStores()` - format store name with count
- `docs/BACKEND_API.md` - added `draftComplaintsCount` field documentation

**Commit:** TBD

---

#### 2026-02-04: Pagination Button Index Fix

**UI Change:**
- WB added 5th pagination button
- Old structure: 4 buttons `[First, Prev, Next, Last]`
- New structure: 5 buttons `[First, Prev, ???, Next, Last]`

**Impact:**
- Page navigation stopped working
- `findNextPageButton()` returned wrong button (index [2] instead of [3])
- Extension could not scan multiple pages

**Fix:**
- Changed pagination button index from `[2]` to `[3]`
- Updated button count check from 4 to 5

**Files Updated:**
- `src/contents/complaints/utils.js:findNextPageButton()` - index [2] → [3]
- `docs/SELECTORS.md` - pagination section

**Commit:** `cd3607f` - fix(pagination): update button index from [2] to [3]

---

#### 2026-02-03: Multi-Round Processing & API Fix (v2.2.0)

**Change Type:** Feature + Bug fix

**What Changed:**
1. **API Endpoint Fix:**
   - Old: `/api/stores/{storeId}/reviews/{reviewId}/complaint/sent`
   - New: `/api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent`
   - Status changed from `sent` → `pending`

2. **Multi-Round Processing:**
   - Added 10-round loop (up to 3000 complaints per session)
   - Each round fetches fresh complaints (filter=draft)
   - Processed complaints don't appear in next round
   - Cumulative statistics across all rounds

3. **New Metrics:**
   - `totalReviewsSynced` - count of reviews synced to DB
   - `rounds` - number of rounds completed
   - Results show "X из 10 макс."

**Files Updated:**
- `src/api/pilot-api.js:192` - fixed endpoint URL
- `src/diagnostic.js` - multi-round loop, constants MAX_ROUNDS/COMPLAINTS_PER_ROUND
- `src/contents/complaints/handlers/optimized-handler.js` - totalReviewsSynced metric

**Commits:**
- `81bf430` - fix(api): correct endpoint URL for complaint sent status
- `53dd9d2` - feat(diagnostic): add multi-round complaints processing
- `00987e9` - feat(handler): add totalReviewsSynced metric and parse all pages

---

#### 2026-02-02: Documentation System Created

**Change Type:** Internal documentation

**What Changed:**
- Created comprehensive documentation system
- Added selectors catalog
- Standardized all selector references

**Files Updated:**
- `docs/ARCHITECTURE.md`
- `docs/WORKFLOWS.md`
- `docs/BACKEND_API.md`
- `docs/DOM_CONTRACT.md`
- `docs/SELECTORS.md`
- `docs/SETUP_DEV.md`
- `docs/TROUBLESHOOTING.md`
- `docs/UI_CHANGELOG.md`
- `src/contents/complaints/dom/selectors.catalog.js`

**Impact:** No breaking changes, documentation only

---

### January 2026

#### 2026-01-28: Multiple Icon Buttons in Review Row

**UI Change:**
- WB added "Chat" button next to menu button
- Row now has TWO buttons with `onlyIcon` class
- Both are icon-only buttons (no text)

**Impact:**
- `findMenuButton()` was selecting chat button instead of menu
- Dropdown not opening (wrong button clicked)
- All complaints failing

**Fix:**
- Changed selection logic to use SVG viewBox attribute
- Menu button has viewBox containing "-10"
- Chat button has viewBox "0 0 16 16"
- Added fallback search through cells

**Files Updated:**
- `src/contents/complaints/dom/element-finder.js:findMenuButton()`

**Commit:** Part of v2.0.0 refactoring

---

#### 2026-01-28: Multiple Warning Buttons in Dropdown

**UI Change:**
- Dropdown now has TWO warning-styled buttons
- "Запросить возврат" (Request return) - first
- "Пожаловаться на отзыв" (Complain) - second

**Impact:**
- `findComplaintButton()` was selecting first warning button
- Wrong action triggered
- Complaints not being submitted

**Fix:**
- Changed to text-based matching: "Пожаловаться на отзыв"
- Fallback: select second warning button
- Text match takes priority over class match

**Files Updated:**
- `src/contents/complaints/dom/element-finder.js:findComplaintButton()`

**Commit:** Part of v2.0.0 refactoring

---

#### 2026-01-28: Datetime Display Format

**UI Change:**
- WB now shows full datetime: "27.01.2026 в 15:05"
- Previously showed date and time separately
- Time is in Moscow timezone (UTC+3)

**Impact:**
- Old date extraction returned only date (no time)
- Review keys were not unique (same date = collision)
- Multiple reviews with same date were matching incorrectly

**Fix:**
- Updated datetime parsing to extract full timestamp
- Convert MSK to UTC for consistent keys
- Key format: `productId_rating_ISO8601timestamp`

**Files Updated:**
- `src/contents/complaints/dom/data-extractor.js:getReviewDate()`
- `src/contents/complaints/dom/data-extractor.js:parseWBDatetime()`

**Commit:** Part of v2.0.0 refactoring

---

#### 2026-01-28: Textarea Appears After Category Selection

**UI Change:**
- Complaint modal textarea only renders after selecting category
- Previously textarea existed from modal open
- React conditional rendering

**Impact:**
- `findSubmitButton()` and textarea search failing
- "Поле для текста не найдено" errors
- Complaints not completing

**Fix:**
- Select category radio button first
- Wait 500ms for textarea to render
- Then proceed with text entry

**Files Updated:**
- `src/contents/complaints/services/complaint-service.js:submitComplaint()`

**Commit:** Part of v2.0.0 refactoring

---

#### 2026-01-28: Review ID Removed from UI

**UI Change:**
- WB removed review ID from visible interface
- No `data-id` or `data-review-id` attributes
- IDs only in internal API

**Impact:**
- Cannot extract review ID from DOM
- Must use synthetic keys for matching

**Fix:**
- Generate synthetic keys: `productId_rating_timestamp`
- Match reviews by key instead of ID
- API provides ID for marking as sent

**Files Updated:**
- `src/contents/complaints/dom/data-extractor.js:createReviewKey()`
- `src/contents/complaints/utils.js:getIdFromRow()` (deprecated)

**Commit:** Part of v2.0.0 refactoring

---

#### 2026-01-28: Pagination Button Position Change

**UI Change:**
- Pagination buttons order verified
- 4 buttons: First, Previous, Next, Last
- Next button at index [2] (not last)

**Impact:**
- Was searching for "next" in wrong position
- Page navigation failing

**Fix:**
- Fixed index to [2] for Next button
- Added verification logging
- Updated documentation

**Files Updated:**
- `src/contents/complaints/utils.js:findNextPageButton()`

**Commit:** Part of v2.0.0 refactoring

---

#### 2026-01-28: New Column "Инфо о товаре"

**UI Change:**
- WB added new column in reviews table
- Menu button no longer in last cell
- Table layout shifted

**Impact:**
- Cell-based button search failing
- Fallback strategies needed

**Fix:**
- Primary: Use viewBox-based search (column-independent)
- Fallback: Search all cells right-to-left
- Not dependent on column position

**Files Updated:**
- `src/contents/complaints/dom/element-finder.js:findMenuButton()`

**Commit:** Part of v2.0.0 refactoring

---

## Adding New Entries

When WB UI changes cause issues, add an entry following this template:

```markdown
#### YYYY-MM-DD: Brief Description

**UI Change:**
- What specifically changed in WB interface

**Impact:**
- What broke in the extension
- Error messages observed

**Fix:**
- What was updated
- New approach/selector used

**Files Updated:**
- `path/to/file.js:functionName()`

**Commit:** abc1234
```

---

## Best Practices

1. **Document immediately** - When fixing UI issues, add changelog entry
2. **Include console output** - Log errors help future debugging
3. **Screenshot if helpful** - Visual references in `docs/Archive/HTML/`
4. **Cross-reference** - Update `DOM_CONTRACT.md` and `SELECTORS.md` too
5. **Test thoroughly** - Run all diagnostic tests after fix

---

## Related Documents

- [DOM_CONTRACT.md](DOM_CONTRACT.md) - UI entity definitions
- [SELECTORS.md](SELECTORS.md) - Selector details and strategies
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and fixes
