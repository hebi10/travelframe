import assert from "node:assert/strict";
import fs from "node:fs";

const studioSource = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

assert.ok(
  studioSource.includes('onPress={() => router.push("/trip-clip")}') &&
    studioSource.includes("생성 시작"),
  "studio video creation CTA should open trip clip"
);

for (const snippet of [
  'import { Feather } from "@expo/vector-icons";',
  "const handleBackPress = useCallback(() => {",
  "router.canGoBack()",
  "router.back()",
  'router.replace("/studio?tab=videos" as Href)',
  "styles.headerBackButton",
  'accessibilityLabel="보관함으로 돌아가기"',
  'name="chevron-left"',
  "styles.headerSpacer",
  "styles.draftSaveButton",
  "onPress={() => void persistTripClipDraft(true)}"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip header action missing: ${snippet}`);
}

const headerActionStart = tripClipSource.indexOf("<View style={styles.headerActionRow}>");
const headerActionEnd = tripClipSource.indexOf("</View>", headerActionStart);
const headerActionSource = tripClipSource.slice(headerActionStart, headerActionEnd);

assert.ok(
  headerActionSource.indexOf("styles.headerBackButton") <
    headerActionSource.indexOf("styles.draftSaveButton"),
  "trip clip header should place back on the left and draft save on the right"
);

console.log("ok - trip clip header has back and draft actions");
