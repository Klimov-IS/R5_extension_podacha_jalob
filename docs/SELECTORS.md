# SELECTORS.md

## Rating5 Complaints Extension — Selector Management

This document describes the selector strategy, ownership rules, and how selectors map to DOM_CONTRACT entities.

---

## 1. Selector Strategy

### 1.1 Priority Order

When choosing selectors, use this priority (most stable first):

| Priority | Selector Type | Example | Stability |
|----------|--------------|---------|-----------|
| 1 | data-* attributes | `[data-name="Text"]` | **High** |
| 2 | ARIA role/label | `[role="menu"]` | **High** |
| 3 | Semantic ID | `#explanation` | **High** |
| 4 | Stable class patterns | `[class*="Dropdown-list"]` | Medium |
| 5 | Element + attribute | `input[type="radio"]` | Medium |
| 6 | Text content | Contains "Пожаловаться" | Medium |
| 7 | Structural position | `children[2]` | **Low** |
| 8 | Deep nesting | `.a > .b > .c > .d` | **Low** |

### 1.2 Class Pattern Strategy

WB uses CSS modules with hashed suffixes:
```
Dropdown-list__abc123
Rating--active__def456
```

**Strategy:** Use partial class matching:
```css
[class*="Dropdown-list"]
[class*="Rating--active"]
```

**Never** match the full class name (hash changes on deploy).

### 1.3 Fallback Chain Philosophy

Every critical element should have:
1. **Primary selector** - Most reliable method
2. **Fallback 1** - Alternative approach
3. **Fallback 2** - Last resort (may be less precise)

When none match, log a clear error identifying which element failed.

---

## 2. Selector Ownership

### 2.1 File Locations

| File | Responsibility |
|------|----------------|
| `element-finder.js` | UI element selectors (buttons, modals, dropdowns) |
| `data-extractor.js` | Data element selectors (rating, date, statuses) |
| `utils.js` | Utility selectors (search, pagination) |
| `selectors.catalog.js` | Centralized selector constants (if exists) |

### 2.2 Rules

1. **Centralization:** Critical selectors should be in catalog file
2. **Documentation:** Each selector must have comment explaining purpose
3. **Change tracking:** Selector changes require `UI_CHANGELOG.md` entry
4. **Testing:** New selectors require diagnostic test verification

---

## 3. Selector Catalog

### 3.1 Reviews Table

**Entity:** Reviews table container

```javascript
const TABLE_SELECTORS = {
  primary: '[class*="Base-table-body"]',
  fallback1: 'tbody',
  fallback2: '[role="rowgroup"]'
};
```

**Code location:** `element-finder.js:findReviewsTable()`

---

### 3.2 Review Row

**Entity:** Individual review row

```javascript
const ROW_SELECTORS = {
  primary: '[class*="table-row"]',
  // Rows are direct children of table body
};
```

**Code location:** Used in `optimized-handler.js` via querySelectorAll

---

### 3.3 Rating Display

**Entity:** Star rating indicator

```javascript
const RATING_SELECTORS = {
  container: '[class*="Rating__"]',
  activeStars: '[class*="Rating--active__"]',
  // Fallback: count SVG with fill="#FF773C"
};
```

**Code location:** `data-extractor.js:getRating()`

---

### 3.4 DateTime Display

**Entity:** Review date and time

```javascript
const DATETIME_SELECTORS = {
  textSpan: 'span[data-name="Text"]',
  pattern: /\d{2}\.\d{2}\.\d{4}\s+в\s+\d{2}:\d{2}/,
  containerFallback: '[class*="Col-date-time-with-readmark__"]'
};
```

**Code location:** `data-extractor.js:getReviewDate()`

---

### 3.5 Review Statuses

**Entity:** Status chips/tags

```javascript
const STATUS_SELECTORS = {
  container: '[class*="Feedback-statuses"]',
  chips: '[data-name="Chips"]',
  chipText: '[class*="Chips__text"]',
  fallbackContainer: '[class*="Extended-article-info-card__statuses"]'
};
```

**Code location:** `data-extractor.js:getReviewStatuses()`

---

### 3.6 Menu Button (Three Dots)

**Entity:** Action menu trigger

```javascript
const MENU_BUTTON_SELECTORS = {
  // Primary: Find by SVG viewBox (distinguishes from chat button)
  buttonWithIcon: 'button[class*="onlyIcon"]',
  svgViewBox: '-10', // Must contain this value

  // Fallbacks
  moreButton: '[class*="More-button__button"]'
};
```

**Code location:** `element-finder.js:findMenuButton()`

**Important:** Row has TWO icon buttons. Chat button has viewBox "0 0 16 16", menu button has viewBox containing "-10".

---

### 3.7 Dropdown Menu

**Entity:** Context menu popup

```javascript
const DROPDOWN_SELECTORS = {
  item: 'li[class*="Dropdown-list__item"]',
  list: 'ul[class*="Dropdown-list"]',
  option: 'button[class*="Dropdown-option"]',
  role: '[role="menu"], [role="listbox"]'
};
```

**Code location:** `element-finder.js:findOpenDropdown()`

---

### 3.8 Complaint Button

**Entity:** "Пожаловаться на отзыв" action

