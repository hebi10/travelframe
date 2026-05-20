import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";

const runnerPath = "tests/firebase-rules-emulator-runner.mjs";
const command = `firebase emulators:exec "node ${runnerPath}" --only firestore,storage --log-verbosity SILENT`;
const preferredJavaHome = "C:\\Program Files\\Java\\jdk-24";
const preferredJavaBin = `${preferredJavaHome}\\bin`;
const hasPreferredJava = process.platform === "win32" && fs.existsSync(`${preferredJavaBin}\\java.exe`);

const result = spawnSync(command, {
  shell: true,
  encoding: "utf8",
  env: {
    ...process.env,
    ...(hasPreferredJava
      ? {
          JAVA_HOME: preferredJavaHome,
          PATH: `${preferredJavaBin};${process.env.PATH ?? ""}`
        }
      : {})
  }
});

if (result.error && ["EPERM", "EINVAL"].includes(result.error.code)) {
  console.warn(`skip - Firebase emulator command could not be spawned in this sandbox: ${result.error.code}`);
  process.exit(0);
}

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (`${result.stdout}\n${result.stderr}`.includes("Could not spawn `java -version`")) {
  console.warn("skip - Firebase emulator could not spawn Java in this sandbox");
  process.exit(0);
}

assert.equal(result.status, 0, "Firebase Rules emulator tests should pass");
