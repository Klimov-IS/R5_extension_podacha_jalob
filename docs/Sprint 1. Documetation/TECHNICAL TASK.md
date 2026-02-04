# TECHNICAL TASK
## Documentation Program for Rating5 Complaints Extension (WB / Valdris)

---

## 0. Goal of this task

Create a **complete, maintainable documentation system** for the Rating5 Chrome Extension
that automates complaint submission on Wildberries (Valdris UI).

The documentation must:
- allow Cloud Code and developers to work predictably
- reduce risks caused by frequent Valdris UI changes
- clearly separate DOM/UI knowledge from business logic
- enforce documentation updates as part of development workflow
- support long-term scaling and onboarding

This task is focused **only on documentation**, not on changing product logic.

---

## 1. Global requirements (apply to all tasks)

### 1.1 Format
- All documents must be written in **Markdown (.md)**
- Language: **English** (technical, neutral)
- No placeholders like “TBD” unless explicitly allowed

### 1.2 Consistency
- Terminology must be consistent across all documents
- If a term is introduced, it must match the glossary defined later

### 1.3 Reality-first rule
Documentation must describe **how the system actually works**, not how it “should work”.

### 1.4 Update discipline (CRITICAL)
If any document describes:
- API → it must match real endpoints and payloads
- UI → it must match current Valdris/WB behavior
- limits → they must match real code behavior

---

## 2. Documentation scope (what must be created)

The documentation set consists of the following blocks:

1. Architecture & system overview
2. Business workflows
3. Backend API contracts
4. Valdris/WB UI & DOM contract
5. Selectors & UI stability layer
6. Development & run instructions
7. Troubleshooting & failure modes
8. Change tracking (UI & logic evolution)

Each block is implemented as a **separate task** below.

---

## TASK 1 — ARCHITECTURE.md

### Goal
Explain **how the extension is structured** and how components interact.

### Why this document is required
- Cloud Code must know *where* to implement changes
- Prevents mixing DOM logic, business logic, and backend sync
- Enables faster debugging and onboarding

### Document to create
`docs/ARCHITECTURE.md`

### Must describe
- Chrome Extension type (Manifest V3)
- High-level system diagram (textual)
- Components:
  - Service Worker (background)
  - Content Scripts (isolated vs main world)
  - DOM interaction layer
  - Backend sync layer
  - Diagnostic UI (`diagnostic.html`)
- Message flow:
  - UI → content script → background → backend
- Where key responsibilities live in repo

### Acceptance criteria
- A new developer can answer:  
  “Where do I change UI logic?”  
  “Where do I change API sync?”  
  “Where does orchestration happen?”

---

## TASK 2 — WORKFLOWS.md

### Goal
Document **what the extension actually does step-by-step**.

### Why this document is required
- Prevents logic regressions
- Makes behavior explicit before refactoring
- Allows Cloud Code to reason about side effects

### Document to create
`docs/WORKFLOWS.md`

### Must include workflows
1. Complaint submission workflow
2. Status synchronization workflow
3. Diagnostic/manual run workflow
4. Error handling & retry behavior

### Each workflow must describe
- Entry point
- Step-by-step sequence
- Decision points
- Exit conditions
- Failure scenarios

### Acceptance criteria
- A reader can replay the workflow mentally
- Edge cases are explicitly mentioned

---

## TASK 3 — BACKEND_API.md

### Goal
Define a **clear, authoritative contract** between extension and backend.

### Why this document is required
- Prevents silent API drift
- Allows safe backend or frontend refactors
- Required for idempotency and retries

### Document to create
`docs/BACKEND_API.md`

### Must describe
- Base API URL
- Authentication method (current + assumptions)
- All endpoints used by the extension
- Request payloads (fields, types, meaning)
- Response formats
- Error codes and expected behavior
- Retry and timeout expectations

### Acceptance criteria
- Backend and extension teams could work independently
- Payload examples match real code usage

---

## TASK 4 — DOM_CONTRACT.md (CRITICAL)

### Goal
Create a **formal contract** describing the Valdris/WB Reviews page
as seen by the extension.

### Why this document is required
Valdris UI changes frequently.
Without a DOM contract:
- selectors rot
- logic breaks silently
- fixes become reactive and expensive

### Document to create
`docs/DOM_CONTRACT.md`

### Must describe
- Target page(s) URL patterns
- Core UI entities:
  - Review card
  - Review identifier
  - Action menu / complaint entry
  - Complaint modal
  - Submit / confirmation signals
- For each entity:
  - What it represents
  - Required properties
  - How it is identified conceptually (not selectors yet)
- Assumptions and invariants

### Acceptance criteria
- If UI changes, developer can quickly see **what assumption broke**
- Document is UI-focused, not code-focused

---

## TASK 5 — SELECTORS.md + Selectors Catalog

### Goal
Isolate **fragile UI selectors** into a managed, versioned layer.

### Why this document is required
- Prevents selector sprawl
- Makes UI fixes fast and localized
- Enables fallback strategies

### Documents to create
- `docs/SELECTORS.md`
- Ensure existence of a selectors catalog file
  (JSON or TS/JS — reflect current implementation)

### Must describe
- Selector strategy and priority rules
- Selector ownership rules (where they may live)
- Fallback selector philosophy
- How selectors map to DOM_CONTRACT entities

### Acceptance criteria
- No critical selector exists without documentation
- Selector changes always imply doc changes

---

## TASK 6 — SETUP_DEV.md

### Goal
Explain **how to run and test the extension locally**.

### Why this document is required
- Reduces onboarding time
- Prevents environment-specific bugs
- Allows Cloud Code to validate changes

### Document to create
`docs/SETUP_DEV.md`

### Must describe
- Prerequisites
- Install steps
- Build commands
- Chrome loading instructions
- How to open diagnostic mode
- Where to look for logs

### Acceptance criteria
- A new machine can run the extension in <30 minutes

---

## TASK 7 — TROUBLESHOOTING.md

### Goal
Document **known failure modes and recovery steps**.

### Why this document is required
- UI automation fails often
- Fast diagnosis saves hours
- Prevents repeated rediscovery of same issues

### Document to create
`docs/TROUBLESHOOTING.md`

### Must include
- UI element not found
- Complaint modal not opening
- Status sync failures
- Content script not injected
- Diagnostic page not responding

### Acceptance criteria
- Each issue has symptoms + probable causes + actions

---

## TASK 8 — UI_CHANGELOG.md

### Goal
Track **Valdris/WB UI changes and responses** over time.

### Why this document is required
- UI regressions are inevitable
- History speeds up future fixes
- Provides operational memory

### Document to create
`docs/UI_CHANGELOG.md`

### Must include entries with
- Date
- What changed in UI
- What broke
- What was updated (selectors / logic)
- Version or commit reference

### Acceptance criteria
- Every UI-related fix adds an entry

---

## 3. Completion rules

### 3.1 Task completion
A task is complete only when:
- Document is written
- Matches real code behavior
- Reviewed for clarity and consistency

### 3.2 Order of execution
Tasks should be completed **in order**:
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

### 3.3 Git requirement
After each completed task:
- Commit documentation changes
- Push to repository

---

## 4. Final outcome

After all tasks:
- The project has a **self-explaining documentation system**
- UI changes are cheaper and faster to handle
- Cloud Code can safely evolve the extension
- Knowledge is preserved, not tribal

---
