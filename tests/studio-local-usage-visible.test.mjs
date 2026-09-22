import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

for (const snippet of [
  "const photoUsage =",
  "const imageBundleUsage =",
  "const videoUsage =",
  'label: "이미지 보관함"',
  'label: "영상 보관함"',
  "photoLibraryItems.length",
  "imageBundles.length",
  "videos.length",
  "planEntitlements.localImageLimit",
  "planEntitlements.localVideoLimit"
]) {
  assert.ok(source.includes(snippet), `studio local usage should be visible without login: ${snippet}`);
}

assert.ok(
  source.includes("export function UsageBadge({") &&
    source.includes("limit?: number") &&
    source.includes("무제한"),
  "studio should render a generic usage badge that supports unlimited local counts"
);

assert.ok(
  !source.includes("function BackupUsageBadge({ count, limit }"),
  "studio should not only expose cloud backup usage badges"
);

console.log("ok - studio shows local library usage counts without login");
