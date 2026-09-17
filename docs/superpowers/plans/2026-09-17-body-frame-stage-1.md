# Body Frame Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Body Frame project, photo compatibility, media-policy, and entitlement foundations without changing user-facing screens.

**Architecture:** Keep the existing TravelFrame storage and entitlement structures compatible while adding Body Frame-specific types and pure normalization helpers. Put fixed product/media rules in a dependency-free constants module so tests can execute them directly, and keep project selection persistence behind the existing local storage adapter.

**Tech Stack:** TypeScript, React Native / Expo, Node `.mjs` tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-body-frame-stage-1-design.md`

## Global Constraints
- Android-first; no iOS changes.
- Existing TravelFrame storage keys remain readable.
- Free progress limit is 100 photos / 10 seconds.
- Progress frame duration is 0.1 seconds and target output FPS is 30.
- App image policy is max long side 2560px / JPEG quality 0.85.
- Preview policy is max long side 1080px / JPEG quality 0.74.
- Free project-count enforcement is not finalized; represent project count as nullable.

---

### Task 1: Lock Stage 1 contracts with failing tests

**Files:**
- Create: `tests/body-frame-stage-1.test.mjs`

**Interfaces:**
- Consumes: future `constants/body-frame.ts`, `lib/body-frame-normalization.ts`.
- Produces: executable contract for Stage 1 product constants and normalization behavior.

- [ ] **Step 1: Write the failing test**
  - Dynamically transpile dependency-free TypeScript modules with `typescript.transpileModule`.
  - Assert free limit 100 photos / 10 seconds, 0.1 seconds per photo, 30fps, 2560/0.85 app image policy, and 1080/0.74 preview policy.
  - Assert invalid reference modes normalize to `latest`.
  - Assert legacy photos without `projectId`/`sequence` remain valid and unchanged apart from sanitized optional fields.
  - Assert invalid project IDs and invalid sequence numbers are removed.
  - Assert last-active-project IDs trim whitespace and invalid values normalize to null.

- [ ] **Step 2: Run test to verify it fails**
  - Trigger GitHub Actions through the Stage 1 pull request.
  - Expected: test fails because Stage 1 modules do not exist yet.

### Task 2: Add Body Frame policy and normalization modules

**Files:**
- Create: `constants/body-frame.ts`
- Create: `lib/body-frame-normalization.ts`
- Create: `types/body-project.ts`

**Interfaces:**
- Produces: `BODY_FRAME_MEDIA_POLICY`, `BODY_FRAME_FREE_LIMITS`, `BODY_FRAME_PROGRESS_POLICY`, `normalizeReferencePhotoMode`, `normalizeStoredPhotoItem`, `normalizeLastActiveProjectId`, `BodyProject`, `ReferencePhotoMode`.

- [ ] **Step 1: Implement minimal code to satisfy the contract test**
- [ ] **Step 2: Re-run the Stage 1 test and verify GREEN**

### Task 3: Integrate compatibility into existing photo storage

**Files:**
- Modify: `types/photo.ts`
- Modify: `lib/photo-library.ts`

**Interfaces:**
- `PhotoItem.projectId?: string`
- `PhotoItem.sequence?: number`
- Stored photo parsing uses `normalizeStoredPhotoItem`.

- [ ] **Step 1: Extend `PhotoItem` additively**
- [ ] **Step 2: Normalize parsed stored photos before sorting**
- [ ] **Step 3: Run typecheck and Stage 1 test**

### Task 4: Add last-active-project persistence foundation

**Files:**
- Create: `lib/body-project-preferences.ts`

**Interfaces:**
- Produces: `getLastActiveProjectId`, `setLastActiveProjectId`, `clearLastActiveProjectId`, `LAST_ACTIVE_PROJECT_ID_STORAGE_KEY`.

- [ ] **Step 1: Implement storage wrapper using `localStorageAdapter` and normalization helper**
- [ ] **Step 2: Add source-level assertions to the Stage 1 test**
- [ ] **Step 3: Run test and typecheck**

### Task 5: Extend entitlements semantically

**Files:**
- Modify: `lib/plan-entitlements.ts`

**Interfaces:**
- Add `maxProgressPhotos: number | null`
- Add `maxProgressVideoSeconds: number | null`
- Add `maxProjectCount: number | null`

- [ ] **Step 1: Add fields without removing existing entitlement fields**
- [ ] **Step 2: Configure guest/free/ad-remove to 100 photos / 10 seconds**
- [ ] **Step 3: Configure Pro to at least 365 photos / 36.5 seconds and Expert as open-ended**
- [ ] **Step 4: Run Stage 1 test and typecheck**

### Task 6: Full verification and PR review

**Files:**
- No new production files unless verification identifies a defect.

- [ ] **Step 1: Run GitHub Actions quality jobs**
  - Typecheck
  - Lint
  - Tests
  - Secret scan
  - Functions
  - Firebase rules
  - Android Kotlin / release manifest

- [ ] **Step 2: Review changed-file diff against the spec**
- [ ] **Step 3: Confirm Stage 1 does not introduce Stage 2 UI/storage-folder behavior**
