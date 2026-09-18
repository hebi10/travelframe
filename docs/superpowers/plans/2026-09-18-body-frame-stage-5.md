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

- [ ] Test capture limit boundary: 99→allowed, 100→blocked for Free.
- [ ] Test Pro 364→allowed, 365→blocked.
- [ ] Test Expert null limit stays allowed.
- [ ] Test video duration boundary and upgrade tier resolution.
- [ ] Source-check camera session, camera wrapper, legacy camera block, project-aware save cap bypass and video export guard.
- [ ] Open stacked draft PR and verify RED.

### Task 2: Pure plan-limit helpers
**Files:**
- Create: `lib/body-frame-plan-limits.ts`

- [ ] Add capture limit state helper.
- [ ] Add progress-video limit state helper.
- [ ] Add project-target allowance helper.
- [ ] Add next upgrade tier/label helper.

### Task 3: Camera session hard limit
**Files:**
- Modify: `lib/body-frame-camera-session.ts`
- Modify: `features/camera/BodyFrameCameraScreen.tsx`
- Modify: `features/camera/CameraScreen.tsx`

- [ ] Add `projectPhotoCount`, `maxProgressPhotos`, `captureBlockedReason` to session.
- [ ] Reject reservation when count + pending saves reaches limit.
- [ ] Increment in-memory count only on successful finish.
- [ ] Make legacy shutter/timer check Body Frame blocked state.
- [ ] Display limit/upgrade state in wrapper.

### Task 4: Project-aware persistence compatibility
**Files:**
- Modify: `lib/photo-library.ts`

- [ ] For a reserved Body Frame save, clear `localImageLimit` before delegating to the legacy render/save path.
- [ ] Preserve legacy local-image limits for non-project callers.
- [ ] Keep existing rollback behavior.

### Task 5: Project target guard
**Files:**
- Modify: `features/camera/BodyFrameProjectSwitcher.tsx`
- Modify: `features/camera/BodyFrameCameraScreen.tsx`

- [ ] Disable preset targets above current plan allowance.
- [ ] Validate custom targets before submit.
- [ ] Expose plan navigation action when a larger target requires upgrade.

### Task 6: Video export enforcement
**Files:**
- Modify: `features/trip-clip/BodyFrameVideoScreen.tsx`

- [ ] Derive video limit state from `maxProgressVideoSeconds`.
- [ ] Block render/save above allowance.
- [ ] Show current plan limit and upgrade action.
- [ ] Keep exact Stage 4 timing/render policy unchanged.

### Task 7: Verification
- [ ] Typecheck PASS.
- [ ] Lint PASS.
- [ ] Stage 1~5 contracts PASS before repository baseline failure.
- [ ] Functions PASS.
- [ ] Firebase Rules PASS.
- [ ] Confirm existing Android/prebuild and historical Secret Scan baseline failures are unchanged.
- [ ] Review diff for Stage 6+ scope creep.
- [ ] Keep stacked PR based on Stage 4 until merge is requested.
