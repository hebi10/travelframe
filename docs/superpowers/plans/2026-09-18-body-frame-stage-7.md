# Body Frame Stage 7 Implementation Plan

> **Execution rule:** implement with TDD and preserve legacy advanced surfaces rather than rewriting stable Stage 1–6 functionality.

**Goal:** Apply Body Frame branding, project-first records UX, approved 4-tab navigation, six-group settings home, and monochrome visual system.

**Spec:** `docs/superpowers/specs/2026-09-18-body-frame-stage-7-design.md`

## Task 1 — RED contract
- [x] Add `tests/06-body-frame-stage-7.test.mjs`.
- [x] Assert Body Frame app metadata/package compatibility.
- [x] Assert exact four visible tabs and hidden Account route.
- [x] Assert records and project detail screens.
- [x] Assert six settings groups and advanced-settings compatibility route.
- [x] Assert approved dark palette/default theme.
- [x] Assert onboarding v2 has no travel slide assets.
- [x] Open draft PR and verify RED before production implementation.

## Task 2 — Brand metadata and tokens
- [x] Rename app display metadata to 바디 프레임.
- [x] Replace visible permission copy.
- [x] Add `bodyframe` scheme while preserving old scheme/package.
- [x] Add approved Body Frame dark tokens.
- [x] Set default theme to dark.
- [x] Preserve light mode.
- [x] Update public/admin privacy page branding while keeping legacy Firebase URLs and internal identifiers compatible.
- [x] Keep existing icon binaries until final release artwork approval.

## Task 3 — Four-tab navigation
- [x] Visible tabs: 촬영 / 기록 / 영상 / 설정.
- [x] Hide Account tab from bottom navigation.
- [x] Make 영상 tab visible.
- [x] Keep camera tab bar visible.
- [x] Add video glyph and short active underline.
- [x] Remove filled active icon tile.
- [x] Preserve the existing 58px + safe-area bottom spacing contract to avoid clipping legacy screens.

## Task 4 — Records screen
- [x] Add `BodyFrameRecordsScreen`.
- [x] Route visible studio tab to the records screen.
- [x] Project-first photo cards with 9:16 cover, progress/count/duration/reference mode.
- [x] Empty state and capture CTA.
- [x] Persist selected project before detail navigation.
- [x] Add archived-project list and safe restore.
- [x] Preserve old Studio screen at hidden `/legacy-studio`.

## Task 5 — Project detail
- [x] Add dynamic project detail route.
- [x] Show cover, progress, duration and reference mode.
- [x] Rename project.
- [x] Edit target.
- [x] Switch first/latest reference mode.
- [x] Archive with destructive confirmation.
- [x] No unsafe hard delete in Stage 7.
- [x] Apply Stage 5 plan target limits when the target is actually changed.
- [x] Preserve grandfathered over-limit targets after downgrade so users can still rename/manage existing projects.
- [x] Hide upgrade prompts when an over-limit grandfathered target is left unchanged.

## Task 6 — Settings information architecture
- [x] Add `BodyFrameSettingsScreen`.
- [x] Six approved settings groups.
- [x] Route Account/plan to hidden Account screen.
- [x] Route detailed controls to `/advanced-settings`.
- [x] Direct privacy link and app version.
- [x] Preserve old SettingsScreen as advanced settings.
- [x] Preserve legacy editing library access from the information section.

## Task 7 — Onboarding
- [x] Increment guide version to 2.
- [x] Rewrite guide steps for Body Frame.
- [x] Replace image-heavy travel overlay with simple monochrome modal/steps.
- [x] Remove visible dependency on old travel slide image assets.

## Task 8 — Visible copy cleanup
- [x] Remove TravelFrame/travel wording from primary app metadata and Body Frame routes.
- [x] Change visible Studio/Trip Clip naming to 기록/변화 영상 where applicable.
- [x] Update related Account/advanced settings/privacy copy to Body Frame language.
- [x] Do not rename internal storage/package identifiers in Stage 7.

## Task 9 — Verification
- [x] Typecheck PASS.
- [x] Lint PASS.
- [x] Stage 1–7 contracts PASS before known repository baseline failure.
- [x] Existing Account/Admin regression tests reached before baseline remain PASS.
- [x] Functions PASS.
- [x] Firebase Rules PASS.
- [x] Confirm Android prebuild and historical Secret Scan failures remain baseline-only.
- [x] Diff review for Stage 8 release-scope creep.
- [x] Keep PR #7 against main until merge requested.

## Verification evidence

Latest verified code head before this documentation-only completion commit:

`aeed86b6506316841a81646c1f5399e62363d69c`

- TypeScript `tsc --noEmit`: PASS
- Expo lint: PASS
- `ok - Body Frame stage 1 data and policy contracts are enforced`
- `ok - Body Frame stage 2 project, storage, and migration contracts are enforced`
- `ok - Body Frame stage 3 camera and project contracts are enforced`
- `ok - Body Frame stage 4 exact project video contracts are enforced`
- `ok - Body Frame stage 5 plan limits are enforced`
- `ok - Body Frame stage 6 Google Play Billing contracts are enforced`
- `ok - Body Frame stage 7 brand and primary UX contracts are enforced`
- Account billing/backup/dark-mode tests reached before the baseline Android test: PASS
- Admin subscription/backup/tab tests reached before the baseline Android test: PASS
- Functions syntax: PASS
- Firebase Rules: PASS

## Existing repository baseline failures
Unchanged from Stages 1–6:
- Full `npm test` proceeds through Stage 1–7 and the earlier account/admin tests, then stops because `android/app/proguard-rules.pro` is absent.
- Android Kotlin verification stops because `android\\gradlew.bat` is absent and the workflow requires Expo prebuild.
- Historical Gitleaks continues to report four findings from old `firebase-debug.log` commits (including commit `4e7ae056...`); no new Stage 7 source secret was reported.

## Integration status
- Branch: `feat/body-frame-stage-7`
- PR: #7
- Base: `main`
- Draft and unmerged until explicitly requested.
- Final launcher/icon artwork replacement remains a Stage 8/release asset task because no approved binary icon artwork was supplied.
