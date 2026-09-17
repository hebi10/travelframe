# Body Frame Stage 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Body Frame projects to the existing MP4 renderer with exact 0.1s/photo, 30fps, 3 frames/photo, 9:16 output and project-linked saved videos.

**Architecture:** Add a dependency-free Body Frame video policy/helper module, a thin video-tab project resolver wrapper, and a locked Body Frame mode inside `TripClipScreen`. Reuse the current recorder, export, backup and saved-video pipeline; do not replace the mature renderer or alter legacy non-project TripClip behavior.

**Tech Stack:** TypeScript, Expo Router, React Native, react-native-view-recorder wrapper, Expo FileSystem, existing TripClip renderer/export pipeline, Node `.mjs` contract tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-body-frame-stage-4-design.md`

## Global Constraints
- Android-first; no iOS work.
- 0.1 seconds per project photo.
- 30fps.
- exactly 3 frames per photo.
- 9:16.
- maximum 1080x1920.
- default transition `none`, transition duration 0.
- MP4/H.264 output.
- Preserve legacy TripClip and old made-video compatibility.
- Stage 5 limits/upgrade, Stage 6 billing and Stage 7 final redesign are out of scope.

---

### Task 1: Lock Stage 4 contracts with RED tests
**Files:**
- Create: `tests/03-body-frame-stage-4.test.mjs`

- [ ] Write pure-policy assertions for 100 and 365 photos.
- [ ] Assert project filtering/order and 0.1-second duration map.
- [ ] Assert video tab uses Body Frame project resolver wrapper.
- [ ] Assert TripClip Body Frame mode uses fixed FPS/frame count/ratio/transition and projectId persistence.
- [ ] Open draft PR and verify RED before production code exists.

### Task 2: Add Body Frame video policy helpers
**Files:**
- Create: `lib/body-frame-video.ts`

**Interfaces:**
- `getBodyFrameVideoPhotos(photos, projectId)`
- `createBodyFrameVideoDurations(photos)`
- `getBodyFrameVideoDuration(photoCount)`
- `getBodyFrameVideoTotalFrames(photoCount)`
- exported fixed policy constants

- [ ] Implement deterministic project photo ordering.
- [ ] Implement integer frame count and duration helpers.
- [ ] Verify Stage 4 helper tests GREEN.

### Task 3: Add project-aware video tab entry
**Files:**
- Create: `features/trip-clip/BodyFrameVideoScreen.tsx`
- Modify: `app/(tabs)/trip-clip.tsx`

- [ ] Resolve last active non-archived project on focus.
- [ ] Persist fallback project when needed.
- [ ] Render a minimal empty state when no project exists.
- [ ] Render `TripClipScreen` with `bodyFrameProjectId` for the active project.

### Task 4: Add locked Body Frame mode to TripClip renderer
**Files:**
- Modify: `features/trip-clip/TripClipScreen.tsx`

- [ ] Add optional `bodyFrameProjectId` prop and Body Frame mode flag.
- [ ] In Body Frame mode, filter/sort all photos from the active project and select them automatically.
- [ ] Force effective 0.1-second durations, 9:16, minimal template, none transition, 0 transition duration and MP4.
- [ ] Skip draft restore/autosave that could override fixed Body Frame policy.
- [ ] Use 30fps and exact `photoCount * 3` total frames for recording.
- [ ] Hide timeline/video/guide/music controls that could violate the fixed policy.
- [ ] Keep legacy behavior unchanged when `bodyFrameProjectId` is absent.

### Task 5: Persist project linkage on saved videos
**Files:**
- Modify: `types/video.ts`
- Modify: `lib/video-library.ts`
- Modify: `features/trip-clip/TripClipScreen.tsx`

- [ ] Add optional `projectId` to `MadeVideoItem`.
- [ ] Normalize existing/legacy videos without a project ID safely.
- [ ] Include Body Frame project ID in save/update payloads.

### Task 6: Verification and review
- [ ] Typecheck PASS.
- [ ] Lint PASS.
- [ ] Stage 1/2/3/4 contracts PASS before repository baseline failure.
- [ ] Functions PASS.
- [ ] Firebase Rules PASS.
- [ ] Confirm known `android/app/proguard-rules.pro`, Android Kotlin and historical Secret Scan baseline failures are unchanged.
- [ ] Review diff for Stage 5+ scope creep.
- [ ] Keep PR against `main` until merge is requested.
