import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const nativePath = "android/src/main/java/com/reactnativeviewrecorder/ViewRecorderModule.kt";
const installedSource = fs.readFileSync(path.join(root, "node_modules/react-native-view-recorder", nativePath), "utf8");

function between(source, start, end) {
  const offset = source.indexOf(start);
  assert(offset >= 0 && source.indexOf(start, offset + start.length) < 0, `Expected one ${start}`);
  const finish = source.indexOf(end, offset + start.length);
  assert(finish >= 0, `Missing ${end}`);
  return source.slice(offset, finish);
}

test("installed Android recorder callbacks survive stop races without hiding active or codec failures", { timeout: 120_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "body-frame-recorder-race-"));
  try {
    const callback = between(installedSource, "object : MediaCodec.Callback() {", "\n          },\n          callbackHandler,") + "\n          }";
    const release = between(installedSource, "private fun releaseSession(session: EncoderSession) {", "\n\n  override fun invalidate()");
    const fixture = fs.readFileSync(path.join(root, "tests/fixtures/view-recorder-callback-harness.kt"), "utf8")
      .replace("__RECORDER_CALLBACK__", () => callback)
      .replace("__RELEASE_SESSION__", () => release);
    const input = path.join(directory, "RecorderStopRace.kt");
    const jar = path.join(directory, "recorder-race.jar");
    fs.writeFileSync(input, fixture);
    const compile = spawnSync(process.env.KOTLINC || "kotlinc", ["-J-XX:-UsePerfData", `-J-Djava.io.tmpdir=${directory}`, input, "-nowarn", "-include-runtime", "-d", jar], { encoding: "utf8", timeout: 90_000 });
    assert.equal(compile.error, undefined, "Kotlin CLI is required to execute the actual installed recorder callback code");
    assert.equal(compile.status, 0, compile.stderr);
    const result = spawnSync("java", ["-XX:-UsePerfData", `-Djava.io.tmpdir=${directory}`, "-jar", jar], { encoding: "utf8", timeout: 20_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^ok - recorder callbacks/m);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("recorder postinstall patch is repeatable and rejects changed native source or package versions", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "body-frame-recorder-patch-"));
  const module = path.join(directory, "node_modules/react-native-view-recorder");
  const sourcePath = path.join(module, nativePath);
  const packagePath = path.join(module, "package.json");
  try {
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.cpSync(path.join(root, "scripts"), path.join(directory, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ dependencies: { "react-native-view-recorder": "^0.4.1" } }));
    fs.writeFileSync(packagePath, JSON.stringify({ version: "0.4.1" }));
    fs.writeFileSync(sourcePath, installedSource);
    const apply = () => spawnSync(process.execPath, [path.join(directory, "scripts/apply-patches.mjs")], { encoding: "utf8" });
    assert.equal(apply().status, 0);
    const patched = fs.readFileSync(sourcePath, "utf8");
    assert.equal(apply().status, 0);
    assert.equal(fs.readFileSync(sourcePath, "utf8"), patched);
    const changed = patched.replace("codec.releaseOutputBuffer(index, false)", "codec.releaseOutputBuffer(index, true)");
    fs.writeFileSync(sourcePath, changed);
    assert.notEqual(apply().status, 0, "Unknown recorder callback code must stop postinstall");
    assert.equal(fs.readFileSync(sourcePath, "utf8"), changed);
    fs.writeFileSync(sourcePath, patched);
    fs.writeFileSync(packagePath, JSON.stringify({ version: "0.4.2" }));
    assert.notEqual(apply().status, 0, "New recorder versions require a reviewed patch");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
