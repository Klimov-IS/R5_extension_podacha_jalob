# Cloud.md — Rating5 Complaints Extension (WB / Valdris UI)

> Purpose: This file instructs Cloud Code how to work inside this repo: how to plan changes, where to edit, how to test, and what must be updated (docs, selectors, git) on every change.

---

## 0) Project snapshot (what this repo is)

This repo is a **Chrome Extension (Manifest V3)** that automates complaint submission on **Wildberries reviews page (Valdris UI)** and syncs statuses to a backend API.

Key facts (from README):
- MV3 extension, uses **service worker + content scripts**
- Main flow: **Get complaints → Find matching review on page → Open complaint modal → Submit → Sync statuses**
- UI entrypoint/diagnostics: `diagnostic.html`
- Core handler on the page: `window.OptimizedHandler` (main world)
- Safety: per-run cap ~**300** complaints (configurable) and status sync endpoints
- Backend API base (current): `https://rating5.ru` (see `src/services/settings.js` and sync handlers)

---

## 1) Workstyle and output format (mandatory)

Every response must include:

1) **Plan (3–8 steps)**  
2) **Files to change** (exact paths)  
3) **Commands to run** (each command + expected result)  
4) **Test checklist** (what to verify in Chrome / Valdris UI)  
5) **Risks & edge cases** (UI changes, rate-limits, retries, idempotency)  
6) **Docs to update** (explicit list)  
7) **Git actions** (commit message suggestion)

**Commands**: only provide commands **with a short explanation and expected outcome**.

Avoid long “example code walls”. Provide only necessary diffs/snippets.

---

## 2) Repo map (where things live)

Use this to decide where to implement changes.

- `src/background/`  
  Service worker logic, API calls, routing between extension and content scripts.

- `src/contents/complaints/`  
  Main complaint automation modules.

- `src/contents/complaints/dom/`  
  DOM / UI interaction: selectors, element finding, reading review cards, clicking UI.

- `src/services/`  
  Shared services: settings, API client, status sync.

- `diagnostic.html`  
  Diagnostic entrypoint / manual run helper.

If unsure where to place code:
- **UI/DOM →** `src/contents/complaints/dom/`
- **Business flow / orchestration →** `src/contents/complaints/services/`
- **Backend sync / HTTP →** `src/services/` or background handlers

---

## 3) Valdris/WB UI strategy (critical rule)

The Valdris/WB interface changes often. To keep maintenance cheap:

### 3.1 “Selectors are data”
Do NOT hardcode CSS selectors inside random handlers/services.

Selectors must be centralized in one place (preferred):
- `src/contents/complaints/dom/selectors.catalog.json` (or `.ts/.js` if already exists)

DOM utilities must read from that catalog.

### 3.2 DOM Contract
There must be a documented “page model” of the reviews page:
- `docs/DOM_CONTRACT.md`

When you touch any UI logic:
- update `selectors.catalog.*`
- update `docs/DOM_CONTRACT.md`
- add an entry in `docs/UI_CHANGELOG.md`

### 3.3 Locator priority order
When choosing locators, prefer:
1) stable `data-testid` / `data-*`
2) ARIA role/label/text
3) stable DOM structure anchors (headers/containers)
4) fragile selectors (`nth-child`, deep nesting) — last resort

### 3.4 Fallback strategy requirement
For each critical UI element (review card, “complain” button, modal submit):
- define a primary locator
- define at least one fallback locator where possible
- log a clear error when neither matches

---

## 4) Documentation update policy (mandatory)

**Any code change must include documentation updates when applicable.**

### 4.1 What must be updated, when
- If API endpoints / payloads / auth / baseURL changes:
  - update `docs/BACKEND_API.md`
  - update relevant workflow doc: `docs/WORKFLOWS.md`
- If UI selectors / DOM extraction changes:
  - update `docs/DOM_CONTRACT.md`
  - update `docs/SELECTORS.md` (if present)
  - update `docs/UI_CHANGELOG.md`
- If flow changes (new steps / new statuses / new limits):
  - update `docs/WORKFLOWS.md`
- If build/run steps change:
  - update `docs/SETUP_DEV.md`
- If new common failure modes appear:
  - update `docs/TROUBLESHOOTING.md`
