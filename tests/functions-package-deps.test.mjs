import assert from "node:assert/strict";
import fs from "node:fs";

const functionsPackage = JSON.parse(fs.readFileSync("functions/package.json", "utf8"));
const functionsLock = fs.readFileSync("functions/package-lock.json", "utf8");
const functionJsFiles = fs
  .readdirSync("functions")
  .filter((name) => name.endsWith(".js"))
  .sort();

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

assert.equal(
  functionsPackage.scripts?.quality,
  "npm run syntax",
  "Functions package should expose one bounded quality command"
);
assert.ok(
  functionsPackage.scripts?.syntax,
  "Functions package should expose a syntax verification command"
);

for (const fileName of functionJsFiles) {
  assert.ok(
    functionsPackage.scripts.syntax.includes(`node --check ${fileName}`),
    `Functions syntax verification should check ${fileName}`
  );
}

console.log("ok - functions package keeps runtime dependencies and exposes syntax verification");
