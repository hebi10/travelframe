import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const tripClipSource = readTripClipSource();
const styleSource = fs.readFileSync(
  new URL("../features/trip-clip/trip-clip-screen.styles.ts", import.meta.url),
  "utf8"
);

const readStyleBlock = (name) => {
  const match = new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n\\s{2}\\},`).exec(styleSource);
  assert.ok(match, `${name} style block should exist`);
  return match[1];
};

assert.ok(
  tripClipSource.includes("저장한 영상은 핸드폰 다운로드 폴더에 저장됐습니다."),
  "MP4 save completion should mention phone downloads"
);
assert.ok(
  tripClipSource.includes("<View\n            style={[\n              styles.exportModalPanel"),
  "export progress panel should remain a View around the completion content"
);
assert.ok(
  tripClipSource.includes("style={styles.exportModalScroll}") &&
    tripClipSource.includes("contentContainerStyle={styles.exportModalContent}"),
  "export progress copy should scroll inside the bounded panel"
);
assert.ok(
  (() => {
    const modalStart = tripClipSource.indexOf("visible={exportProgress.visible}");
    const scrollStart = tripClipSource.indexOf("<ScrollView", modalStart);
    const actionsStart = tripClipSource.indexOf("styles.exportModalActions", scrollStart);
    const scrollEnd = tripClipSource.indexOf("</ScrollView>", actionsStart);
    return modalStart >= 0 && scrollStart > modalStart && actionsStart > scrollStart && scrollEnd > actionsStart;
  })(),
  "completion actions should stay inside the scroll content so Android measures the full modal height"
);

const exportModalPanelStyle = readStyleBlock("exportModalPanel");
const exportModalScrollStyle = readStyleBlock("exportModalScroll");
const exportModalActionsStyle = readStyleBlock("exportModalActions");

assert.ok(
  !exportModalPanelStyle.includes("maxHeight") &&
    !exportModalPanelStyle.includes('overflow: "hidden"'),
  "export modal panel should not clip completion actions with a fixed height limit"
);
assert.ok(
  exportModalScrollStyle.includes("flexShrink: 1") &&
    exportModalScrollStyle.includes("minHeight: 0"),
  "export modal scroll area should shrink within the panel"
);
assert.ok(
  exportModalActionsStyle.includes("paddingTop: 2") &&
    exportModalActionsStyle.includes("paddingBottom: 0"),
  "export modal actions should rely on scroll content padding instead of overflowing below the panel"
);

console.log("ok - export modal completion copy and layout are stable");
