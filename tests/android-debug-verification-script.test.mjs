import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("scripts/verify-android-debug.ps1", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.ok(
  script.includes('[ValidateSet("Kotlin", "Assemble", "ManifestDebug", "ManifestRelease")]'),
  "Android verification script should support bounded Kotlin, assemble, and manifest checks"
);
assert.ok(
  script.includes("-Pkotlin.compiler.execution.strategy=in-process"),
  "Android verification should avoid the Kotlin daemon in restricted Windows environments"
);
assert.ok(
  script.includes("$process.WaitForExit($TimeoutSeconds * 1000)"),
  "Android verification should enforce a timeout"
);
assert.ok(
  script.includes("-PreactNativeArchitectures=$NativeArchitectures"),
  "Android debug verification should be able to limit native ABI builds for fast smoke checks"
);
assert.ok(
  script.includes(":app:processDebugMainManifest") &&
    script.includes(":app:processReleaseMainManifest"),
  "Android verification should expose merged manifest generation tasks"
);
assert.ok(
  script.includes("Stop-BuildProcesses"),
  "Android verification should clean up stale Java/CMake/Ninja processes"
);
assert.ok(
  script.includes("Get-CimInstance Win32_Process") &&
    script.includes("$commandLine.Contains($normalizedProjectRoot)"),
  "Android verification should only stop build processes tied to this project"
);
assert.ok(
  script.includes("$process.Refresh()") &&
    script.indexOf("$process.Refresh()") < script.indexOf("$exitCode = $process.ExitCode"),
  "Android verification should refresh the process before reading ExitCode"
);
assert.ok(
  script.includes("BUILD SUCCESSFUL") &&
    script.includes("treating this as a passed verification"),
  "Android verification should not fail when Gradle reports BUILD SUCCESSFUL but the wrapper returns a stale non-zero code"
);
assert.equal(
  packageJson.scripts["android:verify:kotlin"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-debug.ps1 -Mode Kotlin -TimeoutSeconds 180 -KillStaleProcesses",
  "package.json should expose a short Android Kotlin verification command"
);
assert.equal(
  packageJson.scripts["android:verify:debug"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-debug.ps1 -Mode Assemble -TimeoutSeconds 420 -NativeArchitectures x86_64 -KillStaleProcesses",
  "package.json should expose a bounded single-ABI Android debug assemble command"
);
assert.equal(
  packageJson.scripts["android:verify:debug:full"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-debug.ps1 -Mode Assemble -TimeoutSeconds 1200 -KillStaleProcesses",
  "package.json should expose a deeper full-ABI Android debug assemble command"
);
assert.equal(
  packageJson.scripts["android:manifest:debug"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-debug.ps1 -Mode ManifestDebug -TimeoutSeconds 180 -KillStaleProcesses",
  "package.json should expose a bounded debug manifest merge command"
);
assert.equal(
  packageJson.scripts["android:manifest:release"],
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-debug.ps1 -Mode ManifestRelease -TimeoutSeconds 240 -KillStaleProcesses",
  "package.json should expose a bounded release manifest merge command"
);

console.log("ok - Android debug verification is bounded and cleans stale native build processes");
