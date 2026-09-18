import { spawnSync } from "node:child_process";
import process from "node:process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = [
  "expo",
  "prebuild",
  "--platform",
  "android",
  "--no-install",
  "--clean"
];

console.log("Generating clean Android project for CI/release verification...");
const result = spawnSync(command, args, {
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
