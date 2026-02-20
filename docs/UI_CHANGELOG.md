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

### February 2026

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
