import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studioSource = readFileSync("app/(tabs)/studio.tsx", "utf8");
const tripClipSource = readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

assert.ok(
  studioSource.includes('params: { returnTo: "/studio?tab=videos", start: "new" }'),
  "studio create entry should mark trip clip navigation as a fresh new project"
);

for (const snippet of [
  "start?: string | string[];",
  "const startParam = Array.isArray(start) ? start[0] : start;",
  'const shouldStartFreshProject = startParam === "new";',
  "if (shouldStartFreshProject) {",
  "resetNewTripClipProject();",
  "setAvailableDraft(null);",
  "setShowDraftPrompt(false);",
  "return;",
  "shouldStartFreshProject"
]) {
  assert.ok(tripClipSource.includes(snippet), `fresh trip clip entry missing: ${snippet}`);
}

const draftLoadStart = tripClipSource.indexOf("const loadTripClipDraft = async () => {");
const draftLoadEnd = tripClipSource.indexOf("loadTripClipDraft();", draftLoadStart);
const draftLoadBlock = tripClipSource.slice(draftLoadStart, draftLoadEnd);

assert.ok(
  draftLoadBlock.indexOf("if (shouldStartFreshProject)") <
    draftLoadBlock.indexOf("const draft = await getTripClipDraft();"),
  "fresh trip clip entry should bypass saved draft loading before any draft read"
);

console.log("ok - studio new trip clip entry starts with an empty project");
