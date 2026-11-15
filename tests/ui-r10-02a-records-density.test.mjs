import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const paths = [
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx"
];
const [records, detail] = paths.map((path) => readFileSync(path, "utf8"));

test("UI-R10-02A parses and preserves existing project and photo actions", () => {
  paths.forEach((path, index) => {
    const parsed = ts.createSourceFile(path, [records, detail][index], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, path);
  });
  for (const token of ["getProjectCover(project, photos)", "getBodyProjectProgressSummary(photos, project)", "archiveBodyProject(project.id, false)", "createOnly", 'router.push("/camera")']) {
    assert.ok(records.includes(token), token);
  }
  for (const token of ["getBodyFrameComparisonPhotos(projectPhotos, project.id)", "reorderBodyProjectPhotos", "getPhotoAccessibilityMoveIndex", "importProjectPhotos", "SortableProjectPhotoTile", "PhotoPositionSheet", "openVideo"]) {
    assert.ok(detail.includes(token), token);
  }
});

test("UI-R10-02A records show readable project titles, uncropped cover and neutral progress", () => {
  assert.ok(records.includes("const coverWidth = fontScale >= 1.3"));
  assert.ok(records.includes("Math.min(144, Math.max(116"));
  assert.ok(records.includes("const highlightColor = palette.text;"));
  assert.ok(records.includes('contentFit="contain"'));
  assert.ok(records.includes("styles.projectsDescription"));
  assert.ok(records.includes("예상 영상 {formatDuration(summary.durationSeconds)}"));
  assert.match(records, /projectName:\s*\{[^}]*fontSize:\s*bodyFrameTypography\.sectionTitle/);
  assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"));
  assert.ok(records.includes('accessibilityRole="progressbar"'));
});

test("UI-R10-02A uses 2 columns on phones and 3 on tablets across drag calculations", () => {
  assert.ok(detail.includes("const PROJECT_PHOTO_PHONE_COLUMNS = 2;"));
  assert.ok(detail.includes("const PROJECT_PHOTO_TABLET_COLUMNS = 3;"));
  assert.ok(detail.includes("windowWidth >= 600"));
  assert.ok(detail.includes("gridColumns={projectPhotoGridColumns}"));
  assert.ok(detail.includes("startRow = Math.floor(index / gridColumns)"));
  assert.ok(detail.includes("targetRow * gridColumns + targetColumn"));
  assert.ok(detail.includes("Math.ceil(count / gridColumns)"));
  assert.ok(detail.includes("PROJECT_PHOTO_GRID_GAP * (projectPhotoGridColumns - 1)"));
  assert.ok(!detail.includes("PROJECT_PHOTO_GRID_COLUMNS"));
  assert.ok(detail.includes('contentFit="contain"'));
});

test("UI-R10-02A keeps compare, reorder and import actions, with photos ahead of CTAs", () => {
  const section = detail.slice(detail.indexOf('detailTab === "records" ? ('), detail.indexOf('detailTab === "metrics" ? ('));
  assert.ok(section.indexOf("styles.comparePreviewCard") < section.indexOf("styles.projectHeader"));
  assert.ok(section.indexOf("styles.projectHeader") < section.indexOf("styles.recordsSection"));
  assert.ok(section.indexOf("styles.photoGrid") < section.indexOf("styles.recordsFooterActions"));
  assert.ok(section.indexOf("styles.recordsFooterActions") < section.indexOf("styles.videoAction"));
  assert.ok(section.includes('onPress={() => void openCamera()}'));
  assert.ok(section.includes('onPress={() => void importProjectPhotos()}'));
  assert.ok(section.includes("오늘 사진 찍기") && section.includes("사진 추가"));
  assert.ok(section.includes('photoOrderMode ? "완료" : "순서 조정"'));
  assert.ok(section.includes("비교하기") && section.includes("styles.comparePreviewPair"));
  for (const token of ['id: "records"', 'id: "metrics"', 'id: "stats"']) assert.ok(detail.includes(token), token);
});

test("UI-R10-02A does not add decoration, payment logic or one-sided borders", () => {
  for (const source of [records, detail]) {
    assert.doesNotMatch(source, /border(?:Left|Right|Top|Bottom)Width\s*:/);
    assert.doesNotMatch(source, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  }
});
