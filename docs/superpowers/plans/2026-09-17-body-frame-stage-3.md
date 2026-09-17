# Body Frame Stage 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the camera to Body Frame projects so users can switch projects, get automatic first/latest reference overlays, and save each capture into the correct project sequence/folder.

**Architecture:** Keep project-camera state calculation in a dependency-free helper module, camera UI in a focused project-switcher component, and storage integration behind the existing `saveCapturedPhoto` API. Project-aware captures use the Stage 2 project folder adapter; legacy callers keep the current root-photo behavior.

**Tech Stack:** TypeScript, Expo / React Native, react-native-vision-camera, AsyncStorage, Expo FileSystem/ImageManipulator, Node `.mjs` tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-body-frame-stage-3-design.md`

## Global Constraints
- Android-first; no iOS work.
- Current `main` already contains Stage 1 and Stage 2.
- Project photo sequence is stable and is never renumbered after deletion.
- Next sequence = max valid sequence + 1.
- Automatic reference mode is per project (`first | latest`).
- First project photo has no automatic reference overlay.
- Existing non-project photo callers must keep working.
- Stage 4 video, Stage 5 limit/upgrade, Stage 6 billing, Stage 7 final redesign are out of scope.

---

### Task 1: Lock Stage 3 camera/project contracts with RED tests

**Files:**
- Create: `tests/02-body-frame-stage-3.test.mjs`

- [x] Active project selection, fallback, sequence, first/latest reference and progress summary contracts added.
- [x] Initial RED confirmed in CI because `lib/body-frame-camera-project.ts` did not exist.
- [x] Failed-save rollback contract added later and RED confirmed because `rollbackLegacyProjectDraft` did not exist.

### Task 2: Add dependency-free project-camera helpers

**Files:**
- Create: `lib/body-frame-camera-project.ts`

- [x] `selectActiveBodyProject`
- [x] `getBodyProjectPhotos`
- [x] `getNextBodyProjectSequence`
- [x] `selectBodyProjectReferencePhoto`
- [x] `getBodyProjectProgressSummary`
- [x] Helper contracts GREEN.

### Task 3: Make `saveCapturedPhoto` project-aware

**Files:**
- Modify: `lib/photo-library.ts`
- Create: `lib/legacy-photo-library.ts`
- Existing: `lib/body-frame-photo-storage.ts`

- [x] Non-project callers delegate to the original photo-library implementation.
- [x] Project captures route through the Stage 2 project storage adapter.
- [x] Persist project ID, sequence, project image/preview paths and optimization metadata.
- [x] Failed project save removes transient legacy metadata/files instead of leaving a photo for legacy migration.
- [x] Capture reservation is released even if rollback cleanup also fails.

### Task 4: Build camera project switcher UI

**Files:**
- Create: `features/camera/BodyFrameProjectSwitcher.tsx`
- Create: `features/camera/BodyFrameCameraScreen.tsx`
- Modify: `app/(tabs)/camera.tsx`

- [x] Compact project control and progress summary.
- [x] Dark project picker.
- [x] New-project form with 100 / 365 / custom targets.
- [x] `latest` / `first` reference choice.
- [x] Switching is blocked while an app save is pending.

### Task 5: Load active project and automatic reference on camera focus

**Files:**
- Create: `features/camera/BodyFrameCameraScreen.tsx`
- Modify: `components/photo-reference-overlay.tsx`

- [x] Restore last active non-archived project.
- [x] Fallback to first available non-archived project.
- [x] Derive project count and next sequence.
- [x] Automatically resolve first/latest reference image.
- [x] First photo has no automatic overlay.
- [x] Manual overlay remains an explicit override for the current project and resets on project switch.

### Task 6: Connect capture save to project state

**Files:**
- Create: `lib/body-frame-camera-session.ts`
- Modify: `lib/photo-library.ts`
- Create: `features/camera/BodyFrameCameraScreen.tsx`

- [x] Project/sequence reservation prevents duplicate queued-save sequences.
- [x] Project ID and sequence are persisted on successful project captures.
- [x] Successful save refreshes count/reference/next sequence.
- [x] `<sequence>번째 사진을 저장했습니다.` status added.
- [x] First-photo hint added.
- [x] Save failure does not advance persisted project progress and rolls back transient metadata/files.

**Concurrency note:** The project switcher is locked from the point the app-save reservation begins until the save completes. The unchanged legacy camera core owns native capture/timer state internally, so there is still a narrow pre-save interval during native capture/timer where that state is not exported to the wrapper. This is retained as an explicit QA/integration follow-up rather than rewriting the camera core inside Stage 3.

### Task 7: Verification and PR review

- [x] TypeScript typecheck: PASS on latest Stage 3 code.
- [x] Expo lint: PASS on latest Stage 3 code.
- [x] Stage 1 contract: PASS.
- [x] Stage 2 contract: PASS.
- [x] Stage 3 contract: PASS (`ok - Body Frame stage 3 camera and project contracts are enforced`).
- [x] Functions: PASS.
- [x] Firebase Rules: PASS.
- [x] Diff reviewed for Stage 4+ scope creep.
- [x] Existing repository baseline failures recorded separately.

## Existing repository baseline failures
These failures are not introduced by Stage 3 and were already present before this branch:
- `npm test` continues past the Stage 1/2/3 contracts, then stops at `tests/android-aab-patch-policy.test.mjs` because `android/app/proguard-rules.pro` is absent.
- Android Kotlin verification remains red on the existing repository baseline.
- Historical Secret Scan/Gitleaks findings remain from old repository history; Stage 3 adds no secret material.

## Integration status
- Branch: `feat/body-frame-stage-3`
- PR: #3 against `main`
- Keep unmerged until the user explicitly requests merge.
