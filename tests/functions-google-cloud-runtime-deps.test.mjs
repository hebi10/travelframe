import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("functions/package.json", "utf8"));
const packageLock = JSON.parse(fs.readFileSync("functions/package-lock.json", "utf8"));

assert.equal(
  Object.hasOwn(packageJson, "overrides"),
  false,
  "Functions should not force incompatible Google Cloud dependency majors through overrides"
);

const packages = packageLock.packages ?? {};
assert.equal(
  packages["node_modules/google-gax"]?.version,
  "4.6.1",
  "@google-cloud/firestore 7.x should resolve a compatible google-gax 4.x runtime"
);
assert.equal(
  packages["node_modules/gaxios"]?.version,
  "6.7.1",
  "Google Auth 9.x should resolve the compatible gaxios 6.x line"
);
assert.equal(
  packages["node_modules/retry-request"]?.version,
  "7.0.2",
  "Google Cloud Storage should resolve retry-request 7.x"
);
assert.equal(
  packages["node_modules/teeny-request"]?.version,
  "9.0.0",
  "Google Cloud Storage should resolve teeny-request 9.x"
);
assert.equal(
  packages["node_modules/node-fetch"]?.version,
  "2.7.0",
  "google-gax 4.x should use its CommonJS-compatible node-fetch 2.x dependency"
);

assert.ok(
  packageJson.scripts?.["runtime:deps"]?.includes("google-gax/build/src/fallback"),
  "Functions quality should smoke-test the fallback import that previously failed in production"
);
assert.ok(
  packageJson.scripts?.quality?.includes("npm run runtime:deps"),
  "Functions quality should execute the runtime dependency smoke test"
);

console.log("ok - Functions Google Cloud dependency tree is runtime-compatible");
