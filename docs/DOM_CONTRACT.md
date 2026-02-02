# DOM_CONTRACT.md

## Rating5 Complaints Extension — DOM Contract

This document defines the **formal contract** describing the Wildberries (Valdris UI) Reviews page as seen by the extension. It is UI-focused, not code-focused.

**Last Updated:** February 2026

---

## 1. Target Page

### 1.1 URL Pattern

```
https://seller.wildberries.ru/feedbacks-questions/feedbacks*
```

**Example URLs:**
- `https://seller.wildberries.ru/feedbacks-questions/feedbacks`
- `https://seller.wildberries.ru/feedbacks-questions/feedbacks?dateFrom=2026-01-01&dateTo=2026-01-31`

### 1.2 Page Purpose

The WB Seller Portal feedback management page where sellers can:
- View customer reviews
- Search by product article
- Filter by rating and status
- Submit complaints about reviews
- Navigate through pages of reviews

---

## 2. Core UI Entities

### 2.1 Reviews Table

**What it represents:** Container holding all visible review rows.

**Required properties:**
- Contains multiple review rows
- Rows represent individual customer reviews
- Each row has consistent structure

**Conceptual identification:**
- Container with class containing `Base-table-body`
- Or element with role `rowgroup`
- Or `<tbody>` element

**Invariants:**
- Always present when reviews exist
- Rows are direct children of the table body
- Table loads asynchronously after search/navigation

---

### 2.2 Review Row

**What it represents:** A single customer review displayed as a table row.

**Required properties:**
- Contains: rating display, date/time, review text
- Contains: action menu button (three dots)
- Contains: status indicators (chips)
- Has unique combination of: productId + rating + datetime

**Conceptual identification:**
- Element with class containing `table-row`
- Direct child of reviews table body

**Data extractable from row:**

| Data | Location | Format |
|------|----------|--------|
| Rating | Stars container | 1-5 active stars |
| DateTime | Text span | "DD.MM.YYYY в HH:MM" |
| Review text | Long text span | Free text |
| Statuses | Chips elements | Array of strings |

**Invariants:**
- Each row has exactly one rating
- Each row has exactly one datetime
- Rating is 1-5 (no fractional)
- Datetime uses Moscow timezone (UTC+3)

---

### 2.3 Review Identifier (Key)

**What it represents:** Unique identifier for a review within the system.

**Note:** WB does not expose review IDs in the UI (removed January 2026). The extension generates synthetic keys.

**Key format:**
```
{productId}_{rating}_{ISO8601timestamp}
```

**Example:**
```
649502497_1_2026-01-07T17:09:00.000Z
```

**Required properties:**
- productId: from search context (article number)
- rating: extracted from stars (1-5)
- timestamp: extracted from datetime display, converted to UTC

**Normalization:**
For matching, seconds are removed:
```
649502497_1_2026-01-07T17:09:00.000Z → 649502497_1_2026-01-07T17:09
```

**Invariants:**
- Key uniqueness depends on review timing precision
- Multiple reviews with same rating on same minute may collide (rare)
- WB shows MSK time, must convert to UTC

---

### 2.4 Rating Display

**What it represents:** Star rating indicator (1-5 stars).

**Required properties:**
- Visual representation of 1-5 stars
- Active (filled) vs inactive (empty) distinction
- Consistent position within row

**Conceptual identification:**
- Container with class containing `Rating__`
- Contains 5 star elements (SVG or div)
- Active stars have class `Rating--active__`
- Or SVG fill color `#FF773C` (orange)

**Extraction methods:**
1. Count elements with class `Rating--active__`
2. Count SVG paths with `fill="#FF773C"`

**Invariants:**
- Always exactly 5 star positions
- Active stars count = rating (1-5)
- Stars are ordered left to right (1st → 5th)

---

### 2.5 DateTime Display

**What it represents:** When the review was posted.

**Required properties:**
- Date in format DD.MM.YYYY
- Time in format HH:MM
- Displayed in Moscow timezone (UTC+3)

**Display format (January 2026):**
```
27.01.2026 в 15:05
```

**Conceptual identification:**
- Span with `data-name="Text"` attribute
- Text matching pattern: `\d{2}\.\d{2}\.\d{4}\s+в\s+\d{2}:\d{2}`

**Alternative structure:**
- Container: class `Col-date-time-with-readmark__`
- Date: inside `date-with-marker` child
- Time: separate span sibling

**Invariants:**
- Always Moscow time (UTC+3)
- Seconds not displayed (always :00 in parsed timestamp)
- Format is consistent across all reviews

---

### 2.6 Review Statuses

**What it represents:** Status tags/chips showing review state.

**Required properties:**
- Multiple statuses possible per review
- Displayed as "Chips" UI elements
- Categories: visibility, complaint, transaction

**Status categories:**

