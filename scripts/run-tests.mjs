import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const testsDirectory = path.join(root, "tests");
const filters = process.argv.slice(2).map((value) => value.toLowerCase());
const defaultExcludedTests = new Set(["firebase-rules-emulator.test.mjs"]);

const testFiles = fs
  .readdirSync(testsDirectory)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .filter((name) => {
    if (filters.length === 0 || defaultExcludedTests.has(name)) {
      return !defaultExcludedTests.has(name);
    }

    return filters.some((filter) => name.toLowerCase().includes(filter));
  });

if (filters.length === 0) {
  console.info("info - Firebase Rules emulator checks run via `npm run test:firebase-rules`.");
}

if (testFiles.length === 0) {
  console.error(
    filters.length > 0
      ? `No tests matched: ${filters.join(", ")}`
      : "No tests matched."
  );
  process.exit(1);
}

for (const fileName of testFiles) {
  const filePath = path.join("tests", fileName);
  const result = spawnSync(process.execPath, [filePath], {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
