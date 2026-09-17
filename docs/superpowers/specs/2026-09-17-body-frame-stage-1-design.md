# Body Frame Stage 1 Design

## Goal
Define the data and policy foundation required to convert TravelFrame into Body Frame without changing the UI yet.

## Scope
- Add a `BodyProject` domain type and `ReferencePhotoMode` (`first | latest`).
- Extend `PhotoItem` with optional `projectId` and `sequence` so legacy stored photos remain readable before migration.
- Add pure normalization helpers for reference mode, legacy photo project fields, and last active project IDs.
- Add a storage wrapper for `lastActiveProjectId` using the existing local storage adapter.
- Add semantic Body Frame entitlement fields while retaining existing TravelFrame entitlement fields for compatibility.
- Define fixed Stage 1 media policies: 2560px / JPEG 0.85 app image, 1080px / JPEG 0.74 preview, 0.1s per photo, 30fps, free 100 photos / 10 seconds.
- Wire stored photo parsing through the new normalization helper.

## Compatibility Rules
- Existing `travel-frame.photos.v1` data must still parse when `projectId` and `sequence` are absent.
- Existing storage keys are not deleted or renamed in Stage 1.
- Existing entitlement fields remain available; new Body Frame fields are additive.
- `maxProjectCount` remains nullable because the free-project-count policy is not final yet.
- Pro supports at least 365 progress photos / 36.5 seconds; Expert remains open-ended at this stage.

## Out of Scope
- Project CRUD UI and project-specific folders.
- Physical file migration into per-project directories.
- Camera project switcher and automatic reference overlay.
- Actual image re-encoding policy replacement in the photo save pipeline.
- Progress video rendering changes.
- Play Billing implementation.
- Branding and visual redesign.

## Verification
- Stage 1 contract tests cover constants and legacy normalization behavior.
- Typecheck, lint, existing tests, and secret scan must pass before completion.
