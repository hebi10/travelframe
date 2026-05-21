import assert from "node:assert/strict";
import fs from "node:fs";

const files = [
  "app/(tabs)/studio.tsx",
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

for (const [screenFile, helperFile] of [
  ["app/(tabs)/account.tsx", "features/account/account-screen.helpers.ts"],
  ["app/(tabs)/settings.tsx", "features/settings/settings-screen.helpers.ts"]
]) {
  const source = [screenFile, helperFile]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.ok(
    source.includes('timeZone: "Asia/Seoul"'),
    `${screenFile} should format visible app dates in Korean time`
  );
}

console.log("ok - visible app date formats use Korea time");
