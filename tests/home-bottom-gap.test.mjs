import assert from "node:assert/strict";
import fs from "node:fs";

const homeSource = fs.readFileSync("app/(tabs)/home.tsx", "utf8");

assert.ok(
  homeSource.includes("paddingBottom: 8"),
  "home preview should keep a compact bottom gap above the tab bar"
);

assert.ok(
  !homeSource.includes("paddingBottom: 18"),
  "home preview should not keep the previous large bottom padding"
);

console.log("ok - home bottom gap is compact");
