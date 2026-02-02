# TROUBLESHOOTING.md

## Rating5 Complaints Extension — Troubleshooting Guide

This document describes known failure modes and recovery steps.

---

## 1. UI Element Not Found

### 1.1 Reviews Table Not Found

**Symptoms:**
- Error: "Таблица не найдена"
- Diagnostic Test 1 fails at first check
- No rows displayed in results

**Probable Causes:**
1. Page not fully loaded
2. WB UI structure changed
3. Not on feedbacks page

**Actions:**
1. Wait for page to fully load (spinner gone)
2. Verify URL contains `/feedbacks-questions/feedbacks`
3. Check DevTools → Elements for `[class*="Base-table-body"]`
4. If structure changed, update `element-finder.js:findReviewsTable()`

**Debug:**
```javascript
// In WB page console:
document.querySelector('[class*="Base-table-body"]')
// Or fallback:
document.querySelector('tbody')
```

---

### 1.2 Menu Button (Three Dots) Not Found

**Symptoms:**
- Error: "Кнопка меню не найдена"
- Complaint skipped
- Diagnostics show "Menu button not found"

**Probable Causes:**
1. Row structure changed
2. Button has new class/icon
3. Chat button being selected instead

**Actions:**
1. Verify row has button with `class*="onlyIcon"`
2. Check SVG viewBox contains "-10" (menu icon)
3. Distinguish from chat button (viewBox "0 0 16 16")

**Debug:**
```javascript
const row = document.querySelector('[class*="table-row"]');
// Find all icon buttons
row.querySelectorAll('button[class*="onlyIcon"]').forEach((btn, i) => {
  const svg = btn.querySelector('svg');
  console.log(`Button ${i}:`, svg?.getAttribute('viewBox'));
});
// Menu button should have viewBox with "-10"
```

**Fix (if icon changed):**
1. Inspect new button in DevTools
2. Find unique identifier (viewBox, class, data-*)
3. Update `element-finder.js:findMenuButton()`
4. Update `docs/SELECTORS.md`
5. Add entry to `docs/UI_CHANGELOG.md`

---

### 1.3 Dropdown Not Opening

**Symptoms:**
- Error: "Dropdown меню не появилось"
- Diagnostics fail at dropdown check
- Menu button click has no effect

**Probable Causes:**
1. Click not registering (React event issue)
2. Dropdown class changed
3. Page state blocking interaction

**Actions:**
1. Try clicking menu button manually
2. Check if dropdown appears in DOM after click
3. Verify dropdown class pattern still valid

**Debug:**
```javascript
// After clicking menu button:
document.querySelector('li[class*="Dropdown-list__item"]')?.parentElement
// Or:
document.querySelector('[role="menu"]')
```

**Fix:**
1. If click not working, check `utils.js:clickElementForced()`
2. If class changed, update `element-finder.js:findOpenDropdown()`

---

### 1.4 Complaint Button Not Found

**Symptoms:**
- Error: "Кнопка 'Пожаловаться' не найдена"
- Dropdown opens but button missing
- Wrong button being selected

**Probable Causes:**
1. Text changed ("Пожаловаться" → something else)
2. Button structure changed
3. Multiple warning buttons (selecting wrong one)

**Actions:**
1. Open dropdown manually
2. Check exact text of complaint button
3. Verify it's the second warning button (first is "Запросить возврат")

**Debug:**
```javascript
// With dropdown open:
const dropdown = document.querySelector('[class*="Dropdown-list"]');
dropdown.querySelectorAll('button').forEach((btn, i) => {
  console.log(`Button ${i}:`, btn.innerText);
});
```

**Important:** Match by text "Пожаловаться на отзыв", not by class alone.

---

## 2. Complaint Modal Issues

### 2.1 Modal Not Opening

**Symptoms:**
- Error: "Модальное окно не появилось"
- Returns "NEED_RELOAD"
- Page reloads unexpectedly

**Probable Causes:**
1. Click on complaint button failed
2. Modal render delayed
3. WB server issue
4. React state stuck

