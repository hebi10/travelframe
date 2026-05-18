import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../app/trip-clip.tsx", import.meta.url),
  "utf8"
);

assert.ok(
  source.includes("저장한 영상은 핸드폰 갤러리에 저장됐습니다."),
  "MP4 save completion should mention phone gallery"
);
assert.ok(
  source.includes("<View\n            style={[\n              styles.exportModalPanel"),
  "export progress panel should not be a ScrollView panel"
);
assert.equal(
  source.includes("<ScrollView\n            style={[\n              styles.exportModalPanel"),
  false,
  "export progress panel should not clip action buttons through ScrollView maxHeight"
);

console.log("ok - export modal completion copy and layout are stable");
