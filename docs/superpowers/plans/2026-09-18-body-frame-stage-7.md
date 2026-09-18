# Body Frame Stage 7 Implementation Plan

> **Execution rule:** implement with TDD and preserve legacy advanced surfaces rather than rewriting stable Stage 1–6 functionality.

**Goal:** Apply Body Frame branding, project-first records UX, approved 4-tab navigation, six-group settings home, and monochrome visual system.

**Spec:** `docs/superpowers/specs/2026-09-18-body-frame-stage-7-design.md`

## Task 1 — RED contract
- [ ] Add `tests/06-body-frame-stage-7.test.mjs`.
- [ ] Assert Body Frame app metadata/package compatibility.
- [ ] Assert exact four visible tabs and hidden Account route.
- [ ] Assert records and project detail screens.
- [ ] Assert six settings groups and advanced-settings compatibility route.
- [ ] Assert approved dark palette/default theme.
- [ ] Assert onboarding v2 has no travel slide assets.
- [ ] Open draft PR and verify RED.

## Task 2 — Brand metadata and tokens
- [ ] Rename app display metadata to 바디 프레임.
- [ ] Replace visible permission copy.
- [ ] Add `bodyframe` scheme while preserving old scheme/package.
- [ ] Add approved Body Frame dark tokens.
- [ ] Set default theme to dark.
- [ ] Preserve light mode.

## Task 3 — Four-tab navigation
- [ ] Visible tabs: 촬영 / 기록 / 영상 / 설정.
- [ ] Hide Account tab from bottom navigation.
- [ ] Make 영상 tab visible.
- [ ] Keep camera tab bar visible.
- [ ] Add video glyph and short active underline.
- [ ] Remove filled active icon tile.

## Task 4 — Records screen
- [ ] Add `BodyFrameRecordsScreen`.
- [ ] Route visible studio tab to the records screen.
- [ ] Project-first photo cards with progress/count/duration/reference mode.
- [ ] Empty state.
- [ ] Persist selected project before detail navigation.
- [ ] Preserve old Studio screen at hidden `/legacy-studio`.

## Task 5 — Project detail
- [ ] Add dynamic project detail route.
- [ ] Show cover, progress, duration and reference mode.
- [ ] Rename project.
- [ ] Edit target.
- [ ] Switch first/latest reference mode.
- [ ] Archive with destructive confirmation.
- [ ] No unsafe hard delete in Stage 7.

## Task 6 — Settings information architecture
- [ ] Add `BodyFrameSettingsScreen`.
- [ ] Six approved settings groups.
- [ ] Route Account/plan to hidden Account screen.
- [ ] Route detailed controls to `/advanced-settings`.
- [ ] Direct privacy link and app version.
- [ ] Preserve old SettingsScreen unchanged as advanced settings.

## Task 7 — Onboarding
- [ ] Increment guide version.
- [ ] Rewrite guide steps for Body Frame.
- [ ] Replace image-heavy travel overlay with simple monochrome modal/steps.
- [ ] Remove visible dependency on old travel slide image assets.

## Task 8 — Visible copy cleanup
- [ ] Remove TravelFrame/travel wording from primary app metadata and visible Body Frame routes.
- [ ] Change visible Studio/Trip Clip naming to 기록/변화 영상 where applicable.
- [ ] Do not rename internal storage/package identifiers in Stage 7.

## Task 9 — Verification
- [ ] Typecheck PASS.
- [ ] Lint PASS.
- [ ] Stage 1–7 contracts PASS before known repository baseline failure.
- [ ] Functions PASS.
- [ ] Firebase Rules PASS.
- [ ] Confirm Android prebuild and historical Secret Scan failures remain baseline-only.
- [ ] Diff review for Stage 8 release-scope creep.
- [ ] Keep PR against main until merge requested.
