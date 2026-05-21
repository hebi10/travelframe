import assert from "node:assert/strict";
import fs from "node:fs";

const appSources = [
  "app/(tabs)/account.tsx",
  "app/(tabs)/settings.tsx",
  "lib/photo-library.ts"
];

for (const filePath of appSources) {
  const source = fs.readFileSync(filePath, "utf8");

  for (const snippet of [
    'console.log("[google-auth]"',
    'console.log("[photo-library]'
  ]) {
    assert.equal(
      source.includes(snippet),
      false,
      `${filePath} should not include production-sensitive debug log: ${snippet}`
    );
  }
}

console.log("ok - production-sensitive debug logs are not present");
