import assert from "node:assert/strict";
import fs from "node:fs";

const functionsPackage = JSON.parse(fs.readFileSync("functions/package.json", "utf8"));
const functionsLock = fs.readFileSync("functions/package-lock.json", "utf8");

assert.equal(
  Object.hasOwn(functionsPackage.dependencies ?? {}, "travel-frame"),
  false,
  "Functions package should not depend on the app package"
);
assert.equal(
  functionsLock.includes('"travel-frame": "file:.."'),
  false,
  "Functions package lock should not retain the app package dependency"
);

console.log("ok - functions package only keeps runtime dependencies it uses");
