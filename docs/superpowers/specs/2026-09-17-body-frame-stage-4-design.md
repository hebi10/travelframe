# Body Frame Stage 4 Design

## Goal
Body Frame 프로젝트의 사진을 프로젝트 순서대로 사용해, 사진 1장당 정확히 0.1초씩 표시되는 30fps 세로형 MP4 변화 영상을 만든다.

## Fixed video policy
- photo duration: 0.1 seconds
- output FPS: 30
- frames per photo: exactly 3
- ratio: 9:16
- maximum output size: 1080x1920
- default transition: none
- transition duration: 0
- output: MP4 / H.264
- valid positive `sequence` records are ordered first; malformed legacy records follow deterministically by createdAt/id
- 100 photos = 300 frames = 10.0 seconds
- 365 photos = 1095 frames = 36.5 seconds

## Architecture
Keep the mature legacy `TripClipScreen` untouched. The Body Frame video tab uses a dedicated `BodyFrameVideoScreen` and reuses only the proven lower-level rendering/export pieces: `TripClipRecordingCanvas`, `getRecordingFrame`, the optional native view recorder, `saveVideoToLibrary`, and `saveMadeVideo`.

This avoids changing legacy TripClip durations, transitions, ratios, drafts, music, timeline editing, and 24fps behavior while giving Body Frame an exact fixed-policy renderer.

## Body Frame video screen behavior
- The video tab resolves the last active non-archived project with the same fallback used by the camera.
- All photos belonging to that project are loaded and ordered automatically.
- Effective duration is fixed at 0.1 seconds per photo.
- Rendering is fixed to 9:16, `minimal`, `none`, transition duration 0, MP4/H.264.
- Recording uses 30fps and exact integer frame count (`photoCount * 3`) instead of floating-point duration-derived frame counts.
- Output is fixed at 1080x1920 in Stage 4; Stage 5 may later gate quality/limits by plan.
- The screen exposes only the information required for a fixed Body Frame video: photo count, interval, duration, frame count, quality, ratio, transition, and a primary create button.
- Saved videos retain optional `projectId` metadata so later project-detail screens can query project-specific videos.
- Existing non-project TripClip behavior remains unchanged.

## Empty project state
If there is no active project, the video tab shows a simple empty state telling the user to create or select a project from the camera screen. If the active project has no photos, the preview and summary remain visible but video creation is disabled.

## Failure and compatibility behavior
- The generated MP4 is first written to cache, verified to exist, then copied to the normal device video export path and registered in the existing made-video library.
- Existing saved videos without `projectId` remain valid because the new field is optional and the video library already preserves additional stored metadata when normalizing records.
- Old TripClip templates/transitions remain supported for existing saved videos.

## Non-goals
- Do not implement Stage 5 photo/video entitlement limits beyond respecting the existing `canExportVideo`/local-video capability hooks.
- Do not implement Play Billing here.
- Do not mass-migrate old videos.
- Do not replace the legacy TripClip editor.
- Final branding/watermark copy and broader visual polish belong to Stage 7.
