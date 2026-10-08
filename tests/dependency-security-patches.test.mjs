import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("transitive lockfile patches preserve compatible parent ranges", () => {
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  const packages = lock.packages ?? {};

  assert.equal(packages["node_modules/shell-quote"]?.version, "1.11.0");
  assert.equal(
    packages["node_modules/react-devtools-core"]?.dependencies?.["shell-quote"],
    "^1.6.1"
  );
  assert.equal(packages["node_modules/source-map-js"]?.version, "1.2.2");
  assert.equal(
    packages["node_modules/postcss"]?.dependencies?.["source-map-js"],
    "^1.2.1"
  );
  assert.match(
    packages["node_modules/shell-quote"]?.integrity ?? "",
    /^sha512-/
  );
  assert.match(
    packages["node_modules/source-map-js"]?.integrity ?? "",
    /^sha512-/
  );
});
