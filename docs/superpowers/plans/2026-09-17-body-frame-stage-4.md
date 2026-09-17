# Body Frame Stage 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Body Frame projects to an exact MP4 renderer with 0.1s/photo, 30fps, 3 frames/photo, 9:16 output and project-linked saved videos.

**Architecture:** Add a dependency-free Body Frame video policy/helper module and a standalone `BodyFrameVideoScreen`. Reuse the proven lower-level `TripClipRecordingCanvas`, `getRecordingFrame`, native view recorder wrapper, video export and made-video library while leaving the large legacy `TripClipScreen` untouched. This isolates Body Frame fixed timing from the legacy editor’s 24fps, long durations, transitions, drafts and music controls.

**Tech Stack:** TypeScript, Expo Router, React Native, react-native-view-recorder wrapper, Expo FileSystem, existing TripClip recording canvas/export pipeline, Node `.mjs` contract tests, GitHub Actions.

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

- [x] Write pure-policy assertions for 100 and 365 photos.
- [x] Assert project filtering/order and 0.1-second duration map.
- [x] Assert video tab uses Body Frame project screen.
- [x] Assert standalone renderer uses fixed FPS/frame count/ratio/transition and projectId persistence.
- [x] Open draft PR and verify initial RED (`lib/body-frame-video.ts` missing) before production code.
- [x] Add malformed legacy ordering regression and verify RED before the comparator fix.

### Task 2: Add Body Frame video policy helpers
**Files:**
- Create: `lib/body-frame-video.ts`

**Interfaces:**
- `getBodyFrameVideoPhotos(photos, projectId)`
- `createBodyFrameVideoDurations(photos)`
- `getBodyFrameVideoDuration(photoCount)`
- `getBodyFrameVideoTotalFrames(photoCount)`
- exported fixed policy constants

- [x] Implement deterministic project photo ordering.
- [x] Keep valid positive sequences ahead of malformed legacy records.
- [x] Implement integer frame count and duration helpers.

### Task 3: Add project-aware video tab entry
**Files:**
- Create: `features/trip-clip/BodyFrameVideoScreen.tsx`
- Modify: `app/(tabs)/trip-clip.tsx`

- [x] Resolve last active non-archived project on focus.
- [x] Persist fallback project when needed.
- [x] Render a minimal empty state when no project exists.
- [x] Load only the active project’s photos in deterministic sequence order.
- [x] Route the video tab to `BodyFrameVideoScreen`.

### Task 4: Build the standalone exact Body Frame renderer
**Files:**
- Modify: `features/trip-clip/BodyFrameVideoScreen.tsx`
- Reuse: `components/trip-clip-recording-canvas.tsx`
- Reuse: `lib/trip-clip-playback.ts`
- Reuse: `lib/view-recorder.tsx`
- Reuse: `lib/trip-clip-export.ts`

- [x] Force 0.1-second durations, 9:16, minimal template, none transition and transition duration 0.
- [x] Use 30fps and exact `photoCount * 3` total frames.
- [x] Record H.264 MP4 at 1080x1920 and 5 Mbps.
- [x] Verify generated cache file exists before saving.
- [x] Save through the existing device video export path.
- [x] Expose a minimal summary UI and one primary `영상 만들기` action.
- [x] Keep legacy `TripClipScreen` untouched.

### Task 5: Persist project linkage on saved videos
**Files:**
- Modify: `types/video.ts`
- Use existing: `lib/video-library.ts`
- Modify: `features/trip-clip/BodyFrameVideoScreen.tsx`

- [x] Add optional `projectId` to `MadeVideoItem`.
- [x] Preserve old videos without a project ID because the field is optional.
- [x] Include active Body Frame project ID in the saved video payload.

### Task 6: Verification and review
- [ ] Typecheck PASS on final Stage 4 head.
- [ ] Lint PASS on final Stage 4 head.
- [ ] Stage 1/2/3/4 contracts PASS before repository baseline failure.
- [ ] Functions PASS.
- [ ] Firebase Rules PASS.
- [ ] Confirm known `android/app/proguard-rules.pro`, Android Kotlin and historical Secret Scan baseline failures are unchanged.
- [ ] Review diff for Stage 5+ scope creep.
- [ ] Keep PR against `main` until merge is requested.
