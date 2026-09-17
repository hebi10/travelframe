# Body Frame Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Body Frame project, photo compatibility, media-policy, and entitlement foundations without changing user-facing screens.

**Architecture:** Keep the existing TravelFrame storage and entitlement structures compatible while adding Body Frame-specific types and pure normalization helpers. Put fixed product/media rules in a dependency-free constants module so tests can execute them directly, and keep project selection persistence behind the existing local storage adapter. Actual photo-library migration wiring remains Stage 2 so Stage 1 does not mutate live stored data.

**Tech Stack:** TypeScript, React Native / Expo, Node `.mjs` tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-body-frame-stage-1-design.md`

## Global Constraints
- Android-first; no iOS changes.
- Existing TravelFrame storage keys remain unchanged in Stage 1.
- Free progress limit is 100 photos / 10 seconds.
- Progress frame duration is 0.1 seconds and target output FPS is 30.
- App image policy is max long side 2560px / JPEG quality 0.85.
- Preview policy is max long side 1080px / JPEG quality 0.74.
- Free project-count enforcement is not finalized; represent project count as nullable.

---

### Task 1: Lock Stage 1 contracts with failing tests

**Files:**
- Create: `tests/00-body-frame-stage-1.test.mjs`

**Interfaces:**
- Consumes: future `constants/body-frame.ts`, `lib/body-frame-normalization.ts`.
- Produces: executable contract for Stage 1 product constants and normalization behavior.

- [x] **Step 1: Write the failing test**
  - Dynamically transpile dependency-free TypeScript modules with `typescript.transpileModule`.
  - Assert free limit 100 photos / 10 seconds, 0.1 seconds per photo, 30fps, 2560/0.85 app image policy, and 1080/0.74 preview policy.
  - Assert invalid reference modes normalize to `latest`.
  - Assert legacy photos without `projectId`/`sequence` remain valid and unchanged apart from sanitized optional fields.
  - Assert invalid project IDs and invalid sequence numbers are removed.
  - Assert last-active-project IDs trim whitespace and invalid values normalize to null.

- [x] **Step 2: Run test to verify it fails**
  - GitHub Actions PR run reached the Test step and failed while typecheck and lint passed, establishing RED before production code was added.

### Task 2: Add Body Frame policy and normalization modules

**Files:**
- Create: `constants/body-frame.ts`
- Create: `lib/body-frame-normalization.ts`
- Create: `types/body-project.ts`

**Interfaces:**
- Produces: `BODY_FRAME_MEDIA_POLICY`, `BODY_FRAME_FREE_LIMITS`, `BODY_FRAME_PROGRESS_POLICY`, `normalizeReferencePhotoMode`, `normalizeStoredPhotoItem`, `normalizeLastActiveProjectId`, `BodyProject`, `ReferencePhotoMode`.

- [x] **Step 1: Implement minimal code to satisfy the contract test**
- [x] **Step 2: Re-run the Stage 1 test and verify GREEN**
  - PR CI output: `ok - Body Frame stage 1 data and policy contracts are enforced`.

### Task 3: Add legacy-compatible photo fields

**Files:**
- Modify: `types/photo.ts`

**Interfaces:**
- `PhotoItem.projectId?: string`
- `PhotoItem.sequence?: number`
- `normalizeStoredPhotoItem` is available for the Stage 2 migration/storage integration.

- [x] **Step 1: Extend `PhotoItem` additively**
- [x] **Step 2: Keep live `travel-frame.photos.v1` parsing unchanged until Stage 2 migration**
- [x] **Step 3: Run typecheck and Stage 1 test**
  - Typecheck PASS in PR CI.
  - Stage 1 contract test PASS in PR CI.

### Task 4: Add last-active-project persistence foundation

**Files:**
- Create: `lib/body-project-preferences.ts`

**Interfaces:**
- Produces: `getLastActiveProjectId`, `setLastActiveProjectId`, `clearLastActiveProjectId`, `LAST_ACTIVE_PROJECT_ID_STORAGE_KEY`.

- [x] **Step 1: Implement storage wrapper using `localStorageAdapter` and normalization helper**
- [x] **Step 2: Add source-level assertions to the Stage 1 test**
- [x] **Step 3: Run test and typecheck**
  - Typecheck PASS in PR CI.
  - Stage 1 contract test PASS in PR CI.

### Task 5: Extend entitlements semantically

**Files:**
- Modify: `lib/plan-entitlements.ts`
- Modify: `tests/plan-entitlements.test.mjs`

**Interfaces:**
- Add `maxProgressPhotos: number | null`
- Add `maxProgressVideoSeconds: number | null`
- Add `maxProjectCount: number | null`

- [x] **Step 1: Add fields without removing existing entitlement fields**
- [x] **Step 2: Configure guest/free/ad-remove to 100 photos / 10 seconds**
- [x] **Step 3: Configure Pro to at least 365 photos / 36.5 seconds and Expert as open-ended**
- [x] **Step 4: Run Stage 1 test and typecheck**
  - Stage 1 contract test validates entitlement runtime values before the repository's known baseline test failure.
  - Typecheck PASS in PR CI.

### Task 6: Full verification and PR review

**Files:**
- No new production files unless verification identifies a defect.

- [x] **Step 1: Run GitHub Actions quality jobs and classify results**
  - Typecheck: PASS.
  - Lint: PASS.
  - Stage 1 contract test: PASS.
  - Functions: PASS.
  - Firebase Rules: PASS.
  - Full `npm test`: BLOCKED by pre-existing `tests/android-aab-patch-policy.test.mjs` failure because `android/app/proguard-rules.pro` is absent from the repository. The same failure is present on `main` at base SHA `b4b486980c23c216023fe8a47a241b8a7a931da7`.
  - Android Kotlin verification: pre-existing failure on `main`; Stage 1 does not change Android native files.
  - Secret Scan history: pre-existing findings in historical `firebase-debug.log` commit `4e7ae056670274cba4150d0fbc44df078c4fac13`; current Stage 1 changes introduce no new finding.

- [x] **Step 2: Review changed-file diff against the spec**
  - Scope is limited to policy constants, domain types, normalization helpers, last-active-project persistence, semantic entitlement fields, tests, and Stage 1 docs.
  - No user-facing screen or camera behavior is changed.

- [x] **Step 3: Confirm Stage 1 does not introduce Stage 2 UI/storage-folder behavior**
  - No project CRUD UI, project switcher, physical project folder migration, photo-library migration wiring, image re-encoding changes, or progress video rendering changes are included.

## Verification Status

Stage 1-specific implementation and checks are GREEN. Repository-wide CI remains RED only because of failures already present on the base `main` branch. Those baseline CI repairs are intentionally kept outside this Stage 1 feature branch so the Body Frame data-foundation change remains isolated and reviewable.
