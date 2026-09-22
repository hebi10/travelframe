import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/edit.tsx", "utf8");

for (const snippet of [
  "ScrollView",
  "styles.editPanelHeader",
  "styles.editPanelScroll",
  "styles.editPanelScrollContent",
  "비율과 구도를 조정한 뒤 저장하세요.",
  "화면 비율",
  "빠른 편집",
  "사진 불러오기",
  "수평 맞추기",
  "가득 채우기",
  "90도 회전",
  "초기화",
  'maxHeight: "52%"',
  "minHeight: 0",
  "contentContainerStyle={styles.editPanelScrollContent}",
  "bodyFrameDarkColors.background",
  "bodyFrameDarkColors.surface",
  "bodyFrameDarkColors.surfaceStrong"
]) {
  assert.ok(source.includes(snippet), `dark edit panel missing: ${snippet}`);
}

for (const removed of [
  'type EditPanelTab = "image" | "guide";',
  "EDIT_PANEL_TABS",
  "activeEditPanelTab",
  "styles.editPanelTabs",
  'label: "가이드라인 편집"',
  'activeEditPanelTab === "guide"'
]) {
  assert.ok(
    !source.includes(removed),
    `photo editor should not keep the old tabbed guide editor: ${removed}`
  );
}

const bottomPanelStart = source.indexOf("<View style={[styles.bottomPanel");
const bottomPanelEnd = source.indexOf(
  ") : null}\n    </View>\n  );",
  bottomPanelStart
);
assert.ok(bottomPanelStart >= 0, "edit bottom panel should exist");
assert.ok(bottomPanelEnd > bottomPanelStart, "edit bottom panel should close before screen");

const bottomPanel = source.slice(bottomPanelStart, bottomPanelEnd);
assert.ok(
  bottomPanel.includes("<ScrollView"),
  "edit controls should remain scrollable inside the safe-area panel"
);
assert.ok(
  bottomPanel.indexOf("styles.editPanelHeader") < bottomPanel.indexOf("<ScrollView"),
  "image editor heading should stay above the scrollable controls"
);
assert.equal(
  bottomPanel.includes("가이드라인 편집"),
  false,
  "guide editor tab should be removed from the photo editor"
);

console.log("ok - photo editor uses one dark image-edit panel above the safe area");
