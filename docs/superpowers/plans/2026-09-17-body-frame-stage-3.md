# Body Frame Stage 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the camera to Body Frame projects so users can switch projects, get automatic first/latest reference overlays, and save each capture into the correct project sequence/folder.

**Architecture:** Keep project-camera state calculation in a dependency-free helper module, camera UI in a focused project-switcher component, and storage integration behind the existing `saveCapturedPhoto` API. Only camera captures that provide `projectId` + `sequence` use the Stage 2 project folder adapter; legacy callers keep the current root-photo behavior.

**Tech Stack:** TypeScript, Expo / React Native, react-native-vision-camera, AsyncStorage, Expo FileSystem/ImageManipulator, Node `.mjs` tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-body-frame-stage-3-design.md`

## Global Constraints
- Android-first; no iOS work.
- Current `main` already contains Stage 1 and Stage 2.
- Project photo sequence is stable and is never renumbered after deletion.
- Next sequence = max valid sequence + 1.
- Automatic reference mode is per project (`first | latest`).
- First project photo has no automatic reference overlay.
- Capture job snapshots `projectId` and `sequence` at shutter time.
- Existing non-project photo callers must keep working.
- Stage 4 video, Stage 5 limit/upgrade, Stage 6 billing, Stage 7 final redesign are out of scope.

---

### Task 1: Lock Stage 3 camera/project contracts with RED tests

**Files:**
- Create: `tests/02-body-frame-stage-3.test.mjs`

**Interfaces:**
- Consumes future `lib/body-frame-camera-project.ts`.
- Source-checks `features/camera/CameraScreen.tsx`, project switcher component, and `lib/photo-library.ts`.

- [ ] **Step 1: Write failing contract tests**
  - active project prefers last-active non-archived project.
  - fallback chooses first non-archived project.
  - next sequence is max + 1 and ignores invalid sequences.
  - first/latest reference selection is deterministic.
  - project count/duration summary uses photo count × 0.1 seconds.
  - camera source includes project switcher, active project persistence, automatic reference refresh, and project-aware capture input.
  - `saveCapturedPhoto` routes project captures through `storeBodyFramePhotoFile`.
- [ ] **Step 2: Open draft PR and verify RED in CI**

### Task 2: Add dependency-free project-camera helpers

**Files:**
- Create: `lib/body-frame-camera-project.ts`

**Interfaces:**
- `selectActiveBodyProject(projects, lastActiveProjectId)`
- `getBodyProjectPhotos(photos, projectId)`
- `getNextBodyProjectSequence(photos, projectId)`
- `selectBodyProjectReferencePhoto(photos, project)`
- `getBodyProjectProgressSummary(photos, project)`

- [ ] **Step 1: Implement minimal pure helpers**
- [ ] **Step 2: Run Stage 3 helper tests GREEN**

### Task 3: Make `saveCapturedPhoto` project-aware

**Files:**
- Modify: `lib/photo-library.ts`
- Existing: `lib/body-frame-photo-storage.ts`

**Interfaces:**
- If `projectId` and positive integer `sequence` exist, use `storeBodyFramePhotoFile`.
- Persist `projectId`, `sequence`, project URI, preview URI, and optimization metadata.
- Existing non-project path remains unchanged.

- [ ] **Step 1: Add project-aware branch after ratio/color rendering**
- [ ] **Step 2: Keep device-save and cloud-backup compatibility through returned `PhotoItem`**
- [ ] **Step 3: Run typecheck and Stage 3 contract test**

### Task 4: Build camera project switcher UI

**Files:**
- Create: `features/camera/BodyFrameProjectSwitcher.tsx`
- Modify: `features/camera/CameraScreen.tsx`

**Interfaces:**
- Props include projects with photo counts, active project ID, disabled state, select/create handlers.
- Header shows folder icon, project name, and progress summary.
- Modal/bottom sheet lists non-archived projects and `+ 새 프로젝트`.

- [ ] **Step 1: Add compact header control**
- [ ] **Step 2: Add dark bottom-sheet project list**
- [ ] **Step 3: Add project creation form: name, 100/365/custom target, first/latest reference**
- [ ] **Step 4: Block switching while capture/save is pending**
- [ ] **Step 5: Run lint/typecheck**

### Task 5: Load active project and automatic reference on camera focus

**Files:**
- Modify: `features/camera/CameraScreen.tsx`

**Interfaces:**
- Uses `getBodyProjects`, `getLastActiveProjectId`, `setLastActiveProjectId`, `getPhotos` and Stage 3 pure helpers.
- Camera focus refresh loads settings/projects/photos together.

- [ ] **Step 1: Resolve active project**
- [ ] **Step 2: Derive project photos/count/next sequence**
- [ ] **Step 3: Set automatic reference URI according to project `referenceMode`**
- [ ] **Step 4: Keep manual album overlay as an explicit override until project changes/refreshes**
- [ ] **Step 5: Persist project switch immediately**

### Task 6: Connect capture save to project snapshot

**Files:**
- Modify: `features/camera/CameraScreen.tsx`

**Interfaces:**
- `captureInput.projectId = activeProject.id`
- `captureInput.sequence = current next sequence`
- Save callback refreshes project photos only after successful app save.

- [ ] **Step 1: Snapshot active project/sequence before queuing save**
- [ ] **Step 2: Pass project fields through `SaveCapturedPhotoInput`**
- [ ] **Step 3: After successful save, refresh count/reference/next sequence**
- [ ] **Step 4: Show `<sequence>번째 사진을 저장했습니다.` as non-blocking status**
- [ ] **Step 5: First-photo state shows `첫 사진을 찍어 기준을 만들어주세요.`**

### Task 7: Verification and PR review

**Files:**
- Update this plan with evidence.

- [ ] **Step 1: Verify CI**
  - Typecheck PASS
  - Lint PASS
  - Stage 1 contract PASS
  - Stage 2 contract PASS
  - Stage 3 contract PASS
  - Functions/Firebase Rules unchanged and checked
- [ ] **Step 2: Record known repository baseline failures separately if unchanged**
- [ ] **Step 3: Review diff for accidental Stage 4+ scope creep**
- [ ] **Step 4: Keep PR against `main` until user requests merge**