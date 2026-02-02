# SETUP_DEV.md

## Rating5 Complaints Extension — Development Setup

This document explains how to run and test the extension locally.

---

## 1. Prerequisites

### 1.1 Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or later | JavaScript runtime |
| npm | 9.x or later | Package manager |
| Google Chrome | Latest | Testing environment |
| Git | Latest | Version control |

### 1.2 System Requirements

- Windows 10/11, macOS, or Linux
- 4GB RAM minimum
- Stable internet connection (for WB access)

---

## 2. Installation

### 2.1 Clone Repository

```bash
git clone <repository-url>
cd "R5 подача жалоб"
```

### 2.2 Install Dependencies

```bash
npm install
```

This installs:
- `webpack` - Module bundler
- `webpack-cli` - Webpack command line
- `terser-webpack-plugin` - Code minification
- `eslint` - Code linting
- `prettier` - Code formatting

---

## 3. Build

### 3.1 Production Build

```bash
npm run build
```

**What it does:**
1. Runs webpack in production mode
2. Bundles `src/contents/complaints/main-world-entry.js`
3. Outputs to `dist/content-main-world.bundle.js`
4. Minifies code (keeps console.log)
5. Cleans `dist/` before build

**Expected output:**
```
asset content-main-world.bundle.js xxx KiB
webpack compiled successfully
```

### 3.2 Development Build (Watch Mode)

```bash
npm run build:dev
```

**What it does:**
- Runs webpack in development mode
- Watches for file changes
- Rebuilds automatically on save

### 3.3 Code Quality

```bash
# Lint code
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

---

## 4. Chrome Extension Loading

### 4.1 Open Extensions Page

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)

### 4.2 Load Unpacked Extension

1. Click **Load unpacked**
2. Select the project root folder (containing `manifest.json`)
3. Extension should appear in the list

### 4.3 Verify Installation

- Extension icon appears in Chrome toolbar
- No errors in extension card
- Service worker status: "Active"

### 4.4 Reload After Changes

After code changes:
1. Run `npm run build`
2. Go to `chrome://extensions/`
3. Click **Reload** button (circular arrow) on extension card
4. Refresh any open WB tabs

**Shortcut:** Click extension icon → "Reload" (if available)

---

## 5. Testing

### 5.1 Open Diagnostic Page

1. Build the extension: `npm run build`
2. Load in Chrome (see section 4)
3. Open `diagnostic.html` from extension folder
4. Select a store from dropdown

### 5.2 Test Modes

| Mode | Purpose | Submits? |
|------|---------|----------|
| Test 1 | DOM diagnostics | No |
| Test 2 | Extended diagnostics (pagination) | No |
| Test 3 | API integration test | No |
| Test 4 | **Full test with submission** | **Yes** |

### 5.3 Run Diagnostic Test

1. Open `diagnostic.html`
2. Select store from dropdown
3. Click "Start Test"
4. Review complaints preview
5. Click "Confirm" to proceed
6. Wait for completion
7. Check results

### 5.4 WB Page Requirements

For tests to work:
1. Open `seller.wildberries.ru/feedbacks-questions/feedbacks`
2. Must be logged in
3. Page must be fully loaded
4. Content script must be injected (verify in console)

**Verify content script:**
```javascript
// In WB page console:
window.OptimizedHandler // Should exist
window.ElementFinder    // Should exist
```

---

## 6. Logs and Debugging

### 6.1 Extension Console

**Background (Service Worker):**
1. `chrome://extensions/`
2. Find extension → "Inspect views: Service Worker"
3. Opens DevTools for background script

**Content Script (WB Page):**
1. Open WB page
2. Open DevTools (F12)
3. Console tab shows content script logs

**Diagnostic Page:**
1. Open `diagnostic.html`
2. Open DevTools (F12)
3. Console shows diagnostic logs

### 6.2 Log Prefixes

| Prefix | Source |
|--------|--------|
| `[WBUtils]` | Utility functions |
| `[DataExtractor]` | Data extraction |
| `[ElementFinder]` | Element finding |
| `[ComplaintService]` | Complaint submission |
| `[OptimizedHandler]` | Main orchestration |
| `[NavigationService]` | Page navigation |
| `[ProgressService]` | Progress tracking |
| `[PilotAPI]` | Backend API calls |
| `[StatusSync]` | Status synchronization |

### 6.3 Common Debug Commands

In WB page console:

```javascript
// Check if scripts loaded
console.log('OptimizedHandler:', !!window.OptimizedHandler);
console.log('ElementFinder:', !!window.ElementFinder);
console.log('DataExtractor:', !!window.DataExtractor);

// Run DOM diagnostics
await window.OptimizedHandler.runDiagnostics();

// Test element finding
window.ElementFinder.findReviewsTable();
window.ElementFinder.findMenuButton(row);
window.ElementFinder.findOpenDropdown();

// Extract data from first row
const table = window.ElementFinder.findReviewsTable();
const row = table.querySelector('[class*="table-row"]');
window.DataExtractor.extractReviewData(row, '123456789');
```

---

## 7. Project Structure

```
R5 подача жалоб/
├── manifest.json          # Extension manifest
├── package.json           # NPM configuration
├── webpack.config.js      # Build configuration
├── diagnostic.html        # Diagnostic UI
├── popup.html             # Browser action popup
│
├── dist/                  # Build output (git-ignored)
│   └── content-main-world.bundle.js
│
├── src/
│   ├── background/        # Service Worker
│   ├── contents/          # Content Scripts
│   │   └── complaints/
│   │       ├── dom/       # DOM interaction
│   │       ├── services/  # Business logic
│   │       └── handlers/  # Orchestration
│   ├── services/          # Shared services
│   ├── api/               # API clients
│   ├── config/            # Configuration
│   └── utils/             # Utilities
│
├── docs/                  # Documentation
│
└── styles/                # CSS
```

---

## 8. Environment Variables

Currently no environment variables required. All configuration is hardcoded:

| Setting | Value | Location |
|---------|-------|----------|
| Backend URL | `http://158.160.217.236` | settings-service.js |
| Backend Token | `wbrm_xxx...` | settings-service.js |
| Batch Size | 200 | complaints-config.js |

---

## 9. Common Issues

### 9.1 Build Fails

**Error:** Module not found

**Solution:**
```bash
rm -rf node_modules
npm install
```

### 9.2 Extension Not Loading

**Error:** "Could not load manifest"

**Solution:**
- Check `manifest.json` syntax
- Ensure all paths exist (icons, scripts)

### 9.3 Content Script Not Injecting

**Symptoms:** `window.OptimizedHandler` is undefined

**Solutions:**
1. Reload extension in `chrome://extensions/`
2. Refresh WB page
3. Check manifest `content_scripts` section
4. Verify URL matches `*://seller.wildberries.ru/*`

### 9.4 API Errors

**Error:** 401 Unauthorized

**Solution:**
- Check token in `settings-service.js`
- Verify token is correct

---

## 10. Quick Start Checklist

- [ ] Node.js installed
- [ ] Repository cloned
- [ ] `npm install` completed
- [ ] `npm run build` successful
- [ ] Extension loaded in Chrome
- [ ] `diagnostic.html` opens without errors
- [ ] Store dropdown populated
- [ ] WB page opens and loads
- [ ] Test 1 (diagnostics) passes

---

## 11. Useful Commands

```bash
# Full rebuild
rm -rf dist && npm run build

# Watch mode for development
npm run build:dev

# Check code quality
npm run lint && npm run format:check

# Fix code style
npm run lint:fix && npm run format
```
