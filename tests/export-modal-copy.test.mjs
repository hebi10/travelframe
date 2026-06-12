import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = fs.readFileSync(
  new URL("../app/(tabs)/trip-clip.tsx", import.meta.url),
  "utf8"
);
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
  tripClipSource.includes("저장한 영상은 핸드폰 갤러리에 저장됐습니다."),
  "MP4 save completion should mention phone gallery"
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
  tripClipSource.includes("</ScrollView>\n            {!isExporting ? ("),
  "completion actions should stay outside the scroll content"
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
  exportModalActionsStyle.includes("paddingBottom: 18"),
  "export modal actions should keep bottom padding while fixed below scroll content"
);

console.log("ok - export modal completion copy and layout are stable");
