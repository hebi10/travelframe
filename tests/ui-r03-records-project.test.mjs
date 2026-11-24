import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const files = [
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx"
];
const [records, detail] = files.map((file) => readFileSync(file, "utf8"));

test("UI-R03 preserves parseable TSX and original data and navigation contracts", () => {
  for (let index = 0; index < files.length; index += 1) {
    const parsed = ts.createSourceFile(files[index], [records, detail][index], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, files[index] + " TSX parse failed");
  }
  for (const contract of [
    "getProjectCover(project, photos)",
    "getBodyProjectProgressSummary(photos, project)",
    "createOnly",
    "archiveBodyProject(project.id, false)",
    "router.push(\"/camera\")"
  ]) assert.ok(records.includes(contract), contract);

  for (const contract of [
    "sortProjectPhotos(getBodyProjectPhotos(photos, project.id))",
    "getBodyFrameComparisonPhotos(projectPhotos, project.id)",
    "reorderBodyProjectPhotos",
    "importProjectPhotos",
    "getBodyMeasurements",
    "PhotoPositionSheet",
    "openVideo",
    'id: "records", label: "기록"',
    'id: "metrics", label: "수치"',
    'id: "stats", label: "통계"'
  ]) assert.ok(detail.includes(contract), contract);
});

test("UI-R03 project list prioritizes uncropped photo and progress with existing responsive grid", () => {
  assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"));
  assert.ok(records.includes("width: projectCardWidth"));
  assert.ok(records.includes("cover.previewUri ?? cover.uri"));
  assert.match(records, /style=\{styles\.coverImage\}\s+contentFit="contain"/);
  assert.ok(records.includes('accessibilityLabel={`${project.name} 프로젝트 열기`}'));
  assert.ok(records.includes("accessibilityHint={`기록 ${summary.photoCount}장"));
  assert.ok(records.includes("기록 {summary.photoCount} / {summary.targetPhotoCount}장"));
  const card = records.slice(records.indexOf("style={styles.projectStatsRow}"), records.indexOf("</Pressable>", records.indexOf("style={styles.projectStatsRow}")));
  assert.ok(card.indexOf("styles.progressTrack") < card.indexOf("styles.projectDuration"), "progress should precede secondary video duration");
  assert.match(records, /projectMeta:\s*\{[^}]*fontWeight:\s*"600"/);
  assert.match(records, /projectPercent:\s*\{[^}]*fontSize:\s*bodyFrameTypography\.body/);
});

test("UI-R03 compact before-after preview brings the photo records higher", () => {
  const rec = detail.slice(detail.indexOf('detailTab === "records" ? ('), detail.indexOf('detailTab === "metrics" ? ('));
  assert.ok(rec.indexOf("styles.comparePreviewCard") < rec.indexOf("styles.projectHeader"));
  assert.ok(rec.indexOf("styles.projectHeader") < rec.indexOf("styles.recordsSection"));
  assert.ok(rec.includes("styles.comparePreviewPair") && rec.includes('contentFit="contain"'));
  assert.ok(rec.includes('accessibilityLabel="프로젝트 첫 사진과 마지막 사진 비교"'));
  assert.ok(rec.includes("전후 사진 비교") && rec.includes("사진을 2장 이상 기록하면 비교할 수 있습니다."));
  assert.match(detail, /comparePreviewItem:\s*\{[^}]*width:\s*72,[^}]*height:\s*110/);
  assert.match(detail, /comparePreviewCopy:\s*\{[^}]*flex:\s*1/);
  assert.ok(rec.includes("사진 추가") && rec.includes("순서 조정"));
  assert.ok(rec.includes("SortableProjectPhotoTile") && rec.includes("styles.photoGrid"));
  assert.ok(rec.includes('accessibilityRole="progressbar"'));
  assert.ok(rec.includes('accessibilityRole="button"'));
});

test("UI-R03 does not introduce decorative UI, new data behavior or deployment code", () => {
  for (const source of [records, detail]) {
    assert.doesNotMatch(source, /border(?:Top|Right|Bottom|Left)Width\s*:/);
    assert.doesNotMatch(source, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
    assert.doesNotMatch(source, /purchaseUpdatedListener|playConsole|firebase deploy/);
  }
});