- If architecture changes (new modules, new message routes):
  - update `docs/ARCHITECTURE.md`

### 4.2 “Docs done” definition
A change is not considered complete until:
- relevant docs are updated
- docs reflect the **new reality** (not aspirational)
- updated docs mention any new env/config values, limits, assumptions

---

## 5) Git policy (mandatory)

After implementing and testing changes:

1) **Run build**
2) **Smoke test in Chrome**
3) **Commit**
4) **Push to Git**

No “local-only” finished work.

### 5.1 Commit format
Use concise commits, one logical change per commit when possible.

Suggested pattern:
- `fix(ui): update WB review card selectors`
- `feat(sync): add retry/backoff for status sync`
- `docs(api): update review-statuses payload`
- `chore(build): update build pipeline`

---

## 6) Safety, correctness, and idempotency

### 6.1 Idempotency
Any action that can be retried must be safe:
- repeated runs must not create duplicate “sent” statuses
- status sync should be robust to partial failure
- ensure stable identifiers (reviewId / complaintId) are used where possible

### 6.2 Rate limits / run limits
Respect per-run cap (e.g. 300). Do not increase without:
- updating docs (`WORKFLOWS.md`)
- explaining the risk (UI throttling, bans, performance)

### 6.3 Logging requirements
All critical steps must log:
- start/end of run (runId if available)
- complaint count
- selector/path used when element found
- clear error when element not found (which locator failed)

---

## 7) Stop conditions (must pause and ask)

Stop and ask the user (do NOT guess) if:

1) A change requires modifying backend API contract without confirmed specs
2) You cannot uniquely identify required UI elements (need DOM snippet/screenshot)
3) The change affects money-risky actions (mass actions, limits, account safety)
4) You need secrets/tokens/credentials
5) You must change permissions in `manifest.json` significantly
6) You are uncertain about which page variant is targeted (A/B UI, locale differences)

When stopping, provide:
- what you tried
- what is ambiguous
- what exact info is needed (smallest request)

---

## 8) Standard implementation workflow (checklist)

For every task:

1) Read current code paths related to the task
2) Identify whether change is:
   - UI/DOM
   - flow/business logic
   - backend sync/API
   - build/release
3) Implement change in correct layer (DOM vs service vs background)
4) Update docs (per policy)
5) Run build
6) Smoke test on Valdris/WB page
7) Commit + push

---

## 9) Test checklist (minimum)

After changes, perform a smoke test:

### 9.1 Build
- `npm install` (if needed)
- `npm run build` (or repo’s build command)

Expected:
- build succeeds
- output artifacts generated
- no TypeScript/bundler errors

### 9.2 Chrome extension reload
- Load unpacked extension / reload it
- Open Valdris/WB reviews page

Expected:
- content script loads
- no runtime errors in console
- `diagnostic.html` opens and can run

### 9.3 Complaint flow
Run a small test batch (1–3 complaints):
- review is found
- complaint modal opens
- submit completes
- status sync updates in backend (if reachable)

Expected:
- clear logs
- no stuck loops
- errors are actionable if UI changed

---

## 10) Minimal glossary (use consistent terms)

- **Valdris UI**: WB interface where reviews are shown and actions are taken
- **Review card**: one review item on the page
- **Complaint**: action submitted via UI flow
- **Status Sync**: sending processed results back to backend
- **Selector Catalog**: centralized locator definitions
- **DOM Contract**: documented page model and required elements

---

## 11) Required docs set (target)

These should exist under `docs/` (create if missing):
- `docs/ARCHITECTURE.md`
- `docs/WORKFLOWS.md`
- `docs/BACKEND_API.md`
- `docs/SETUP_DEV.md`
- `docs/TROUBLESHOOTING.md`
- `docs/DOM_CONTRACT.md`
- `docs/SELECTORS.md` (optional but recommended)
- `docs/UI_CHANGELOG.md`
- `docs/adr/` (optional, recommended)

If a task touches an area, ensure corresponding doc is updated.

---

## 12) Non-negotiables (summary)

- UI changes → update selectors catalog + DOM contract + UI changelog
- API changes → update BACKEND_API + workflows
- Always build + smoke test after changes
- Always commit + push after successful test
- Do not guess when UI is ambiguous — stop and request evidence (DOM/screenshot)

---