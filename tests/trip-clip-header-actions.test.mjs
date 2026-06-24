import assert from "node:assert/strict";
import fs from "node:fs";

import { readStudioSource } from "./studio-test-source.mjs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const studioSource = readStudioSource();
const videoDetailSource = fs.readFileSync("app/video/[id].tsx", "utf8");
const tripClipSource = readTripClipSource();

assert.ok(
  studioSource.includes('pathname: "/trip-clip"') &&
    studioSource.includes('returnTo: "/studio?tab=videos"') &&
    studioSource.includes('returnTo: "/studio?tab=works"'),
  "studio trip clip entry points should pass the screen to return to"
);

assert.ok(
  videoDetailSource.includes('pathname: "/trip-clip"') &&
    videoDetailSource.includes("returnTo: `/video/${video.id}`"),
  "video detail edit entry should return to the video detail screen"
);

for (const snippet of [
  'import { Feather } from "@expo/vector-icons";',
  "returnTo?: string | string[];",
  "const returnToParam = Array.isArray(returnTo) ? returnTo[0] : returnTo;",
  'const backTarget = returnToParam ?? "/studio?tab=videos";',
  "const handleBackPress = useCallback(() => {",
  "router.replace(backTarget as Href)",
  "BackHandler.addEventListener(\"hardwareBackPress\", () => {",
  "handleBackPress();",
  "return true;",
  "subscription.remove();",
  "styles.headerBackButton",
  'name="chevron-left"',
  "styles.headerSpacer",
  "styles.draftSaveButton",
  "const handleHeaderSavePress = () => {",
  "persistTripClipDraft(true)",
  "onPress={handleHeaderSavePress}"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip header action missing: ${snippet}`);
}

assert.ok(
  !tripClipSource.includes("router.canGoBack()") &&
    !tripClipSource.includes("router.back()"),
  "trip clip header back should not fall through to the camera tab history"
);

const headerActionStart = tripClipSource.indexOf("<View style={styles.headerActionRow}>");
const headerActionEnd = tripClipSource.indexOf("</View>", headerActionStart);
const headerActionSource = tripClipSource.slice(headerActionStart, headerActionEnd);

assert.ok(
  headerActionSource.indexOf("styles.headerBackButton") <
    headerActionSource.indexOf("styles.draftSaveButton"),
  "trip clip header should place back on the left and draft save on the right"
);

console.log("ok - trip clip header has deterministic return navigation");