**Actions:**
1. Try clicking complaint button manually
2. Increase modal wait time (currently 1.8s)
3. Check if modal exists in DOM
4. Refresh WB page and retry

**Debug:**
```javascript
document.querySelector('[class*="Complaint-form"]')
// Or:
document.querySelector('form:has(input[type="radio"]):has(textarea)')
```

**Fix:**
- If timing issue, adjust `TIMING.modalWait` in selectors catalog
- If selector changed, update `element-finder.js:findComplaintModal()`

---

### 2.2 Category Selection Failed

**Symptoms:**
- Error: "Радиокнопки не найдены"
- Modal opens but can't select category
- Form incomplete

**Probable Causes:**
1. Radio button structure changed
2. Form not fully rendered
3. React state not updating

**Actions:**
1. Check if radio buttons exist in modal
2. Verify `input[type="radio"]` selector works
3. Wait longer after modal opens

**Debug:**
```javascript
const modal = document.querySelector('[class*="Complaint-form"]');
modal.querySelectorAll('input[type="radio"]').forEach((radio, i) => {
  console.log(`Radio ${i}:`, radio.value, radio.id);
});
```

---

### 2.3 Textarea Not Found

**Symptoms:**
- Error: "Поле для текста не найдено"
- Returns "NEED_RELOAD"
- Can't enter complaint text

**Probable Causes:**
1. **Category not selected first** (most common)
2. Textarea ID changed
3. Render timing issue

**Actions:**
1. **Ensure category is selected before looking for textarea**
2. Wait 500ms after category selection
3. Check if `#explanation` exists

**Debug:**
```javascript
// IMPORTANT: Textarea only appears AFTER selecting category
document.querySelector('#explanation')
// Or:
document.querySelector('textarea')
```

**Important:** WB modal shows textarea ONLY after category selection!

---

### 2.4 Submit Button Not Found

**Symptoms:**
- Error: "Кнопка 'Отправить' не найдена"
- Form filled but can't submit
- Complaint marked as error

**Probable Causes:**
1. Button container class changed
2. Button text changed
3. Form validation blocking button

**Actions:**
1. Check button exists with text "Отправить"
2. Verify container class `Complaint-form__buttons`
3. Ensure form is valid (all required fields filled)

**Debug:**
```javascript
document.querySelector('[class*="Complaint-form__buttons"] button')
// Or by text:
[...document.querySelectorAll('button')].find(b => b.innerText.includes('Отправить'))
```

---

## 3. Status Sync Failures

### 3.1 Sync Request Timeout

**Symptoms:**
- Error: "Таймаут ожидания ответа"
- Status sync not completing
- 30 second timeout reached

**Probable Causes:**
1. Network issue
2. Backend server down
3. Message bridge broken

**Actions:**
1. Check network connectivity
2. Verify backend is reachable (`http://158.160.217.236/api/health`)
3. Check Chrome DevTools → Network for failed requests

**Debug:**
```javascript
// Test backend connection:
fetch('http://158.160.217.236/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

---

### 3.2 HTTP 401 Unauthorized

**Symptoms:**
- Error: "Ошибка авторизации"
- All API requests fail
- 401 status in network tab

**Probable Causes:**
1. Token expired or invalid
2. Token not being sent
3. Backend token changed

**Actions:**
1. Verify token in `settings-service.js`
2. Check Authorization header in request
3. Contact backend team for new token if needed

**Debug:**
```javascript
// Check token being used:
// In service worker console:
settingsService.getBackendToken()
```

---

### 3.3 HTTP 429 Rate Limited

**Symptoms:**
- Error: "Превышен лимит запросов"
- Requests start failing mid-batch
- X-RateLimit-Remaining: 0

**Actions:**
1. Wait for rate limit reset (check X-RateLimit-Reset header)
2. Reduce batch size
3. Increase delay between requests

**Prevention:**
- Current delay: 500ms between status sync batches
- Current batch size: 100 reviews

---

## 4. Content Script Issues

### 4.1 Content Script Not Injected

**Symptoms:**
- `window.OptimizedHandler` is undefined
- "Content script not ready" error
- Extension icon shows no action

**Probable Causes:**
1. Extension not loaded/enabled
2. Page not matching URL pattern
3. Script injection error

**Actions:**
1. Reload extension in `chrome://extensions/`
2. Verify URL matches `*://seller.wildberries.ru/*`
3. Check for errors in extension console
4. Refresh WB page

