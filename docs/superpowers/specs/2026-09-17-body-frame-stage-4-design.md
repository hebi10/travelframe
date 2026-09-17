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
- project photos are ordered by positive `sequence`, then deterministic fallback ordering for malformed legacy records
- 100 photos = 300 frames = 10.0 seconds
- 365 photos = 1095 frames = 36.5 seconds

## Architecture
Keep the mature TripClip renderer/export path for compatibility, but introduce a Body Frame video policy layer. The video tab resolves the last active non-archived Body Frame project and invokes the existing TripClip editor in a locked Body Frame mode.

Body Frame mode must not mutate global legacy TripClip defaults. Legacy made-video editing and non-project TripClip flows continue to use existing durations, transitions, ratios and 24fps behavior.

## Body Frame mode behavior
- The video tab resolves the last active project with the same fallback used by the camera.
- All photos belonging to that project are selected automatically.
- Body Frame mode forces effective duration to 0.1 seconds per selected photo.
- Body Frame mode forces 9:16, `minimal`, `none`, transition duration 0 and MP4 export.
- Recording uses 30fps and exact integer frame count (`photoCount * 3`) instead of deriving the frame count from floating-point duration math.
- Timeline/video-style controls that could violate the fixed policy are not exposed in Body Frame mode.
- Saved videos retain an optional `projectId` so later project detail pages can query project-specific videos.
- Existing non-project TripClip behavior remains unchanged.

## Empty project state
If there is no active project, the video tab shows a simple empty state telling the user to create or select a project from the camera screen. If the active project has no photos, the Body Frame editor remains usable as an empty project state but cannot export.

## Compatibility and non-goals
- Do not implement Stage 5 photo/video entitlement limits here.
- Do not implement Play Billing here.
- Do not remove old TripClip templates/transitions from storage types; old saved videos must still deserialize.
- Do not mass-migrate old videos.
- Final branding/polish belongs to Stage 7; Stage 4 only applies the minimal Body Frame video entry surface needed to enforce the policy.