```javascript
const COMPLAINT_BUTTON_SELECTORS = {
  // Primary: Text matching (most reliable)
  textMatch: 'Пожаловаться на отзыв',

  // Fallback: Second warning button in dropdown
  warningButton: 'button[class*="Dropdown-option--warning"]'
  // WARNING: There are TWO warning buttons, need second one
};
```

**Code location:** `element-finder.js:findComplaintButton()`

**Important:** First warning button is "Запросить возврат", second is "Пожаловаться".

---

### 3.9 Complaint Modal

**Entity:** Complaint submission form

```javascript
const MODAL_SELECTORS = {
  primary: '[class*="Complaint-form"]',
  formWithRadio: 'form:has(input[type="radio"]):has(textarea)',
  byTextareaId: '#explanation' // then .closest()
};
```

**Code location:** `element-finder.js:findComplaintModal()`

---

### 3.10 Category Radio Buttons

**Entity:** Complaint category selection

```javascript
const CATEGORY_SELECTORS = {
  radios: 'input[type="radio"]',
  byValue: 'input[type="radio"][value="{reasonId}"]',
  label: 'label[for="{radioId}"]'
};
```

**Code location:** `complaint-service.js:_selectReason()`

---

### 3.11 Complaint Textarea

**Entity:** Complaint text input

```javascript
const TEXTAREA_SELECTORS = {
  primary: '#explanation',
  fallback: 'textarea',
  contentEditable: '[contenteditable="true"]'
};
```

**Code location:** `complaint-service.js:_enterComplaintText()`

**Important:** Textarea only appears AFTER selecting category.

---

### 3.12 Submit Button

**Entity:** Form submit button

```javascript
const SUBMIT_BUTTON_SELECTORS = {
  container: '[class*="Complaint-form__buttons"]',
  button: 'button',
  textMatch: 'Отправить',
  submitType: 'button[type="submit"]'
};
```

**Code location:** `element-finder.js:findSubmitButton()`

---

### 3.13 Search Input

**Entity:** Product search field

```javascript
const SEARCH_SELECTORS = {
  placeholder: 'input[placeholder*="Поиск"], input[placeholder*="поиск"]',
  type: 'input[type="search"]',
  classPattern: 'input[class*="search" i], input[class*="Search"]'
};
```

**Code location:** `utils.js:findSearchInputSync()`

---

### 3.14 Pagination Buttons

**Entity:** Page navigation controls

```javascript
const PAGINATION_SELECTORS = {
  arrows: '[class*="Token-pagination__arrow"]',
  // Fixed positions (updated 04.02.2026 - WB added 5th button):
  // [0] = First page (◀◀)
  // [1] = Previous page (◀)
  // [2] = ??? (new button)
  // [3] = Next page (▶) <-- IMPORTANT
  // [4] = Last page (▶▶)
  nextPageIndex: 3
};
```

**Code location:** `utils.js:findNextPageButton()`

**Important:** Button at index [3] is "Next page". Updated 04.02.2026 - WB added 5th button, index shifted from [2] to [3].

---

## 4. Selector Change Process

When UI changes require selector updates:

### 4.1 Investigation

1. Open WB page in DevTools
2. Identify changed element structure
3. Find stable attributes (data-*, role, id)
4. Test new selector in console

### 4.2 Implementation

1. Update selector in appropriate file
2. Add fallback if possible
3. Test with diagnostic modes (Test 1, 2)
4. Update this SELECTORS.md

### 4.3 Documentation

1. Add entry to `UI_CHANGELOG.md`:
   ```markdown
   ## 2026-02-XX
   - **Element:** Menu button
   - **Change:** New viewBox value
   - **Selector update:** element-finder.js:findMenuButton()
   - **Commit:** abc123
   ```

2. Update `DOM_CONTRACT.md` if entity structure changed

---

## 5. Diagnostic Commands

Test selectors in browser console:

```javascript
// Table
document.querySelector('[class*="Base-table-body"]')

// Rows
document.querySelectorAll('[class*="table-row"]').length

// Menu button (first row)
const row = document.querySelector('[class*="table-row"]');
row.querySelector('button[class*="onlyIcon"] svg[viewBox*="-10"]')?.closest('button')

// Dropdown (when open)
document.querySelector('li[class*="Dropdown-list__item"]')?.parentElement

// Complaint button (when dropdown open)
[...document.querySelectorAll('button')].find(b => b.innerText?.includes('Пожаловаться'))

// Modal (when open)
document.querySelector('[class*="Complaint-form"]')

// Pagination buttons
document.querySelectorAll('[class*="Token-pagination__arrow"]')
```

---

## 6. Known Issues

### 6.1 Multiple Icon Buttons (January 2026)

**Problem:** Row has both chat and menu buttons with similar classes.

**Solution:** Distinguish by SVG viewBox attribute.

### 6.2 Multiple Warning Buttons (January 2026)

**Problem:** Dropdown has two warning-styled buttons.

**Solution:** Match by text content, not class alone.

### 6.3 Textarea Timing (January 2026)

**Problem:** Textarea doesn't exist until category selected.

**Solution:** Select category first, then wait 500ms for textarea.

### 6.4 React Controlled Inputs

**Problem:** Direct value assignment doesn't trigger React state.

**Solution:** Use `execCommand('insertText')` or InputEvent with native setter.
