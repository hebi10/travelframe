# Body Frame Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local Body Frame projects, safe legacy-photo migration, project-scoped file paths, and fixed image optimization while leaving Stage 3 UI out of scope.

**Architecture:** Keep `travel-frame.photos.v1` for compatibility, add `body-frame.projects.v1` for projects, and orchestrate migration from a dedicated Stage 2 migration module. Pure project/migration helpers remain dependency-free for executable contract tests; React Native filesystem and AsyncStorage wiring stays in focused repository/orchestration modules.

**Tech Stack:** TypeScript, Expo / React Native, AsyncStorage, expo-file-system, expo-image-manipulator, Node `.mjs` tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-body-frame-stage-2-design.md`

## Global Constraints
- Android-first; no iOS changes.
- Preserve `travel-frame.photos.v1` and existing IDs.
- Legacy project ID is `legacy-photos`; display name is `기존 사진`.
- Legacy sequence ordering is oldest first, then ID for ties.
- Per-project local photo path is `photos/<projectId>/<NNN>.jpg`.
- Per-project preview path is `photo-previews/<projectId>/<NNN>.jpg`.
- New local app image policy: max 2560px long side / JPEG 0.85.
- New preview policy: max 1080px long side / JPEG 0.74.
- Existing local photos are moved, not re-encoded, during migration.
- Source files are deleted only after migrated metadata is persisted.
- Cloud-only/remote photos are assigned metadata only; migration must not download them.
- Stage 3 UI is not implemented here.

---

### Task 1: Lock Stage 2 contracts with a failing test

**Files:**
- Create: `tests/01-body-frame-stage-2.test.mjs`

**Interfaces:**
- Consumes future `lib/body-frame-stage2-utils.ts` and source files.
- Produces executable contracts for deterministic legacy assignment, project path formatting, repository/storage keys, safe migration order, fixed optimization wiring, and app-start migration wiring.

- [ ] **Step 1: Write the failing test**
  - Import the dependency-free Stage 2 helper through TypeScript transpilation.
  - Assert legacy photos sort oldest-first and receive sequence 1..N.
  - Assert already-assigned photos remain unchanged.
  - Assert target count is at least 100 and at least the migrated photo count.
  - Assert `001.jpg`, `099.jpg`, `100.jpg`, `1000.jpg` formatting.
  - Assert project IDs are sanitized for path usage.
  - Assert project repository key and migration marker exist in source.
  - Assert `photo-library.ts` contains project-scoped photo/preview path wiring and Body Frame optimization policy usage.
  - Assert migration metadata persistence appears before old-file cleanup.
  - Assert `app/_layout.tsx` invokes Stage 2 migration.

- [ ] **Step 2: Open a stacked draft PR against `feat/body-frame-stage-1` and verify RED**
  - Expected: Stage 2 test runs after Stage 1 test and fails because Stage 2 modules do not exist yet.

### Task 2: Add pure Stage 2 project/migration helpers

**Files:**
- Create: `lib/body-frame-stage2-utils.ts`

**Interfaces:**
- Produces `LEGACY_BODY_PROJECT_ID`, `LEGACY_BODY_PROJECT_NAME`, `formatProjectSequenceFileName`, `sanitizeProjectPathSegment`, `assignLegacyPhotosToProject`, `buildLegacyBodyProject`.

- [ ] **Step 1: Implement the minimal helper functions required by the failing test**
- [ ] **Step 2: Re-run Stage 2 test and verify helper assertions pass**

### Task 3: Add Body Project repository

**Files:**
- Create: `lib/body-project-library.ts`

**Interfaces:**
- Storage key `body-frame.projects.v1`.
- Produces `getBodyProjects`, `getBodyProjectById`, `createBodyProject`, `updateBodyProject`, `archiveBodyProject`, `replaceBodyProjects`.

- [ ] **Step 1: Parse and normalize stored project records defensively**
- [ ] **Step 2: Add create/update/archive APIs with filesystem-safe generated IDs**
- [ ] **Step 3: Keep writes serialized to avoid overlapping project mutations**
- [ ] **Step 4: Run typecheck and Stage 2 contract test**

### Task 4: Make photo storage project-aware

**Files:**
- Modify: `types/photo.ts`
- Modify: `lib/photo-library.ts`

**Interfaces:**
- Extend capture/edit inputs with optional `projectId` and `sequence`.
- Produce `getPhotosByProjectId`, `getNextPhotoSequence`, `replacePhotosForMigration`.
- Resolve supplied project first, then last-active project; retain root fallback when neither exists.

- [ ] **Step 1: Add project-aware input fields without breaking existing call sites**
- [ ] **Step 2: Add project directory helpers for photos and previews**
- [ ] **Step 3: Save project photos as `<NNN>.jpg` and project previews as `<NNN>.jpg`**
- [ ] **Step 4: Preserve existing project/sequence when editing a target photo**
- [ ] **Step 5: Add project query / next-sequence helpers**
- [ ] **Step 6: Run typecheck and contract test**

### Task 5: Apply fixed Body Frame image policy to new local saves

**Files:**
- Modify: `lib/image-backup-utils.ts`
- Modify: `lib/photo-library.ts`
- Modify: `tests/local-image-optimization.test.mjs`

**Interfaces:**
- Produce `optimizeBodyFramePhotoForStorage` using max 2560px / JPEG 0.85.
- Preview generation uses max 1080px / JPEG 0.74.
- Cloud backup optimizer remains compatible with existing quality settings.

- [ ] **Step 1: Add Body Frame-specific storage optimizer without changing cloud backup behavior**
- [ ] **Step 2: Route captured/edited local photo saves through it**
- [ ] **Step 3: Route new preview generation through Body Frame preview constants**
- [ ] **Step 4: Update optimization tests to assert the new fixed local policy**
- [ ] **Step 5: Run typecheck, lint, and Stage 2 test**

### Task 6: Implement safe legacy project/file migration

**Files:**
- Create: `lib/body-frame-stage2-migration.ts`
- Modify: `lib/photo-library.ts` as needed for migration write access.

**Interfaces:**
- Storage marker `body-frame.stage-2-migration.v1`.
- Produces `ensureBodyFrameStage2Migration`.

- [ ] **Step 1: Load projects/photos and select only unassigned legacy photos**
- [ ] **Step 2: Reuse or create deterministic `legacy-photos` project**
- [ ] **Step 3: Assign stable chronological sequence numbers**
- [ ] **Step 4: For local files, copy through a temporary project-path file into the final destination; skip remote/cloud-only files**
- [ ] **Step 5: Persist projects and migrated photo metadata**
- [ ] **Step 6: Only after successful persistence, remove obsolete source local files**
- [ ] **Step 7: Set last-active project if none exists, then write migration marker**
- [ ] **Step 8: Ensure failures leave the marker unset for retry**
- [ ] **Step 9: Run Stage 2 contract test and typecheck**

### Task 7: Wire migration at app startup

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Calls `ensureBodyFrameStage2Migration()` once from existing startup effect.
- Migration failure does not prevent app startup.

- [ ] **Step 1: Add startup invocation next to existing initialization work**
- [ ] **Step 2: Catch migration failure and leave retry behavior intact**
- [ ] **Step 3: Run typecheck, lint, and Stage 2 test**

### Task 8: Verification and stacked PR review

**Files:**
- Update this plan with completed verification evidence.

- [ ] **Step 1: Verify CI evidence**
  - Stage 1 contract test: PASS
  - Stage 2 contract test: PASS
  - Typecheck: PASS
  - Lint: PASS
  - Functions: PASS
  - Firebase Rules: PASS
  - Record known baseline failures separately (`android/app/proguard-rules.pro`, Android Kotlin, historical Gitleaks) if unchanged.
- [ ] **Step 2: Review all Stage 2 changed files against the design spec**
- [ ] **Step 3: Confirm no Stage 3 UI or camera overlay work was introduced**
- [ ] **Step 4: Keep PR stacked on `feat/body-frame-stage-1` until Stage 1 lands**
