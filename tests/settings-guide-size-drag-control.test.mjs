import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = [
  readFileSync("app/(tabs)/settings.tsx", "utf8"),
  readFileSync("features/settings/settings-screen.components.tsx", "utf8"),
  readFileSync("features/camera/camera-screen.components.tsx", "utf8")
].join("\n");
const guidePanelStart = source.indexOf("<SectionBlock title=\"가이드\"");
const guidePanelEnd = source.indexOf("<ActionRow", guidePanelStart);

assert.ok(guidePanelStart >= 0, "settings guide panel should exist");
assert.ok(guidePanelEnd > guidePanelStart, "settings guide panel should contain controls");

const guidePanel = source.slice(guidePanelStart, guidePanelEnd);

for (const snippet of [
  "GuideSizeSlider",
  "previewGuideSize",
  "commitGuideSize",
  "Gesture.Pan()",
  "runOnJS(previewValue)",
  "runOnJS(onCommit)"
]) {
  assert.ok(source.includes(snippet), `settings guide size drag control missing: ${snippet}`);
}

assert.ok(
  guidePanel.includes("<GuideSizeSlider") &&
    guidePanel.includes("compact"),
  "expanded guide settings panel should render the camera guide drag size slider"
);

assert.ok(
  !source.includes("export function SettingsGuideSizeSlider") &&
    !source.includes("onResponderMove"),
  "settings guide size control should not use the old responder-based slider"
);

console.log("ok - settings guide size can be adjusted by dragging");