**Debug:**
```javascript
// In WB page console:
console.log('Modules loaded:', {
  OptimizedHandler: !!window.OptimizedHandler,
  ElementFinder: !!window.ElementFinder,
  DataExtractor: !!window.DataExtractor,
  WBUtils: !!window.WBUtils
});
```

---

### 4.2 Main World Bundle Not Loading

**Symptoms:**
- Only partial modules available
- `window.OptimizedHandler` undefined
- "Script error" in console

**Probable Causes:**
1. `dist/` not built
2. Bundle path incorrect
3. CSP blocking script

**Actions:**
1. Run `npm run build`
2. Verify `dist/content-main-world.bundle.js` exists
3. Check manifest `web_accessible_resources`

---

## 5. Diagnostic Page Issues

### 5.1 Stores Not Loading

**Symptoms:**
- "Ошибка загрузки магазинов"
- Dropdown shows error
- Cannot proceed with test

**Probable Causes:**
1. Backend unreachable
2. Network error
3. Token invalid

**Actions:**
1. Check network connectivity
2. Verify backend health
3. Check browser console for errors

**Debug:**
```javascript
// In diagnostic page console:
fetch('http://158.160.217.236/api/extension/stores', {
  headers: { 'Authorization': 'Bearer wbrm_...' }
}).then(r => r.json()).then(console.log);
```

---

### 5.2 Test Not Starting

**Symptoms:**
- "WB tab not found" error
- "Content script not ready" error
- Test button does nothing

**Probable Causes:**
1. WB feedbacks page not open
2. Wrong WB page open
3. Content script not injected

**Actions:**
1. Open `seller.wildberries.ru/feedbacks-questions/feedbacks`
2. Wait for page to fully load
3. Refresh the page
4. Try test again

---

## 6. Performance Issues

### 6.1 Processing Too Slow

**Symptoms:**
- Complaints taking very long
- UI feels unresponsive
- Timeouts occurring

**Probable Causes:**
1. Slow network connection
2. WB API latency
3. Too many complaints in batch

**Actions:**
1. Reduce batch size (currently 300 max)
2. Check network speed
3. Process during off-peak hours

---

### 6.2 Page Becoming Unresponsive

**Symptoms:**
- WB page freezing
- "Page unresponsive" dialog
- Memory warnings

**Actions:**
1. Stop processing (Stop button)
2. Refresh page
3. Reduce batch size
4. Process in smaller batches

---

## 7. Quick Reference: Error → Action

| Error Message | First Action |
|--------------|--------------|
| Таблица не найдена | Wait for page load, check URL |
| Кнопка меню не найдена | Check row structure in DevTools |
| Dropdown не появилось | Try manual click, check React events |
| Кнопка "Пожаловаться" не найдена | Check dropdown text content |
| Модальное окно не появилось | Refresh page, try again |
| Поле для текста не найдено | **Select category first**, then wait |
| Кнопка "Отправить" не найдена | Check form validation |
| NEED_RELOAD | Refresh WB page |
| Content script not ready | Reload extension, refresh page |
| 401 Unauthorized | Check/update token |
| 429 Rate Limited | Wait and retry |
| WB tab not found | Open feedbacks page |

---

## 8. Getting Help

If issue persists:

1. **Collect information:**
   - Browser console errors (full text)
   - Network tab (failed requests)
   - Steps to reproduce
   - WB page state (screenshot)

2. **Check documentation:**
   - `docs/DOM_CONTRACT.md` - UI structure
   - `docs/SELECTORS.md` - Selector details
   - `docs/WORKFLOWS.md` - Process flow

3. **Run diagnostics:**
   - Test 1: DOM check
   - Test 2: Navigation check
   - Test 3: API integration

4. **Report issue:**
   - Include all collected information
   - Specify when issue started
   - Note any recent WB UI changes
