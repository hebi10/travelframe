import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("lib/media-library-permissions.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const {
  getMediaLibraryAccessState,
  getMediaLibraryPermissionMessage,
  isMediaLibraryAccessGranted,
  shouldOpenMediaLibrarySettings
} = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

assert.equal(getMediaLibraryAccessState({ granted: true, accessPrivileges: "all" }), "full");
assert.equal(getMediaLibraryAccessState({ granted: true, accessPrivileges: "limited" }), "limited");
assert.equal(getMediaLibraryAccessState({ granted: false, canAskAgain: true }), "denied");
assert.equal(getMediaLibraryAccessState({ granted: false, canAskAgain: false }), "blocked");
assert.equal(isMediaLibraryAccessGranted("full"), true);
assert.equal(isMediaLibraryAccessGranted("limited"), true);
assert.equal(isMediaLibraryAccessGranted("denied"), false);
assert.equal(shouldOpenMediaLibrarySettings("limited"), true);
assert.equal(shouldOpenMediaLibrarySettings("blocked"), true);
assert.match(
  getMediaLibraryPermissionMessage("limited", "fallback"),
  /선택한 사진만 표시됩니다/
);
assert.match(
  getMediaLibraryPermissionMessage("blocked", "fallback"),
  /Android 설정/
);

console.log("ok - Android media library permission states are normalized");
