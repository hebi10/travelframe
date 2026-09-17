# Body Frame Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local Body Frame projects, safe legacy-photo migration, project-scoped storage primitives, and fixed image optimization while leaving Stage 3 camera/project UI out of scope.

**Architecture:** Keep `travel-frame.photos.v1` for compatibility, add `body-frame.projects.v1` for projects, and orchestrate migration from a dedicated Stage 2 migration module. New Body Frame project files are handled by a dedicated `body-frame-photo-storage.ts` adapter; the existing TravelFrame camera/photo-library save flow remains unchanged until Stage 3 explicitly selects a project and connects to this adapter.

**Tech Stack:** TypeScript, Expo / React Native, AsyncStorage, expo-file-system, expo-image-manipulator, Node `.mjs` tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-body-frame-stage-2-design.md`

## Global Constraints
- Android-first; no iOS changes.
- Preserve `travel-frame.photos.v1` and existing photo IDs.
- Legacy project ID is `legacy-photos`; display name is `기존 사진`.
- Legacy sequence ordering is oldest first, then ID for ties.
- Per-project local photo path is `photos/<projectId>/<NNN>.jpg`.
- Per-project preview path is `photo-previews/<projectId>/<NNN>.jpg`.
- New Body Frame project image policy: max 2560px long side / JPEG 0.85.
- New Body Frame preview policy: max 1080px long side / JPEG 0.74.
- Existing local photos are moved/copied as-is, not re-encoded, during migration.
- Source files are deleted only after project and photo metadata are persisted.
- Cloud-only/remote photo originals are assigned metadata only; migration must not download them.
- Current TravelFrame camera save behavior remains unchanged until Stage 3.

---

### Task 1: Lock Stage 2 contracts with a failing test

**Files:**
- Create: `tests/01-body-frame-stage-2.test.mjs`

**Interfaces:**
- Consumes future `lib/body-frame-stage2-utils.ts` and Stage 2 source files.
- Produces executable contracts for deterministic legacy assignment, project path formatting, repository/storage keys, safe migration order, fixed optimization wiring, and app-start migration wiring.

- [x] **Step 1: Write the failing test**
  - Import the dependency-free Stage 2 helper through TypeScript transpilation.
  - Assert legacy photos sort oldest-first and receive sequence 1..N.
  - Assert already-assigned photos remain unchanged.
  - Assert target count is at least 100 and at least the migrated photo count.
  - Assert `001.jpg`, `099.jpg`, `100.jpg`, `1000.jpg` formatting.
  - Assert project IDs are sanitized for path usage.
  - Assert project repository key and migration marker exist in source.
  - Assert the project-photo storage adapter contains project paths and fixed Body Frame optimization policy usage.
  - Assert migration metadata persistence appears before old-file cleanup.
  - Assert `app/_layout.tsx` invokes Stage 2 migration.

- [x] **Step 2: Open a stacked draft PR against `feat/body-frame-stage-1` and verify RED**
  - CI: typecheck/lint passed, then `01-body-frame-stage-2.test.mjs` failed with `ENOENT` for missing `lib/body-frame-stage2-utils.ts`, establishing RED before production code.

### Task 2: Add pure Stage 2 project/migration helpers

**Files:**
- Create: `lib/body-frame-stage2-utils.ts`

**Interfaces:**
- Produces `LEGACY_BODY_PROJECT_ID`, `LEGACY_BODY_PROJECT_NAME`, `formatProjectSequenceFileName`, `sanitizeProjectPathSegment`, `buildProjectPhotoRelativePath`, `buildProjectPreviewRelativePath`, `assignLegacyPhotosToProject`, `buildLegacyBodyProject`.

- [x] **Step 1: Implement the minimal helper functions required by the failing test**
- [x] **Step 2: Verify chronological sequencing, assigned-photo preservation, deterministic ties, cover, target count, and path formatting in Stage 2 test**

### Task 3: Add Body Project repository

**Files:**
- Create: `lib/body-project-library.ts`

**Interfaces:**
- Storage key `body-frame.projects.v1`.
- Produces `getBodyProjects`, `getBodyProjectById`, `createBodyProject`, `updateBodyProject`, `archiveBodyProject`, `replaceBodyProjects`.

- [x] **Step 1: Parse and normalize stored project records defensively**
- [x] **Step 2: Add create/update/archive APIs with filesystem-safe generated IDs**
- [x] **Step 3: Keep writes serialized to avoid overlapping project mutations**
- [x] **Step 4: Verify project repository source contract and TypeScript compilation**

### Task 4: Add project-scoped photo storage foundation

**Files:**
- Modify: `types/photo.ts`
- Create: `lib/body-frame-photo-storage.ts`

**Interfaces:**
- Capture/edit inputs support optional `projectId` and `sequence` for Stage 3 wiring.
- Produces `getBodyFrameProjectPhotoUri`, `getBodyFrameProjectPreviewUri`, `storeBodyFramePhotoFile`, `createBodyFramePreview`, `migratePhotoFilesToProject`, `cleanupMigratedSourceFiles`.
- Existing TravelFrame `photo-library.ts` save flow remains unchanged in Stage 2.

- [x] **Step 1: Add optional project-aware input fields without breaking existing call sites**
- [x] **Step 2: Add project photo/preview directory helpers**
- [x] **Step 3: Implement safe `.migrating` temporary copy then final move**
- [x] **Step 4: Add a project-aware save adapter for Stage 3 to consume**
- [x] **Step 5: Add migration support that updates local URI metadata but skips remote/cloud-only originals**
- [x] **Step 6: Verify storage-adapter source contract and TypeScript compilation**

### Task 5: Apply fixed Body Frame image policy to project storage

**Files:**
- Modify: `lib/image-backup-utils.ts`
- Create/Modify: `lib/body-frame-photo-storage.ts`

**Interfaces:**
- Produce `optimizeBodyFramePhotoForStorage` using max 2560px / JPEG 0.85.
- Body Frame project preview generation uses max 1080px / JPEG 0.74.
- Existing cloud-backup optimizer and current TravelFrame save flow remain compatible with existing quality settings until their later migration.

- [x] **Step 1: Add Body Frame-specific storage optimizer without changing cloud backup behavior**
- [x] **Step 2: Route new project-storage adapter through fixed photo optimizer**
- [x] **Step 3: Route project preview generation through Body Frame preview constants**
- [x] **Step 4: Verify policy wiring in Stage 2 contract test**
- [x] **Step 5: Verify typecheck and lint**

### Task 6: Implement safe legacy project/file migration

**Files:**
- Create: `lib/body-frame-stage2-migration.ts`
- Reuse: existing `replacePhotosFromBackup()` as the compatible write path for `travel-frame.photos.v1`.

**Interfaces:**
- Storage marker `body-frame.stage-2-migration.v1`.
- Produces `ensureBodyFrameStage2Migration`.

- [x] **Step 1: Load projects/photos and select only unassigned legacy photos**
- [x] **Step 2: Reuse or create deterministic `legacy-photos` project**
- [x] **Step 3: Assign stable chronological sequence numbers**
- [x] **Step 4: For local files, copy through `.migrating` temp files into final project paths; skip remote/cloud-only originals**
- [x] **Step 5: Persist projects first and complete photo metadata second**
- [x] **Step 6: Only after both metadata writes succeed, remove obsolete source local files**
- [x] **Step 7: Set last-active project if none exists, then write migration marker**
- [x] **Step 8: Leave migration retry-safe when any earlier operation throws**
- [x] **Step 9: Verify persistence-before-cleanup ordering in the contract test**

### Task 7: Wire migration at app startup

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Calls `ensureBodyFrameStage2Migration()` once from the existing startup effect.
- Migration failure does not prevent app startup and can be retried later.

- [x] **Step 1: Add startup invocation next to existing initialization work**
- [x] **Step 2: Catch migration failure without finalizing a failed migration**
- [x] **Step 3: Verify startup source contract, typecheck, and lint**

### Task 8: Verification and stacked PR review

**Files:**
- This plan records verification evidence.

- [x] **Step 1: Verify Stage 2-specific CI evidence**
  - Stage 1 contract test: PASS
  - Stage 2 contract test: PASS (`ok - Body Frame stage 2 project, storage, and migration contracts are enforced`)
  - Typecheck: PASS
  - Lint: PASS
  - Functions: PASS
  - Firebase Rules: checked separately in CI; no Stage 2 rule changes
  - Repository-wide `npm test` later stops at the existing `android/app/proguard-rules.pro` baseline issue after Stage 1/2 tests pass.
  - Android Kotlin and historical Gitleaks are existing baseline failures inherited from Stage 1/main.
- [x] **Step 2: Review Stage 2 architecture against the design spec and align the spec to the dedicated storage adapter**
- [x] **Step 3: Confirm no Stage 3 project-switcher or camera-overlay UI was introduced**
- [x] **Step 4: Keep PR #2 stacked on `feat/body-frame-stage-1` until Stage 1 lands**

## Verification Evidence
At commit `18550d57c142a4dab689c044178478695792ec6a`, GitHub Actions showed:
- `tsc --noEmit`: PASS
- `expo lint`: PASS
- `00-body-frame-stage-1.test.mjs`: PASS
- `01-body-frame-stage-2.test.mjs`: PASS
- Functions: PASS
- `npm test` progressed past both Body Frame tests and then failed on the repository's pre-existing missing `android/app/proguard-rules.pro` fixture.

The final documentation-only alignment commit must retain the same typecheck/lint/Stage 1/Stage 2 test results before Stage 2 is considered ready for review.