| Category | Statuses |
|----------|----------|
| Visibility | Виден, Снят с публикации, Исключён из рейтинга, Временно скрыт |
| Complaint | Жалоба отклонена, Жалоба одобрена, Проверяем жалобу, Жалоба пересмотрена |
| Transaction | Выкуп, Отказ, Возврат, Запрошен возврат |

**Conceptual identification:**
- Container with class `Feedback-statuses__`
- Or container with class `Extended-article-info-card__statuses`
- Chips: elements with `data-name="Chips"`
- Text inside: class `Chips__text__`

**Invariants:**
- "Виден" is default, may not be explicitly shown
- Complaint statuses are mutually exclusive
- Transaction statuses indicate purchase type

---

### 2.7 Action Menu Button (Three Dots)

**What it represents:** Button to open context menu with actions.

**Required properties:**
- Clickable button element
- Located within review row
- Opens dropdown on click

**Visual appearance:**
- Three vertical dots icon (⋮)
- SVG with characteristic viewBox containing "-10"

**Conceptual identification:**
1. Button with class `onlyIcon` containing SVG with viewBox "-10"
2. Button with class `More-button__button`
3. Button in rightmost cells with dots icon

**Important (January 2026):**
- Row may have TWO icon buttons
- Chat button (disabled, viewBox "0 0 16 16")
- Menu button (active, viewBox contains "-10")
- Must identify by viewBox, not just icon class

**Invariants:**
- One menu button per row
- Click must open dropdown
- Button may require scroll into view

---

### 2.8 Dropdown Menu

**What it represents:** Context menu that appears after clicking action button.

**Required properties:**
- Appears on click of menu button
- Contains action items including "Пожаловаться"
- Closes when clicking outside or selecting action

**Conceptual identification:**
- List with class `Dropdown-list__`
- Items with class `Dropdown-list__item__`
- Or element with `role="menu"` or `role="listbox"`

**Structure (January 2026):**
```html
<ul class="Dropdown-list__xxx">
  <li class="Dropdown-list__item__xxx">
    <button class="Dropdown-option__xxx">Action 1</button>
  </li>
  <li>
    <button class="Dropdown-option--warning__xxx">Action 2</button>
  </li>
</ul>
```

**Invariants:**
- Appears in DOM when open
- Has high z-index (above other content)
- Contains "Пожаловаться на отзыв" action

---

### 2.9 Complaint Button

**What it represents:** Button to initiate complaint submission.

**Required properties:**
- Text contains "Пожаловаться на отзыв"
- Located inside dropdown menu
- Clicking opens complaint modal

**Conceptual identification:**
- Button with text containing "Пожаловаться на отзыв"
- Inside dropdown menu
- May have class `Dropdown-option--warning__`

**Important (January 2026):**
- TWO warning-styled buttons exist in dropdown
- "Запросить возврат" is first
- "Пожаловаться на отзыв" is second
- Must match by text, not just warning class

**Invariants:**
- Button is disabled if complaint already exists
- Text is always in Russian
- Click triggers modal opening

---

### 2.10 Complaint Modal

**What it represents:** Form for submitting complaint details.

**Required properties:**
- Category selection (radio buttons)
- Text input area (textarea)
- Submit button
- Appears as overlay/modal

**Conceptual identification:**
- Element with class `Complaint-form__`
- Or form containing radio buttons AND textarea
- Or container holding `#explanation` textarea

**Structure (January 2026):**
```html
<section class="Complaint-form__xxx">
  <form>
    <!-- Category radio buttons -->
    <input type="radio" name="category" value="fake" />
    <input type="radio" name="category" value="spam" />
    ...

    <!-- Text area (appears AFTER category selection) -->
    <textarea id="explanation"></textarea>

    <!-- Submit button -->
    <div class="Complaint-form__buttons__xxx">
      <button>Отправить</button>
    </div>
  </form>
</section>
```

**Important (January 2026):**
- Textarea appears ONLY after selecting category
- Must select category first, then wait for textarea
- React controlled component (special input handling required)

**Invariants:**
- Modal appears as overlay
- Must select category before textarea is visible
- Submit button validates required fields

---

### 2.11 Category Radio Buttons

**What it represents:** Complaint category selection.

**Required properties:**
- Multiple mutually exclusive options
- Each has value (reasonId) and label (reasonName)
- Selection triggers textarea appearance

**Conceptual identification:**
- Input elements with `type="radio"` inside modal
- Labels with `for` attribute matching radio id

**Known categories (subject to change):**
- fake - Ненастоящий отзыв
- spam - Спам
- offensive - Оскорбительный контент
- irrelevant - Не относится к товару

**Invariants:**
- One category must be selected before submit
- Selection triggers UI state change
- Value attribute contains reasonId

---

### 2.12 Complaint Textarea

**What it represents:** Text input for complaint description.

**Required properties:**
- ID: `explanation`
- Accepts complaint text
- React controlled component

