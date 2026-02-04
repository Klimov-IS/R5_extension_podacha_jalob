# Phase 1 Integration Plan - Backend API Integration

**Project:** WB Reports Chrome Extension v1.3.0
**Date:** 28 января 2026
**Status:** 🟡 In Progress
**Duration:** Week 1-2

---

## Executive Summary

This document outlines the detailed plan for integrating the newly deployed Backend API (http://158.160.217.236) into the Chrome Extension. Backend team has successfully delivered all required endpoints with 9.5/10 rating.

**Goal:** Replace pilot-entry.ru API calls with new Backend API while maintaining all existing functionality.

---

## Phase 1 Overview

### Timeline
- **Duration:** 1-2 weeks
- **Start Date:** 28 января 2026
- **Target Completion:** 10 февраля 2026

### Success Criteria
- ✅ Extension successfully fetches complaints from new API
- ✅ Extension successfully marks complaints as sent via new API
- ✅ Date format conversion working (ISO 8601 → DD.MM.YYYY)
- ✅ Bearer Token authentication working
- ✅ Rate limiting handled properly
- ✅ Error handling updated for new error codes
- ✅ Settings UI updated for new configuration
- ✅ All existing functionality preserved

---

## Backend API Configuration

### Production Endpoint
```
Base URL: http://158.160.217.236
```

### Test Credentials
```javascript
const TEST_CONFIG = {
  token: 'd794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038',
  storeId: 'ss6Y8orHTX6vS7SgJl4k'
};
```

### Available Endpoints
1. `GET /api/stores/:storeId/complaints?skip=0&take=100`
2. `POST /api/stores/:storeId/reviews/:reviewId/complaint/sent`

---

## Integration Tasks Breakdown

### Task 1: Add Utility Functions (Priority: HIGH)

**File:** `src/utils/api-helpers.js` (new file)

**Functions to implement:**

1. **parseComplaintText(text)**
   - Extracts JSON from markdown code block
   - Input: `"```json\n{...}\n```"`
   - Output: `{reasonId, reasonName, complaintText}`

2. **formatDateForWB(isoDate)**
   - Converts ISO 8601 to DD.MM.YYYY format
   - Input: `"2026-01-23T08:38:44.000Z"`
   - Output: `"23.01.2026"`

3. **generateReviewKey(complaint)**
   - Creates composite key for review identification
   - Format: `{productId}_{rating}_{reviewDate}`
   - Example: `"187489568_1_23.01.2026"`

**Code Template:**
```javascript
/**
 * Parses complaint text from markdown-wrapped JSON format
 * @param {string} text - Complaint text in format: ```json\n{...}\n```
 * @returns {Object|null} - Parsed complaint object or null
 */
export function parseComplaintText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    // Extract JSON from markdown code block
    const match = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!match || !match[1]) {
      console.warn('No JSON block found in complaint text');
      return null;
    }

    const parsed = JSON.parse(match[1]);

    // Validate required fields
    if (!parsed.reasonId || !parsed.complaintText) {
      console.warn('Missing required fields in complaint JSON');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse complaint text:', error);
    return null;
  }
}

/**
 * Converts ISO 8601 date to DD.MM.YYYY format for WB
 * @param {string} isoDate - ISO 8601 date string
 * @returns {string} - Date in DD.MM.YYYY format
 */
export function formatDateForWB(isoDate) {
  if (!isoDate) {
    return '';
  }

  try {
    const date = new Date(isoDate);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', isoDate);
      return '';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  } catch (error) {
    console.error('Failed to format date:', error);
    return '';
  }
}

/**
 * Generates composite review key for identification on WB page
 * @param {Object} complaint - Complaint object
 * @returns {string} - Review key in format: productId_rating_reviewDate
 */
export function generateReviewKey(complaint) {
  const { productId, rating, reviewDate } = complaint;

  if (!productId || !rating || !reviewDate) {
    console.warn('Missing required fields for review key:', complaint);
    return null;
  }

  // Convert ISO date to DD.MM.YYYY
  const formattedDate = formatDateForWB(reviewDate);

  return `${productId}_${rating}_${formattedDate}`;
}
```

**Testing:**
```javascript
// Test cases
console.log(parseComplaintText('```json\n{"reasonId":"11","complaintText":"test"}\n```'));
// Expected: {reasonId: "11", complaintText: "test"}

console.log(formatDateForWB('2026-01-23T08:38:44.000Z'));
// Expected: "23.01.2026"

console.log(generateReviewKey({
  productId: '187489568',
  rating: 1,
  reviewDate: '2026-01-23T08:38:44.000Z'
}));
// Expected: "187489568_1_23.01.2026"
```

---

### Task 2: Update API Client (Priority: HIGH)

**File:** `src/api/pilot-api.js`

**Changes Required:**

1. **Update baseURL configuration**
   - Old: `https://pilot-entry.ru`
   - New: `http://158.160.217.236`

2. **Update endpoint paths**
   - Old: `/stores/${storeId}/complaints`
   - New: `/api/stores/${storeId}/complaints`

3. **Add Store ID management**
   - Store ID is now required in all requests
   - Add methods to get/set Store ID from settings

4. **Update response handling**
   - Handle new data format (ISO 8601 dates)
   - Parse complaintText using new utility function

**Code Changes:**

```javascript
// src/api/pilot-api.js

import { parseComplaintText, formatDateForWB, generateReviewKey } from '../utils/api-helpers.js';

class PilotAPI {
  constructor() {
    this.baseURL = null;
    this.token = null;
    this.storeId = null;
  }

  /**
   * Initialize API client with settings
   */
  async initialize() {
    this.baseURL = await settingsService.getBackendEndpoint();
    this.token = await settingsService.getBackendToken();
    this.storeId = await settingsService.getBackendStoreId();

    if (!this.baseURL || !this.token || !this.storeId) {
      throw new Error('API client not configured. Please set Backend URL, Token, and Store ID in settings.');
    }
  }

  /**
   * Get complaints from backend
   * @param {Object} options - Pagination options
   * @returns {Promise<Array>} - Array of complaint objects
   */
  async getComplaints({ skip = 0, take = 100 } = {}) {
    await this.initialize();

    const url = `${this.baseURL}/api/stores/${this.storeId}/complaints?skip=${skip}&take=${take}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Check rate limit headers
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining && parseInt(remaining) < 10) {
      console.warn(`Rate limit warning: ${remaining} requests remaining`);
    }

    const complaints = await response.json();

    // Transform data: parse complaintText and generate review keys
    return complaints.map(complaint => {
      const parsedComplaint = parseComplaintText(complaint.complaintText);

      return {
        ...complaint,
        // Add formatted date for WB
        reviewDateFormatted: formatDateForWB(complaint.reviewDate),
        // Add parsed complaint data
        complaintData: parsedComplaint,
        // Add review key for identification
        reviewKey: generateReviewKey(complaint)
      };
    });
  }

  /**
   * Mark complaint as sent
   * @param {string} reviewId - Review ID
   * @param {Object} metadata - Additional metadata (sentAt, duration)
   * @returns {Promise<Object>} - Response from backend
   */
  async markComplaintAsSent(reviewId, metadata = {}) {
    await this.initialize();

    const url = `${this.baseURL}/api/stores/${this.storeId}/reviews/${reviewId}/complaint/sent`;

    const body = {
      sentAt: metadata.sentAt || new Date().toISOString(),
      duration: metadata.duration || 0
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      // Handle specific error codes
      if (response.status === 409 && error.code === 'ALREADY_SENT') {
        console.warn(`Complaint ${reviewId} already marked as sent (idempotent operation)`);
        return { success: true, message: 'Already sent', duplicate: true };
      }

      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Health check
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    const baseURL = await settingsService.getBackendEndpoint();

    if (!baseURL) {
      throw new Error('Backend URL not configured');
    }

    const url = `${baseURL}/api/health`;

    const response = await fetch(url, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  }
}

export const pilotAPI = new PilotAPI();
```

---

### Task 3: Update Settings Service (Priority: HIGH)

**File:** `src/services/settings-service.js`

**New Settings Required:**
1. Backend Endpoint URL
2. Backend Token
3. Backend Store ID

**Code Changes:**

```javascript
// src/services/settings-service.js

class SettingsService {
  // Existing settings keys
  static KEYS = {
    PILOT_ENDPOINT: 'pilotEndpoint',
    PILOT_TOKEN: 'pilotToken',
    // New backend settings
    BACKEND_ENDPOINT: 'backendEndpoint',
    BACKEND_TOKEN: 'backendToken',
    BACKEND_STORE_ID: 'backendStoreId',
    // ... other keys
  };

  // Default values
  static DEFAULTS = {
    [SettingsService.KEYS.BACKEND_ENDPOINT]: 'http://158.160.217.236',
    [SettingsService.KEYS.BACKEND_TOKEN]: '',
    [SettingsService.KEYS.BACKEND_STORE_ID]: ''
  };

  /**
   * Get Backend API endpoint
   * @returns {Promise<string>}
   */
  async getBackendEndpoint() {
    return await this.get(
      SettingsService.KEYS.BACKEND_ENDPOINT,
      SettingsService.DEFAULTS[SettingsService.KEYS.BACKEND_ENDPOINT]
    );
  }

  /**
   * Set Backend API endpoint
   * @param {string} endpoint
   */
  async setBackendEndpoint(endpoint) {
    return await this.set(SettingsService.KEYS.BACKEND_ENDPOINT, endpoint);
  }

  /**
   * Get Backend API token
   * @returns {Promise<string>}
   */
  async getBackendToken() {
    return await this.get(
      SettingsService.KEYS.BACKEND_TOKEN,
      SettingsService.DEFAULTS[SettingsService.KEYS.BACKEND_TOKEN]
    );
  }

  /**
   * Set Backend API token
   * @param {string} token
   */
  async setBackendToken(token) {
    return await this.set(SettingsService.KEYS.BACKEND_TOKEN, token);
  }

  /**
   * Get Backend Store ID
   * @returns {Promise<string>}
   */
  async getBackendStoreId() {
    return await this.get(
      SettingsService.KEYS.BACKEND_STORE_ID,
      SettingsService.DEFAULTS[SettingsService.KEYS.BACKEND_STORE_ID]
    );
  }

  /**
   * Set Backend Store ID
   * @param {string} storeId
   */
  async setBackendStoreId(storeId) {
    return await this.set(SettingsService.KEYS.BACKEND_STORE_ID, storeId);
  }

  /**
   * Validate backend configuration
   * @returns {Promise<Object>} - {valid: boolean, errors: string[]}
   */
  async validateBackendConfig() {
    const errors = [];

    const endpoint = await this.getBackendEndpoint();
    const token = await this.getBackendToken();
    const storeId = await this.getBackendStoreId();

    if (!endpoint) {
      errors.push('Backend URL not configured');
    } else if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      errors.push('Backend URL must start with http:// or https://');
    }

    if (!token) {
      errors.push('Backend Token not configured');
    } else if (token.length < 32) {
      errors.push('Backend Token must be at least 32 characters');
    }

    if (!storeId) {
      errors.push('Store ID not configured');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const settingsService = new SettingsService();
```

---

### Task 4: Update Settings UI (Priority: MEDIUM)

**File:** `options.html`

**Add New Configuration Section:**

```html
<!-- Backend API Configuration -->
<div class="settings-section">
  <h2>🔧 Backend API Configuration</h2>
  <p class="section-description">Configure connection to Backend API for complaints processing</p>

  <div class="setting-item">
    <label for="backendEndpoint">Backend URL:</label>
    <input
      type="text"
      id="backendEndpoint"
      placeholder="http://158.160.217.236"
      class="setting-input"
    />
    <p class="setting-hint">Production Backend API URL (provided by backend team)</p>
  </div>

  <div class="setting-item">
    <label for="backendToken">Backend Token:</label>
    <input
      type="password"
      id="backendToken"
      placeholder="Enter your Backend API token"
      class="setting-input"
    />
    <button type="button" id="toggleBackendToken" class="btn-secondary">Show</button>
    <p class="setting-hint">Bearer token for authentication (minimum 32 characters)</p>
  </div>

  <div class="setting-item">
    <label for="backendStoreId">Store ID:</label>
    <input
      type="text"
      id="backendStoreId"
      placeholder="ss6Y8orHTX6vS7SgJl4k"
      class="setting-input"
    />
    <p class="setting-hint">Your store ID (provided by backend team)</p>
  </div>

  <div class="setting-actions">
    <button type="button" id="testBackendConnection" class="btn-primary">
      Test Connection
    </button>
    <span id="backendConnectionStatus" class="connection-status"></span>
  </div>
</div>
```

**File:** `src/options/options.js`

**Add Event Handlers:**

```javascript
// Load backend settings
async function loadBackendSettings() {
  const endpoint = await settingsService.getBackendEndpoint();
  const token = await settingsService.getBackendToken();
  const storeId = await settingsService.getBackendStoreId();

  document.getElementById('backendEndpoint').value = endpoint || '';
  document.getElementById('backendToken').value = token || '';
  document.getElementById('backendStoreId').value = storeId || '';
}

// Save backend settings
async function saveBackendSettings() {
  const endpoint = document.getElementById('backendEndpoint').value.trim();
  const token = document.getElementById('backendToken').value.trim();
  const storeId = document.getElementById('backendStoreId').value.trim();

  await settingsService.setBackendEndpoint(endpoint);
  await settingsService.setBackendToken(token);
  await settingsService.setBackendStoreId(storeId);

  // Validate configuration
  const validation = await settingsService.validateBackendConfig();

  if (!validation.valid) {
    showNotification(`Configuration errors: ${validation.errors.join(', ')}`, 'error');
  } else {
    showNotification('Backend settings saved successfully', 'success');
  }
}

// Test backend connection
async function testBackendConnection() {
  const statusEl = document.getElementById('backendConnectionStatus');
  statusEl.textContent = 'Testing...';
  statusEl.className = 'connection-status testing';

  try {
    // First validate configuration
    const validation = await settingsService.validateBackendConfig();

    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    // Test health endpoint
    const health = await pilotAPI.healthCheck();

    statusEl.textContent = `✅ Connected (v${health.version || 'unknown'})`;
    statusEl.className = 'connection-status success';

    // Test complaints endpoint
    const complaints = await pilotAPI.getComplaints({ take: 1 });

    console.log('Connection test successful:', { health, complaintsCount: complaints.length });

  } catch (error) {
    statusEl.textContent = `❌ Failed: ${error.message}`;
    statusEl.className = 'connection-status error';
    console.error('Backend connection test failed:', error);
  }
}

// Event listeners
document.getElementById('testBackendConnection').addEventListener('click', testBackendConnection);
document.getElementById('toggleBackendToken').addEventListener('click', () => {
  const tokenInput = document.getElementById('backendToken');
  const toggleBtn = document.getElementById('toggleBackendToken');

  if (tokenInput.type === 'password') {
    tokenInput.type = 'text';
    toggleBtn.textContent = 'Hide';
  } else {
    tokenInput.type = 'password';
    toggleBtn.textContent = 'Show';
  }
});
```

---

### Task 5: Update Content Script - Complaints Handler (Priority: HIGH)

**File:** `src/contents/complaints/complaints-handler.js`

**Key Changes:**

1. Use new `reviewKey` format for finding reviews
2. Handle new date format
3. Use parsed `complaintData` from API response

**Code Changes:**

```javascript
// src/contents/complaints/complaints-handler.js

import { generateReviewKey } from '../../utils/api-helpers.js';

class ComplaintsHandler {
  /**
   * Find review element on WB page by composite key
   * @param {Object} complaint - Complaint object from API
   * @returns {Element|null} - Review DOM element
   */
  findReviewElement(complaint) {
    // Use pre-generated review key
    const reviewKey = complaint.reviewKey || generateReviewKey(complaint);

    if (!reviewKey) {
      console.error('Cannot generate review key for complaint:', complaint);
      return null;
    }

    console.log('Searching for review with key:', reviewKey);

    // Find all review elements on page
    const reviewElements = document.querySelectorAll('[data-review-id], .comments__item, .feedback__item');

    for (const element of reviewElements) {
      // Extract productId, rating, and date from review element
      const productId = this.extractProductId(element);
      const rating = this.extractRating(element);
      const reviewDate = this.extractReviewDate(element);

      if (!productId || !rating || !reviewDate) {
        continue;
      }

      // Generate key from page element
      const pageKey = `${productId}_${rating}_${reviewDate}`;

      if (pageKey === reviewKey) {
        console.log('Found matching review element:', { reviewKey, element });
        return element;
      }
    }

    console.warn('Review not found on page:', reviewKey);
    return null;
  }

  /**
   * Extract review date from element (expects DD.MM.YYYY format on page)
   * @param {Element} element
   * @returns {string|null} - Date in DD.MM.YYYY format
   */
  extractReviewDate(element) {
    // WB typically shows dates as "18 января 2026" or "18.01.2026"
    const dateElement = element.querySelector('.feedback__date, .review-date, [data-date]');

    if (!dateElement) {
      return null;
    }

    const dateText = dateElement.textContent.trim();

    // Check if already in DD.MM.YYYY format
    const dateMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (dateMatch) {
      return dateText;
    }

    // Parse Russian month format "18 января 2026"
    const russianDate = this.parseRussianDate(dateText);
    if (russianDate) {
      return russianDate;
    }

    return null;
  }

  /**
   * Parse Russian date format "18 января 2026" to DD.MM.YYYY
   * @param {string} dateText
   * @returns {string|null}
   */
  parseRussianDate(dateText) {
    const months = {
      'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
      'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
      'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
    };

    const match = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (!match) {
      return null;
    }

    const day = match[1].padStart(2, '0');
    const month = months[match[2].toLowerCase()];
    const year = match[3];

    if (!month) {
      return null;
    }

    return `${day}.${month}.${year}`;
  }

  /**
   * Submit complaint for a review
   * @param {Object} complaint - Complaint object from API
   * @returns {Promise<Object>} - Result
   */
  async submitComplaint(complaint) {
    const startTime = Date.now();

    try {
      // Find review element
      const reviewElement = this.findReviewElement(complaint);

      if (!reviewElement) {
        throw new Error('Review not found on page');
      }

      // Use parsed complaint data from API
      const { complaintData } = complaint;

      if (!complaintData) {
        throw new Error('Complaint data not parsed');
      }

      const { reasonId, complaintText } = complaintData;

      // Click complaint button
      const complaintButton = reviewElement.querySelector('.feedback__complaint, [data-complaint-button]');
      if (!complaintButton) {
        throw new Error('Complaint button not found');
      }

      complaintButton.click();
      await this.sleep(500);

      // Fill complaint form
      await this.fillComplaintForm(reasonId, complaintText);

      // Submit form
      await this.submitComplaintForm();

      const duration = (Date.now() - startTime) / 1000;

      return {
        success: true,
        reviewId: complaint.id,
        duration
      };

    } catch (error) {
      console.error('Failed to submit complaint:', error);
      return {
        success: false,
        reviewId: complaint.id,
        error: error.message,
        duration: (Date.now() - startTime) / 1000
      };
    }
  }

  // ... other methods remain the same
}

export const complaintsHandler = new ComplaintsHandler();
```

---

### Task 6: Update Error Handling (Priority: MEDIUM)

**File:** `src/utils/error-handler.js`

**New Error Codes:**

```javascript
export const ERROR_CODES = {
  // Backend API errors
  AUTH_FAILED: 'AUTH_FAILED',           // 401
  STORE_NOT_FOUND: 'STORE_NOT_FOUND',   // 404
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND', // 404
  ALREADY_SENT: 'ALREADY_SENT',         // 409
  RATE_LIMIT: 'RATE_LIMIT',             // 429

  // Client errors
  CONFIG_ERROR: 'CONFIG_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',

  // WB page errors
  REVIEW_NOT_ON_PAGE: 'REVIEW_NOT_ON_PAGE',
  FORM_ERROR: 'FORM_ERROR'
};

export const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_FAILED]: 'Authentication failed. Please check your Backend Token in settings.',
  [ERROR_CODES.STORE_NOT_FOUND]: 'Store not found. Please check your Store ID in settings.',
  [ERROR_CODES.REVIEW_NOT_FOUND]: 'Review not found in database.',
  [ERROR_CODES.ALREADY_SENT]: 'Complaint already submitted.',
  [ERROR_CODES.RATE_LIMIT]: 'Rate limit exceeded. Please wait before making more requests.',
  [ERROR_CODES.CONFIG_ERROR]: 'Configuration error. Please check settings.',
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection.',
  [ERROR_CODES.REVIEW_NOT_ON_PAGE]: 'Review not found on current WB page.',
  [ERROR_CODES.FORM_ERROR]: 'Failed to fill complaint form on WB page.'
};

/**
 * Handle API errors
 * @param {Error} error
 * @param {Response} response
 * @returns {Object} - Normalized error object
 */
export function handleAPIError(error, response = null) {
  let errorCode = ERROR_CODES.NETWORK_ERROR;
  let errorMessage = error.message;

  if (response) {
    switch (response.status) {
      case 401:
        errorCode = ERROR_CODES.AUTH_FAILED;
        errorMessage = ERROR_MESSAGES[errorCode];
        break;
      case 404:
        errorCode = ERROR_CODES.STORE_NOT_FOUND;
        errorMessage = ERROR_MESSAGES[errorCode];
        break;
      case 409:
        errorCode = ERROR_CODES.ALREADY_SENT;
        errorMessage = ERROR_MESSAGES[errorCode];
        break;
      case 429:
        errorCode = ERROR_CODES.RATE_LIMIT;
        errorMessage = ERROR_MESSAGES[errorCode];
        break;
      default:
        errorMessage = `HTTP ${response.status}: ${error.message}`;
    }
  }

  return {
    code: errorCode,
    message: errorMessage,
    originalError: error,
    status: response?.status
  };
}
```

---

## Testing Plan

### Unit Tests

1. **Utility Functions**
   - [ ] Test `parseComplaintText()` with valid markdown
   - [ ] Test `parseComplaintText()` with invalid input
   - [ ] Test `formatDateForWB()` with various ISO dates
   - [ ] Test `formatDateForWB()` with invalid dates
   - [ ] Test `generateReviewKey()` with complete data
   - [ ] Test `generateReviewKey()` with missing fields

2. **API Client**
   - [ ] Test `getComplaints()` with valid credentials
   - [ ] Test `getComplaints()` with invalid token (401)
   - [ ] Test `markComplaintAsSent()` success
   - [ ] Test `markComplaintAsSent()` idempotency (409)
   - [ ] Test rate limit header handling

3. **Settings Service**
   - [ ] Test save/load backend settings
   - [ ] Test `validateBackendConfig()` with valid config
   - [ ] Test `validateBackendConfig()` with invalid config

### Integration Tests

1. **End-to-End Flow**
   - [ ] Configure extension with test credentials
   - [ ] Fetch complaints from backend
   - [ ] Verify data transformation (dates, keys, parsed text)
   - [ ] Submit complaint on WB page
   - [ ] Mark complaint as sent in backend
   - [ ] Verify complaint no longer returned by API

2. **Error Scenarios**
   - [ ] Invalid token → show auth error
   - [ ] Missing Store ID → show config error
   - [ ] Rate limit exceeded → show rate limit warning
   - [ ] Review not found on page → skip and continue

### Manual Testing Checklist

- [ ] Install extension with test credentials
- [ ] Open Settings page and verify new fields visible
- [ ] Click "Test Connection" button → should show success
- [ ] Navigate to WB page with reviews
- [ ] Click "Fetch Complaints" → should fetch from new API
- [ ] Click "Submit Complaints" → should submit and mark as sent
- [ ] Refresh complaints → submitted ones should not reappear
- [ ] Check console for errors
- [ ] Verify rate limit warnings appear when < 10 requests remaining

---

## Migration Strategy

### Option A: Gradual Migration (Recommended)

1. **Week 1:**
   - Add new backend settings (parallel to old ones)
   - Users can test new API without breaking current flow
   - Monitor errors and feedback

2. **Week 2:**
   - Make new backend default for new users
   - Migrate existing users gradually
   - Keep old pilot-entry.ru as fallback

3. **Week 3:**
   - Deprecate old API
   - Remove pilot-entry.ru code

### Option B: Hard Cutover

1. Replace pilot-entry.ru completely
2. All users must update settings
3. Faster but riskier

**Recommendation:** Use Option A (Gradual Migration)

---

## Rollback Plan

If critical issues are found:

1. **Immediate:** Revert src/api/pilot-api.js to previous version
2. **Settings:** Keep old pilot-entry.ru settings available
3. **Communication:** Notify users to switch back to old API in settings
4. **Fix:** Address issues in new API integration
5. **Redeploy:** Test thoroughly before second attempt

---

## Success Metrics

### Performance Metrics
- API response time < 1 second (95th percentile)
- Complaint submission rate > 90%
- Error rate < 5%

### User Experience Metrics
- Configuration success rate > 95%
- User-reported issues < 10 per week
- Positive user feedback

### Technical Metrics
- Rate limit errors < 1%
- Network errors < 2%
- Data parsing errors < 1%

---

## Dependencies

### Backend Team
- ✅ API deployed at http://158.160.217.236
- ✅ Test credentials provided
- ✅ Documentation complete

### Extension Team
- 🟡 Integration in progress
- ⏳ Testing pending
- ⏳ Deployment pending

### External Dependencies
- WB website structure (must remain stable)
- Chrome Extension APIs
- User WB account access

---

## Risk Assessment

### High Risk
- **WB UI changes:** If WB changes review page structure, review identification may break
  - **Mitigation:** Regular monitoring, fallback identification methods

### Medium Risk
- **Rate limiting:** Users with many complaints may hit limits
  - **Mitigation:** Implement request queuing, show rate limit status

### Low Risk
- **Date format issues:** ISO to DD.MM.YYYY conversion
  - **Mitigation:** Comprehensive testing, fallback parsing

---

## Communication Plan

### User Communication
1. **Release Notes:** Document new backend settings requirement
2. **Settings UI:** Clear instructions and test button
3. **Error Messages:** User-friendly error messages with troubleshooting steps

### Team Communication
1. **Daily Updates:** Progress updates in project channel
2. **Blockers:** Immediate escalation if backend issues found
3. **Testing Results:** Share test results with backend team

---

## Timeline

### Week 1 (28 Jan - 3 Feb)
- **Day 1-2:** Implement utility functions and update API client
- **Day 3-4:** Update settings service and UI
- **Day 5:** Unit testing

### Week 2 (4 Feb - 10 Feb)
- **Day 1-2:** Update content scripts and error handling
- **Day 3-4:** Integration testing
- **Day 5:** Bug fixes and final testing

### Week 3 (11 Feb - 17 Feb)
- **Day 1:** Deploy to production
- **Day 2-5:** Monitor, collect feedback, fix issues

---

## Next Steps

1. ✅ Phase 1 plan created
2. 🟡 Begin implementation (Task 1: Utility functions)
3. ⏳ Code review after each task
4. ⏳ Testing after all tasks complete
5. ⏳ Production deployment

---

## Appendix A: Test Data

### Test Credentials
```javascript
const TEST_CONFIG = {
  baseURL: 'http://158.160.217.236',
  token: 'd794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038',
  storeId: 'ss6Y8orHTX6vS7SgJl4k'
};
```

### Sample Complaint Response
```json
{
  "id": "Sqe3RgPnbpJMke3xi0bU",
  "productId": "391988959",
  "rating": 3,
  "reviewDate": "2026-01-23T08:38:44.000Z",
  "reviewText": "Не соответствует размеру",
  "complaintText": "```json\n{\"reasonId\":\"11\",\"reasonName\":\"Недостоверность информации\",\"complaintText\":\"В отзыве указана ложная информация о размере товара.\"}\n```",
  "status": "pending"
}
```

### Expected Transformed Data
```javascript
{
  id: "Sqe3RgPnbpJMke3xi0bU",
  productId: "391988959",
  rating: 3,
  reviewDate: "2026-01-23T08:38:44.000Z",
  reviewDateFormatted: "23.01.2026",  // Added by utility
  reviewKey: "391988959_3_23.01.2026", // Added by utility
  complaintData: {                     // Parsed from complaintText
    reasonId: "11",
    reasonName: "Недостоверность информации",
    complaintText: "В отзыве указана ложная информация о размере товара."
  },
  // ... other fields
}
```

---

## Appendix B: Useful Commands

### Test API Connection
```bash
curl -H "Authorization: Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038" \
  http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/complaints?take=1
```

### Health Check
```bash
curl http://158.160.217.236/api/health
```

### Mark Complaint as Sent
```bash
curl -X POST \
  -H "Authorization: Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038" \
  -H "Content-Type: application/json" \
  -d '{"sentAt":"2026-01-28T17:00:00Z","duration":2.5}' \
  http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/reviews/Sqe3RgPnbpJMke3xi0bU/complaint/sent
```

---

**Document Status:** ✅ Complete and ready for implementation
**Last Updated:** 28 января 2026
**Next Review:** After Week 1 completion
