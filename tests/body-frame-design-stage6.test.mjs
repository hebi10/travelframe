import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { inflateSync } from "node:zlib";

const read = (path) => fs.readFileSync(path, "utf8");
const theme = read("constants/app-theme.ts");
const artwork = read("components/app-guide-card.tsx");
const capture = read("scripts/capture-android-qa.py");
const workflow = read(".github/workflows/body-frame-device-qa.yml");
const checker = read("scripts/check-stage6-visual-artifacts.py");
const assetReadme = read("assets/ui/README.md");

const checkPngIntegrity = (buffer, filename) => {
  let offset = 8;
  const idatChunks = [];
  let sawEnd = false;
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let i = 0; i < 8; i += 1) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    assert.ok(end <= buffer.length, filename + " truncated PNG chunk");
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 4, offset + 8 + length);
    assert.equal(buffer.readUInt32BE(offset + 8 + length), crc32(chunk), filename + " invalid " + type + " CRC");
    if (type === "IDAT") idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset = end;
    if (type === "IEND") { sawEnd = true; break; }
  }
  assert.ok(sawEnd && offset === buffer.length, filename + " needs a complete IEND chunk");
  assert.ok(idatChunks.length > 0, filename + " lacks IDAT pixels");
  assert.ok(inflateSync(Buffer.concat(idatChunks)).length > 0, filename + " IDAT failed to inflate");
};

const imageFiles = [
  "empty-project", "empty-photos", "empty-videos", "empty-metrics",
  "feature-capture", "feature-records", "feature-compare", "feature-video",
  "feature-backup"
];
for (const asset of imageFiles) {
  const buf = fs.readFileSync("assets/ui/illustrations/" + asset + ".png");
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", asset + " must remain a real PNG");
  assert.equal(buf.subarray(12, 16).toString(), "IHDR");
  checkPngIntegrity(buf, asset);
  assert.ok(buf.readUInt32BE(16) >= 64 && buf.readUInt32BE(20) >= 64, "artwork too small");
}
const optimizedBackup = fs.statSync("assets/ui/illustrations/feature-backup.png").size;
assert.ok(optimizedBackup < 25000 && optimizedBackup > 1000);
const backupBytes = fs.readFileSync("assets/ui/illustrations/feature-backup.png");
assert.ok(backupBytes.readUInt32BE(16) >= 300 && backupBytes.readUInt32BE(20) >= 300);
assert.ok(assetReadme.includes("Font Awesome Free") && assetReadme.includes("CC BY 4.0"));
assert.ok(artwork.includes("getAppGuideArtwork(step.id)"));
const screenshotArtwork = read("constants/app-guide-artwork.ts");
assert.ok(screenshotArtwork.includes('"body-frame-settings-backup"'));
assert.ok(screenshotArtwork.includes('"body-frame-settings"'));
assert.ok(artwork.includes("accessible={false}"));
assert.ok(artwork.includes("bodyFrameTypography.projectTitle"));
assert.ok(artwork.includes("bodyFrameTypography.button"));

const backScreens = [
  "app/photo/[id].tsx", "app/video/[id].tsx",
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/records/BodyMeasurementHistoryScreen.tsx"
];
for (const file of backScreens) {
  const src = read(file);
  const parsed = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0, file + " must parse");
  assert.ok(src.includes('<Feather name="chevron-left" size={bodyFrameDesign.iconSize}'), file + " must use shared 20dp icon");
  assert.ok(src.includes("bodyFrameDesign.minTouchSize"), file + " must retain >=44dp tap target");
}
assert.ok(theme.includes("iconSize: 20"));
assert.ok(read("components/tab-glyph.tsx").includes("size={bodyFrameDesign.iconSize}"));

for (const token of [
  "DESIGN_PROFILES = [", "'phone-360dp'", "'phone-412dp'",
  "'tablet-600dp'", "'tablet-750dp'", "DESIGN_VARIANTS = [",
  "'dark-100'", "'light-130'", "'dark-150'", "'light-150'",
  "def capture_design_matrix(", "scenario == 'visual'",
  "themeMode=theme_mode", "system_scale",
  "device.shell('svc', 'wifi', 'disable')",
  "device.shell('svc', 'data', 'disable')",
  "if device.shell('getprop', 'ro.kernel.qemu').strip() != '1'",
  "'designGuideMatchRequiresVisualReview': True",
  "onboarding-large-font", "empty-projects"
]) assert.ok(capture.includes(token), "native capture guard missing: " + token);
assert.ok(workflow.includes("stage6-design-matrix:"));
assert.ok(workflow.includes("needs: build-apk"));
assert.ok(workflow.includes("--scenario visual"));
assert.ok(workflow.includes("body-frame-stage6-visual-qa-"));
assert.ok(workflow.includes("scripts/check-stage6-visual-artifacts.py"));
assert.ok(checker.includes("expected_keys") && checker.includes("design PNG"));
assert.ok(!workflow.includes("secrets.ANDROID_KEYSTORE_BASE64"), "QA workflow must remain separate from Play signing");
console.log("ok - Stage 6 assets, icons, Android visual matrix and guardrails");
