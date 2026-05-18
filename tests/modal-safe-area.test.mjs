import assert from "node:assert/strict";
import fs from "node:fs";

const settingsSource = fs.readFileSync(
  new URL("../app/(tabs)/settings.tsx", import.meta.url),
  "utf8"
);
const accountSource = fs.readFileSync(
  new URL("../app/(tabs)/account.tsx", import.meta.url),
  "utf8"
);
const tripClipSource = fs.readFileSync(
  new URL("../app/trip-clip.tsx", import.meta.url),
  "utf8"
);
const cameraSource = fs.readFileSync(
  new URL("../app/(tabs)/camera.tsx", import.meta.url),
  "utf8"
);

for (const [name, source] of [
  ["settings", settingsSource],
  ["account", accountSource],
  ["trip clip", tripClipSource],
  ["camera", cameraSource]
]) {
  assert.ok(
    source.includes("useSafeAreaInsets"),
    `${name} should read safe area insets for modal spacing`
  );
  assert.ok(
    source.includes("modalSafeStyle"),
    `${name} should provide a safe-area-aware modal backdrop style`
  );
}

for (const snippet of [
  "<View style={[styles.modalBackdrop, modalSafeStyle]}>",
  "<View style={[styles.paymentModalBackdrop, modalSafeStyle]}>",
  "<View style={[styles.exportModalBackdrop, modalSafeStyle]}>",
  "<View style={[styles.navModalBackdrop, modalSafeStyle]}>",
  "<View style={[styles.modalBackdrop, modalSafeStyle]}>"
]) {
  const allSources = `${settingsSource}\n${accountSource}\n${tripClipSource}\n${cameraSource}`;
  assert.ok(allSources.includes(snippet), `modal safe area missing: ${snippet}`);
}

console.log("ok - modals include safe-area-aware outer padding");
