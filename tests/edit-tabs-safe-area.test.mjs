import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/edit.tsx", "utf8");

for (const snippet of [
  "ScrollView",
  'type EditPanelTab = "image" | "guide";',
  'const EDIT_PANEL_TABS: { label: string; value: EditPanelTab }[] = [',
  'label: "이미지 편집"',
  'label: "가이드라인 편집"',
  'const [activeEditPanelTab, setActiveEditPanelTab] = useState<EditPanelTab>("image");',
  "styles.editPanelTabs",
  "styles.editPanelScroll",
  "styles.editPanelScrollContent",
  'activeEditPanelTab === "image"',
  'activeEditPanelTab === "guide"',
  "setActiveEditPanelTab(tab.value)",
  "maxHeight: \"48%\"",
  "minHeight: 0",
  "contentContainerStyle={styles.editPanelScrollContent}"
]) {
  assert.ok(source.includes(snippet), `edit safe-area tabs missing: ${snippet}`);
}

const bottomPanelStart = source.indexOf("<View style={[styles.bottomPanel");
const bottomPanelEnd = source.indexOf("</View>", source.indexOf("styles.message", bottomPanelStart));
assert.ok(bottomPanelStart >= 0, "edit bottom panel should exist");
assert.ok(bottomPanelEnd > bottomPanelStart, "edit bottom panel should render message before closing");

const bottomPanel = source.slice(bottomPanelStart, bottomPanelEnd);
assert.ok(
  bottomPanel.includes("<ScrollView"),
  "edit bottom panel controls should be scrollable inside the safe-area panel"
);
assert.ok(
  bottomPanel.indexOf("styles.editPanelTabs") < bottomPanel.indexOf("<ScrollView"),
  "edit tab selector should remain above the scrollable controls"
);
assert.ok(
  bottomPanel.indexOf('activeEditPanelTab === "image"') <
    bottomPanel.indexOf('activeEditPanelTab === "guide"'),
  "image edit controls should be separate from guideline controls"
);

console.log("ok - edit controls are tabbed and constrained above Android safe area");