**Conceptual identification:**
- Textarea with `id="explanation"`
- Or first textarea inside complaint modal

**Input handling:**
React controlled components reset value on direct assignment. Must use:
1. `document.execCommand('insertText')` - preferred
2. DataTransfer + paste event - fallback
3. InputEvent with native setter - last resort

**Invariants:**
- Only visible after category selection
- Maximum character limit applies
- React state must be triggered via events

---

### 2.13 Submit Button

**What it represents:** Button to submit the complaint form.

**Required properties:**
- Text contains "Отправить"
- Inside modal buttons container
- Triggers form submission

**Conceptual identification:**
- Button inside `Complaint-form__buttons__` container
- Button with text "Отправить"
- Button with `type="submit"` inside modal

**Invariants:**
- Enabled only when form is valid
- Click initiates submission to WB backend
- Modal closes on successful submission

---

### 2.14 Search Input

**What it represents:** Field for searching reviews by product article.

**Required properties:**
- Accepts product article number (nmId)
- Triggers search on Enter key
- Filters displayed reviews

**Conceptual identification:**
- Input with `placeholder` containing "Поиск"
- Input with `type="search"`
- Input with class containing "search" (case insensitive)

**Invariants:**
- Search requires Enter key to activate
- Results load asynchronously (wait 7.5s)
- Clearing search shows all reviews

---

### 2.15 Pagination Controls

**What it represents:** Navigation between pages of reviews.

**Required properties:**
- Four navigation buttons
- Next page button at index [2]
- Buttons disabled at page boundaries

**Button order (left to right):**
| Index | Function | Symbol |
|-------|----------|--------|
| [0] | First page | ◀◀ |
| [1] | Previous page | ◀ |
| [2] | **Next page** | ▶ |
| [3] | Last page | ▶▶ |

**Conceptual identification:**
- Buttons with class `Token-pagination__arrow`
- Exactly 4 buttons in pagination container

**Important:**
- "Next page" is at **fixed index [2]** (not last)
- Button disabled when on last page
- Page change requires 4s wait for content load

**Invariants:**
- 4 pagination buttons always present
- "Next" at index [2], "Previous" at index [1]
- Disabled state via `disabled` attribute

---

## 3. Assumptions and Invariants

### 3.1 Page Load State

- Reviews table loads after initial page load
- Content scripts inject at `document_idle`
- Must wait for elements before interaction

### 3.2 React Behavior

WB uses React. Key behaviors:
- State managed internally, not via DOM
- Direct value assignment doesn't trigger state update
- Must use events (input, change) to trigger React
- Controlled components require special handling

### 3.3 Timing Requirements

| Action | Wait Time | Reason |
|--------|-----------|--------|
| Search | 7500ms | API response + render |
| Page navigation | 4000ms | API response + render |
| Modal open | 1800ms | Animation + render |
| Category select | 500ms | Textarea appearance |
| Submit | 1500ms | API call + confirmation |

### 3.4 UI Change Frequency

WB UI changes frequently. When updating selectors:
1. Check this DOM_CONTRACT first
2. Update selectors in `element-finder.js`
3. Update `UI_CHANGELOG.md` with changes
4. Test all diagnostic modes

---

## 4. Verification Checklist

When UI breaks, verify these elements in order:

1. **Reviews Table** - Is the table container class still valid?
2. **Review Rows** - Are rows identified correctly?
3. **Menu Button** - Is the SVG viewBox still "-10"?
4. **Dropdown** - Has the dropdown class changed?
5. **Complaint Button** - Is the text still "Пожаловаться на отзыв"?
6. **Modal** - Has the modal structure changed?
7. **Textarea** - Is the ID still "explanation"?
8. **Submit Button** - Is the button container class valid?
9. **Pagination** - Are there still 4 buttons at correct positions?

---

## 5. Quick Reference

### Element → Selector Strategy

| Element | Primary Strategy | Fallback |
|---------|------------------|----------|
| Table | `[class*="Base-table-body"]` | `tbody` |
| Row | `[class*="table-row"]` | Direct children |
| Rating | `[class*="Rating--active__"]` | SVG fill color |
| DateTime | `span[data-name="Text"]` + pattern | Container class |
| Statuses | `[data-name="Chips"]` | Text matching |
| Menu Button | SVG viewBox "-10" | `More-button` class |
| Dropdown | `[class*="Dropdown-list"]` | `role="menu"` |
| Complaint Btn | Text "Пожаловаться на отзыв" | 2nd warning button |
| Modal | `[class*="Complaint-form"]` | Form with radio+textarea |
| Textarea | `#explanation` | First textarea in modal |
| Submit | Container class | Text "Отправить" |
| Search | `placeholder*="Поиск"` | `type="search"` |
| Pagination | `[class*="Token-pagination__arrow"][2]` | Fixed position |
