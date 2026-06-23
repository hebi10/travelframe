import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const tripClipSource = readTripClipSource();
const stylesSource = fs.readFileSync("features/trip-clip/trip-clip-screen.styles.ts", "utf8");

for (const snippet of [
  "const [isFrameFitModalVisible, setIsFrameFitModalVisible] = useState(false);",
  "const frameFitPreviewProps = useMemo(",
  "const resetActivePhotoAdjustment = useCallback(",
  "setTripClipPhotoAdjustment(current, activePhoto.id, DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT)",
  "setPreviewAdjustEnabled(true);",
  "setIsFrameFitModalVisible(true);",
  "프레임 맞추기",
  "크게 편집",
  "adjustEnabled={previewAdjustEnabled}",
  "{...frameFitPreviewProps}",
  "visible={isFrameFitModalVisible}",
  "adjustEnabled={isFrameFitModalVisible}",
  "onRequestClose={() => setIsFrameFitModalVisible(false)}",
  "styles.frameFitModalBackdrop",
  "styles.frameFitModalFrame",
  "styles.frameFitModalActions"
]) {
  assert.ok(tripClipSource.includes(snippet), `frame fit editor wiring missing: ${snippet}`);
}

for (const snippet of [
  "frameFitInlineActions",
  "frameFitInlineButton",
  "frameFitInlinePrimaryButton",
  "frameFitModalBackdrop",
  "frameFitModalPanel",
  "frameFitModalFrame",
  "frameFitModalActions"
]) {
  assert.ok(stylesSource.includes(snippet), `frame fit editor style missing: ${snippet}`);
}

const modalBlock = tripClipSource.slice(
  tripClipSource.indexOf("visible={isFrameFitModalVisible}"),
  tripClipSource.indexOf("</Modal>", tripClipSource.indexOf("visible={isFrameFitModalVisible}"))
);
assert.ok(
  modalBlock.includes("TripClipPreviewPlayer") &&
    modalBlock.includes("{...frameFitPreviewProps}") &&
    tripClipSource.includes("onPhotoAdjustmentChange: updatePhotoAdjustment"),
  "frame fit modal should reuse the preview player and shared photo adjustment state"
);

console.log("ok - trip clip frame fit editor supports inline and large modal editing");
