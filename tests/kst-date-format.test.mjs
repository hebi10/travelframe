import assert from "node:assert/strict";
import fs from "node:fs";

const files = [
  "app/(tabs)/studio.tsx",
  "app/(tabs)/account.tsx",
  "app/(tabs)/settings.tsx",
  "app/photo/[id].tsx",
  "app/video/[id].tsx",
  "app/edit.tsx",
  "components/trip-clip-preview-player.tsx"
];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  assert.ok(
    source.includes('timeZone: "Asia/Seoul"'),
    `${file} should format visible app dates in Korean time`
  );
}

console.log("ok - visible app date formats use Korea time");
