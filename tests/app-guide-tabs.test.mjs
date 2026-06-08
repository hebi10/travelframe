import assert from "node:assert/strict";
import fs from "node:fs";

const hookSource = fs.readFileSync("hooks/use-app-guide.ts", "utf8");
const stepsSource = fs.readFileSync("constants/app-guide-steps.ts", "utf8");

for (const tabKey of ["camera", "studio", "tripClip", "account", "settings"]) {
  assert.ok(stepsSource.includes(`${tabKey}: [`), `guide steps should define ${tabKey}`);
}

assert.equal(
  hookSource.includes('tabKey !== "camera"'),
  false,
  "useAppGuide should not hard-code first-run guide display to camera only"
);
assert.ok(
  hookSource.includes("steps.length <= 0"),
  "useAppGuide should skip undefined or empty guide step lists"
);
assert.ok(
  hookSource.includes("shouldShowGuideForTab(tabKey)"),
  "useAppGuide should consult guide progress for the active tab"
);

console.log("ok - app guide supports all defined tabs");
