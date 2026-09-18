# Body Frame Stage 7 Design

## Goal
Apply the approved Body Frame brand and monochrome product UI to the primary Android experience without destabilizing the legacy editing/settings capabilities that are still reused under the hood.

## Primary information architecture
The visible bottom navigation is exactly four tabs:
- 촬영
- 기록
- 영상
- 설정

The old Account tab is removed from the visible tab bar and remains reachable from Settings. The old Trip Clip tab becomes the visible 영상 tab. Camera keeps the bottom navigation visible.

## Brand
User-facing app name is **바디 프레임**.

Keep the existing Android application ID:
- `com.haebi.photoguide`

Keep the existing EAS project and legacy deep-link scheme for compatibility, but add `bodyframe` as the primary new scheme.

Visible permission/descriptive copy must use Body Frame wording rather than TravelFrame/travel copy.

App icon binary replacement is intentionally not part of Stage 7 because no final logo/icon artwork has been approved as a release asset. Existing icon files remain in place until Stage 8/release asset approval.

## Visual system
Dark mode is the default for new installs.

Approved dark tokens:
- background: `#0B0B0C`
- surface: `#131315`
- elevated surface: `#1A1A1D`
- border: `#2A2A2E`
- primary text: `#F5F5F5`
- secondary text: `#A0A0A6`
- disabled/faint: `#68686E`
- primary button: `#F5F5F5`
- primary button text: `#111111`

Light mode remains supported and uses the same hierarchy.

Spacing:
- horizontal page padding: 16
- section gap: 24–32
- control gap: 8–12
- touch target: minimum 44
- primary button: minimum 48 high

Radius:
- button/card: 8
- modal: 10
- bottom sheet: 12
- no default drop shadow

## Bottom navigation
Selected tab:
- primary text/icon color
- short underline indicator
- no filled icon tile

Unselected tab:
- secondary/faint color

The camera tab must no longer hide the tab bar.

## 기록 tab
Replace the visible legacy Studio tab with a Body Frame project-first record screen.

Project cards:
- project cover photo in 9:16
- project name
- current photo count / target count
- generated video duration at 0.1 seconds per photo
- reference mode label
- progress bar
- archived projects excluded by default

Selecting a project:
1. writes `lastActiveProjectId`
2. opens project detail

Empty state directs the user to create a project from the camera.

The old Studio screen is preserved behind an Advanced/legacy route for compatibility with old photo/edit work.

## Project detail
A project detail screen shows:
- cover/representative photo
- name
- current photo count / target
- estimated video duration
- first/latest reference mode
- rename
- target count edit
- archive action

Hard delete is intentionally not introduced in Stage 7 because the repository currently lacks a safe project+media deletion transaction. Archive is the destructive-safe operation for this stage.

## Settings
The visible Settings tab is a new compact Body Frame settings home with six groups:

1. 촬영
2. 저장 및 백업
3. 변화 영상
4. 화면
5. 계정 및 플랜
6. 정보 및 개인정보

The existing large SettingsScreen is preserved at `/advanced-settings` and remains the detailed control surface. This avoids losing camera-guide, backup, image/video quality and advanced appearance controls while the new Settings home establishes the approved information architecture.

The Body Frame settings home:
- shows current values where practical
- links each group to the appropriate detailed/advanced screen
- links 계정 및 플랜 to `/account`
- links privacy directly
- exposes app version
- keeps minimum 44px touch targets

## Onboarding
Replace the old travel-image multi-slide presentation with a simple monochrome Body Frame guide.

Guide content focuses on:
- project selection
- reference overlay alignment
- repeated daily recording
- progress video
- records/settings navigation

No travel-themed slide assets are used in the visible onboarding.

Increment guide version so existing users can receive the new Body Frame onboarding once.

## Video / camera visual alignment
Existing Stage 3–5 camera/project UI and Stage 4 video UI already use the approved dark palette. Stage 7 centralizes shared tokens and removes contradictory travel labels rather than rewriting working capture/video behavior.

## Compatibility
- Preserve Android package ID.
- Preserve legacy StudioScreen and SettingsScreen behind hidden/advanced routes.
- Preserve old app data and migration keys.
- Preserve Stage 1–6 business logic.
- Do not change billing product IDs.
- Do not hard-delete projects or media.
- Do not replace app icon binaries without approved release artwork.

## Verification
Stage 7 contract tests must verify:
- brand metadata
- four visible tabs
- Body Frame project records screen/detail
- six settings groups
- advanced legacy routes remain available
- new dark palette/default
- onboarding version/copy
- no Stage 1–6 regression before known repository baseline failures.
