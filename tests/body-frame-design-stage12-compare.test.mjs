import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../features/records/BodyFrameCompareScreen.tsx", import.meta.url),
  "utf8"
);

assert.match(source, /accessibilityLabel="프로젝트로 돌아가기"/);
assert.doesNotMatch(source, />돌아가기<\/Text>/);
assert.match(source, /header:\s*\{[^}]*justifyContent:\s*"center"/);
assert.match(source, /backButton:\s*\{[^}]*position:\s*"absolute"/);
assert.match(source, /heading:\s*\{[^}]*textAlign:\s*"center"/);
assert.match(source, /comparison:\s*\{[^}]*maxWidth:\s*520/);
assert.match(source, /labels:\s*\{[^}]*maxWidth:\s*520/);
assert.match(source, /dateLabels:\s*\{[^}]*maxWidth:\s*520/);
assert.match(source, /positions:\s*\{[^}]*maxWidth:\s*520/);
assert.ok(source.includes("PanResponder.create"));
assert.ok(source.includes('accessibilityRole="adjustable"'));
assert.ok(source.includes("onAccessibilityAction"));
assert.ok(source.includes('pointerEvents="none"'));
assert.ok(source.includes("changeDivider(value)"));
assert.ok(source.includes("[0.25, 0.5, 0.75]"));
assert.ok(source.includes('contentFit="contain"'));
assert.ok(source.includes("getBodyFrameComparisonPhotos"));
assert.ok(source.includes("Math.max(insets.bottom, 12)"));

console.log("Stage 12 comparison screen visual layout and controls: PASS");
