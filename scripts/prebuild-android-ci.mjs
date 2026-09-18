import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const expoCli = require.resolve("expo/bin/cli");
const args = [
  expoCli,
  "prebuild",
  "--platform",
  "android",
  "--no-install",
  "--clean"
];

console.log("Generating clean Android project for CI/release verification...");
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    CI: process.env.CI ?? "1",
    EXPO_NO_GIT_STATUS: "1"
  },
  shell: false
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
