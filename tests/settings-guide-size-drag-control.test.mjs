import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(tabs)/settings.tsx", "utf8");
const guidePanelStart = source.indexOf("<SectionBlock title=\"가이드\"");
const guidePanelEnd = source.indexOf("<ActionRow", guidePanelStart);

assert.ok(guidePanelStart >= 0, "settings guide panel should exist");
assert.ok(guidePanelEnd > guidePanelStart, "settings guide panel should contain controls");

const guidePanel = source.slice(guidePanelStart, guidePanelEnd);

for (const snippet of [
  "SettingsGuideSizeSlider",
  "previewGuideSize",
  "commitGuideSize",
  "onStartShouldSetResponder={() => true}",
  "onResponderMove",
  "onResponderRelease"
]) {
  assert.ok(source.includes(snippet), `settings guide size drag control missing: ${snippet}`);
}

assert.ok(
  guidePanel.includes("<SettingsGuideSizeSlider"),
  "expanded guide settings panel should render the drag size slider"
);

console.log("ok - settings guide size can be adjusted by dragging");
