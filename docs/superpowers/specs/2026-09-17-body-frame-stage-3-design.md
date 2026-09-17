# Body Frame Stage 3 Design

## Goal
Connect the Body Frame project model to the real camera experience: active-project switching, automatic first/latest reference-photo selection, project-aware capture sequencing, and project-scoped saves.

## Scope
- Add a compact project switcher to the top of the camera screen.
- Show current project name plus progress summary (`74 / 100 · 7.4초`).
- Open a dark bottom-sheet style project picker from the camera header.
- Allow creating a project from the picker with name, target count, and reference mode.
- Persist the selected project through `lastActiveProjectId`.
- Resolve an active project on camera focus: last-active non-archived project first, otherwise the first non-archived project.
- If no project exists, allow creating the first project without leaving the camera flow.
- Resolve the next project sequence as `max(sequence) + 1`.
- Auto-select the reference photo per project:
  - `latest`: highest sequence / newest project photo.
  - `first`: lowest sequence / first project photo.
- First project photo has no automatic reference overlay.
- On project change, update project progress, recent thumbnail, next record number, and reference overlay together.
- Capture saves include the active `projectId` and `sequence` and are written through the Stage 2 project storage policy.
- After a successful save, refresh the project state so the next capture number and reference image advance immediately.
- Keep the existing manual photo-overlay picker as an explicit override tool; switching projects restores the automatic project reference.

## Camera UX
Header layout:
- Project switcher row: folder icon + project name + chevron.
- Status line below: `<count> / <target> · <duration>초`.
- Existing quick camera controls stay available below/alongside the compact project header.

Project picker:
- Title: `프로젝트 선택`.
- Each row shows project name and `<photoCount>장 · <duration>초`.
- Current project has a selected state/checkmark.
- Actions: `+ 새 프로젝트`, `프로젝트 관리` placeholder/entry point.
- Project switching is disabled while native capture or queued save is active.

Project creation:
- Name defaults to `새 프로젝트`.
- Target presets: 100, 365, custom positive integer.
- Reference mode defaults to `latest`.
- `latest` copy: `바로 전 사진과 맞춥니다.`
- `first` copy: `첫 번째 사진과 계속 맞춥니다.`

Capture status:
- Before capture: `오늘 <nextSequence>번째 기록`.
- First photo: `첫 사진을 찍어 기준을 만들어주세요.`
- After save: non-blocking in-screen status/snackbar text `<sequence>번째 사진을 저장했습니다.`

## Data Rules
- `BodyProject.id` is the canonical project key.
- A project photo must store both `projectId` and positive integer `sequence`.
- Sequence values are stable identifiers for capture order and are not renumbered after deletion.
- Next sequence is `max(existing valid sequence) + 1`, defaulting to 1.
- Progress count is the number of photos currently assigned to the project, not the max sequence.
- Progress video duration preview is `photoCount * 0.1` seconds.
- Archived projects are hidden from the normal camera switcher.

## Storage Integration
`saveCapturedPhoto()` becomes project-aware when both `projectId` and `sequence` are provided:
- Render ratio/color adjustment first.
- Store the final local image through `storeBodyFramePhotoFile()`.
- Persist the returned project URI/preview URI and optimization metadata in `travel-frame.photos.v1`.
- Preserve the existing root `photos/<id>.jpg` fallback for non-project callers elsewhere in the legacy app.

This allows Stage 3 camera captures to use project folders without breaking Studio/import/other legacy callers.

## Reference Photo Resolution
A dependency-free helper module owns deterministic project-camera calculations:
- `selectActiveBodyProject(projects, lastActiveProjectId)`.
- `getBodyProjectPhotos(photos, projectId)`.
- `getNextBodyProjectSequence(photos, projectId)`.
- `selectBodyProjectReferencePhoto(photos, project)`.
- `getBodyProjectProgressSummary(photos, project)`.

Reference URI preference:
1. local `uri` when available.
2. `downloadURL` / remote `uri` for cloud-only photos.

## Failure / Concurrency Rules
- Project switching is blocked while a photo is being captured or queued for save.
- A captured job snapshots the project ID and sequence at shutter time so switching later cannot reassign it.
- Save failure must not advance the visible project count/sequence.
- Project state is refreshed only after successful app save.
- Project creation failure leaves the current project unchanged.

## Out of Scope
- Full project management/detail screen redesign.
- Project deletion/archive UI beyond repository APIs.
- First-install welcome redesign.
- Free 90/99/100 limit UX and upgrade modal (Stage 5).
- Progress-video renderer changes (Stage 4).
- Play Billing and final branding/settings redesign.

## Verification
- Stage 3 contract test covers active-project selection, next-sequence calculation, reference selection, and progress summary.
- Source assertions verify project switcher wiring and project-aware camera save input.
- Typecheck and lint pass.
- Existing repository baseline failures are documented separately if unchanged.