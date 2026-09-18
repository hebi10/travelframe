# Body Frame Stage 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce Body Frame photo/video plan limits at UI, reservation and persistence boundaries while preserving legacy TravelFrame behavior.

**Architecture:** Add pure plan-limit helpers, extend the Body Frame camera session with project-count/limit state, make the legacy camera honor that session state, bypass the unrelated legacy local-image cap for reserved Body Frame saves, and gate the Stage 4 Body Frame video exporter with the same entitlements.

**Tech Stack:** TypeScript, React Native, Expo Router, existing plan-entitlements, Body Frame camera session, Node `.mjs` contract tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-18-body-frame-stage-5-design.md`

## Global Constraints
- Android-first.
- Free/guest/ad-remove: 100 photos / 10.0s progress video.
- Pro: 365 photos / 36.5s progress video.
- Expert: uncapped in current Body Frame progress entitlement fields.
- 100th free photo allowed; 101st blocked.
- Do not enforce project-count limits in Stage 5.
- Do not implement billing.
- Preserve legacy non-project photo/video behavior.

---

### Task 1: RED contract tests
**Files:**
- Create: `tests/04-body-frame-stage-5.test.mjs`

- [x] Test capture limit boundary: 99→allowed, 100→blocked for Free.
- [x] Test Pro 364→allowed, 365→blocked.
- [x] Test Expert null limit stays allowed.
- [x] Test video duration boundary and upgrade tier resolution.
- [x] Source-check camera session, camera wrapper, legacy camera block, project-aware save cap bypass and video export guard.
- [x] Open stacked draft PR and verify initial RED: `lib/body-frame-plan-limits.ts` missing.
- [x] Add cross-project completion regression and verify RED before fixing active-project count mutation.
- [x] Add pending-last-slot regression and verify RED before adding pending-aware native capture blocking.

### Task 2: Pure plan-limit helpers
**Files:**
- Create: `lib/body-frame-plan-limits.ts`

- [x] Add capture limit state helper.
- [x] Add progress-video limit state helper.
- [x] Add project-target allowance helper.
- [x] Add next upgrade tier/label helper.

### Task 3: Camera session hard limit
**Files:**
- Modify: `lib/body-frame-camera-session.ts`
- Modify: `features/camera/BodyFrameCameraScreen.tsx`
- Modify: `features/camera/CameraScreen.tsx`

- [x] Add `projectPhotoCount`, `maxProgressPhotos`, `captureBlockedReason` to session.
- [x] Reject reservation when count + pending saves reaches limit.
- [x] Increment in-memory count only on successful finish for the active project.
- [x] Ensure another project's completed reservation cannot mutate the active project's count.
- [x] Make pending save occupying the last slot disable native capture immediately.
- [x] Make legacy shutter/timer check Body Frame blocked state.
- [x] Display limit/upgrade state in wrapper.

### Task 4: Project-aware persistence compatibility
**Files:**
- Modify: `lib/photo-library.ts`

- [x] For a reserved Body Frame save, clear `localImageLimit` before delegating to the legacy render/save path.
- [x] Preserve legacy local-image limits for non-project callers.
- [x] Keep existing rollback behavior.
- [x] Pass the reserved project ID into capture completion.

### Task 5: Project target guard
**Files:**
- Modify: `features/camera/BodyFrameProjectSwitcher.tsx`
- Modify: `features/camera/BodyFrameCameraScreen.tsx`

- [x] Disable preset targets above current plan allowance.
- [x] Validate custom targets before submit.
- [x] Expose plan navigation action when a larger target requires upgrade.
- [x] Leave project-count enforcement unimplemented because the product rule is not final.

### Task 6: Video export enforcement
**Files:**
- Modify: `features/trip-clip/BodyFrameVideoScreen.tsx`

- [x] Derive video limit state from `maxProgressVideoSeconds`.
- [x] Block render/save above allowance without truncating project photos.
- [x] Show current plan limit and upgrade action.
- [x] Keep exact Stage 4 timing/render policy unchanged.

### Task 7: Verification
- [x] Typecheck PASS.
- [x] Lint PASS.
- [x] Stage 1~5 contracts PASS before repository baseline failure.
- [x] Functions PASS.
- [x] Firebase Rules PASS.
- [x] Confirm existing Android/prebuild and historical Secret Scan baseline failures are unchanged.
- [x] Review diff for Stage 6+ scope creep.
- [x] Keep stacked PR based on Stage 4 until merge is requested.

## TDD evidence

### Initial RED
Stage 1~4 contract tests passed, then Stage 5 stopped with:

`Error: ENOENT: no such file or directory, open 'lib/body-frame-plan-limits.ts'`

### Cross-project regression RED
A completed reservation for another project incorrectly incremented the active project's in-memory photo count:

`AssertionError: finishing another project must not increment the active project's count`

The completion API now receives `projectId` and mutates the count only when the saved project matches the active project.

### Pending-last-slot RED
At 99/100 photos, the first pending save occupies the final slot. The new regression initially failed because the pending-aware blocker did not exist:

`TypeError: cameraSession.isBodyFrameCameraCaptureBlocked is not a function`

The shared blocker now includes `projectPhotoCount + pendingSaveCount`, so another native capture is disabled before it creates a temporary file.

## Verification evidence
Latest verified Stage 5 code head before this documentation-only completion commit: `28698caf7cad7ba044fa8c72e381cefef4f50e6f`.

- TypeScript `tsc --noEmit`: PASS
- Expo lint: PASS
- `ok - Body Frame stage 1 data and policy contracts are enforced`
- `ok - Body Frame stage 2 project, storage, and migration contracts are enforced`
- `ok - Body Frame stage 3 camera and project contracts are enforced`
- `ok - Body Frame stage 4 exact project video contracts are enforced`
- `ok - Body Frame stage 5 plan limits are enforced`
- Functions syntax: PASS
- Firebase Rules: PASS
- Full `npm test` then reaches the existing repository baseline failure: missing `android/app/proguard-rules.pro`.
- Android Kotlin verify remains the existing baseline failure: `android\\gradlew.bat was not found. Run expo prebuild first.`
- Secret Scan/Gitleaks remains red from historical repository findings.

## Integration status
- Branch: `feat/body-frame-stage-5`
- PR: #5
- Base: `feat/body-frame-stage-4`
- Stage 4 must be merged before Stage 5 is retargeted to `main`.
