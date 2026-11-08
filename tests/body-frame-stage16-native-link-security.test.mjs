import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = (name, deps = {}) => {
  const source = fs.readFileSync(name, "utf8");
  const js = ts.transpileModule(source, {
    fileName: name,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    decodeURIComponent,
    require: (name) => {
      assert.ok(Object.hasOwn(deps, name), `unexpected dependency: ${name}`);
      return deps[name];
    }
  });
  return exports;
};

const guard = compile("lib/native-deep-link.ts");
const nativeIntent = compile("app/+native-intent.tsx", {
  "@/lib/native-deep-link": guard
});

test("Stage 16 Android external links preserve valid routing and OAuth paths", () => {
  for (const path of [
    "/",
    "/camera",
    "/project/abc?tab=records",
    "bodyframe://project/abc?tab=photos",
    "photoguide://account",
    "com.haebi.photoguide:/oauthredirect?code=abc123&state=sign-in",
    "/project/%ED%95%9C%EA%B8%80?name=%EB%AA%B8"
  ]) {
    assert.equal(guard.sanitizeIncomingNativePath(path), path);
    assert.equal(nativeIntent.redirectSystemPath({ initial: false, path }), path);
    assert.equal(nativeIntent.redirectSystemPath({ initial: true, path }), path);
  }
});

test("Stage 16 rejects malformed UTF-8, invalid escape runs and control characters", () => {
  for (const path of [
    "/project/%",
    "/project/%XX",
    "/project/%FF",
    "/project/%ED%A0%80",
    "/project/%00",
    "/account?code=%0D%0Ainjected",
    "/project/hello\nworld",
    "/account\u007F"
  ]) {
    assert.equal(nativeIntent.redirectSystemPath({ initial: true, path }), "/");
  }
});

test("Stage 16 limits external link/query size and argument explosion before Router", () => {
  const values = [
    "a".repeat(guard.MAX_NATIVE_LINK_LENGTH + 1),
    "/account?state=" + "a".repeat(guard.MAX_NATIVE_QUERY_LENGTH + 1),
    "/account?" + Array.from({ length: guard.MAX_NATIVE_QUERY_FIELDS + 1 }, (_, i) => `p${i}=1`).join("&")
  ];
  for (const path of values) {
    assert.equal(nativeIntent.redirectSystemPath({ initial: false, path }), "/");
  }
  assert.equal(guard.sanitizeIncomingNativePath(null), "/");
  assert.equal(guard.sanitizeIncomingNativePath({}), "/");
  assert.equal(guard.sanitizeIncomingNativePath(""), "/");
  assert.equal(guard.sanitizeIncomingNativePath("/account?state=" + "x".repeat(1500)), "/account?state=" + "x".repeat(1500));
});

test("Stage 16 bounds percent-encoded runs before Router decode (DoS defense)", () => {
  const valid = "/camera?name=" + "%ED%95%9C".repeat(20);
  assert.equal(guard.sanitizeIncomingNativePath(valid), valid);
  assert.equal(guard.MAX_NATIVE_PERCENT_ESCAPES, 96);
  const malicious = "/camera?data=" + "%41".repeat(guard.MAX_NATIVE_PERCENT_ESCAPES + 1);
  assert.equal(nativeIntent.redirectSystemPath({ initial: true, path: malicious }), "/");
  assert.equal(nativeIntent.redirectSystemPath({ initial: false, path: malicious }), "/");
});

test("Stage 16 leaves legacy SDK dependencies untouched and does not bypass Play release safeguards", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  assert.match(pkg.dependencies.expo, /^\^55\./);
  assert.match(pkg.dependencies["expo-router"], /^\^55\./);
  assert.equal(lock.packages["node_modules/expo-router"].version.startsWith("55."), true);
  assert.equal(lock.packages["node_modules/query-string"].version, "7.1.3");
  assert.equal(lock.packages["node_modules/decode-uri-component"].version, "0.2.2");
  const release = fs.readFileSync(".github/workflows/android-play-aab.yml", "utf8");
  assert.match(release, /BODY_FRAME_PLAY_SIGNING_APPROVED_20261107/);
  assert.match(release, /options: \[internal, closed\]/);
});
