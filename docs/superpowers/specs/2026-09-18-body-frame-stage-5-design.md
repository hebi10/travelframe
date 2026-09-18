# Body Frame Stage 5 Design

## Goal
Apply Body Frame plan limits to real project capture and exact progress-video export without changing the already established Stage 1~4 product behavior.

## Confirmed policy
- Guest / Free / Ad Remove: maximum 100 progress photos per project.
- Guest / Free / Ad Remove: maximum 10.0 seconds of Body Frame progress video.
- Pro: maximum 365 progress photos per project.
- Pro: maximum 36.5 seconds of Body Frame progress video.
- Expert: no Body Frame progress-photo or progress-video cap in the current entitlement model.
- The 100th free photo is allowed; the next capture is blocked.
- 100 photos = 10.0 seconds at 0.1 seconds/photo.
- 365 photos = 36.5 seconds.
- Free project-count enforcement is intentionally not added because the final project-count policy is still undecided.

## Architecture
Introduce a dependency-free Body Frame plan-limit helper. Camera UI derives its limit state from the active project's current photo count and current plan entitlements. The camera session carries the current project count and photo limit so the legacy camera can disable capture and the reservation layer can reject races from rapid consecutive captures.

Project-aware photo persistence must bypass the unrelated legacy global local-image-count limit. Non-project legacy save callers continue to use the old limit unchanged.

Body Frame video export validates the plan's maximum progress-video seconds immediately before rendering/saving. Existing videos and the legacy TripClip editor are untouched.

## Capture behavior
- If current photo count is below the plan limit, capture is allowed.
- If current photo count equals the limit, shutter capture is blocked.
- Pending project saves count toward the limit to prevent rapid multi-capture overflow.
- Failed saves release the reservation and do not consume the photo allowance.
- A successful save immediately advances the in-memory project photo count before the wrapper reload completes.
- The camera wrapper displays the current plan limit state and a plan-navigation action when blocked.
- Existing projects may have targets above the current plan after downgrade; their target is not mutated.

## Project creation
- 100-photo projects remain available to all current tiers.
- A preset/custom target above the current plan's max progress photos is blocked in the create-project UI.
- Expert has no target cap from this stage.
- This is a project target guard only; it does not introduce a project-count limit.

## Video behavior
- Export permission still respects existing `canExportVideo`.
- Progress-video duration is additionally limited by `maxProgressVideoSeconds`.
- If the project exceeds the current plan's video allowance, export is blocked; photos are not silently truncated.
- Upgrade copy points Free/Ad Remove/Guest users to Pro and Pro users to Expert.
- Expert has no progress-video duration cap in the current entitlement model.

## Compatibility / non-goals
- Do not implement Google Play Billing (Stage 6).
- Do not implement final branding/settings redesign (Stage 7).
- Do not change legacy TripClip weekly quota or generic local media-library limits outside Body Frame project saves.
- Do not retroactively delete photos/videos after a downgrade.
