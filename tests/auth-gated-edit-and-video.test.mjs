import assert from "node:assert/strict";
import fs from "node:fs";

const studioSource = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
const photoDetailSource = fs.readFileSync("app/photo/[id].tsx", "utf8");
const videoDetailSource = fs.readFileSync("app/video/[id].tsx", "utf8");

assert.ok(
  studioSource.includes("showLoginRequiredForEditing"),
  "studio should centralize the login-required editing 안내"
);
assert.ok(
  studioSource.includes("canEditLibraryItems={Boolean(user)}"),
  "studio should pass login state into photo edit cards"
);
assert.ok(
  studioSource.includes("onRequireLoginForEdit={showLoginRequiredForEditing}"),
  "studio photo cards should show login 안내 instead of opening edit while logged out"
);
assert.ok(
  studioSource.includes("onRequireLoginForVideo={showLoginRequiredForVideoCreation}"),
  "studio video creation should show login 안내 when video generation is unavailable"
);

assert.ok(
  editSource.includes("if (!user)"),
  "edit screen should guard direct access for logged-out users"
);
assert.ok(
  editSource.includes('router.replace("/account" as Href)'),
  "edit screen should send logged-out users to the login/account tab"
);
assert.ok(
  photoDetailSource.includes("showLoginRequiredForEditing"),
  "photo detail edit button should show login 안내 while logged out"
);
assert.ok(
  videoDetailSource.includes("showLoginRequiredForVideoCreation"),
  "video detail edit button should show login 안내 while logged out"
);

assert.ok(
  tripClipSource.includes("const canUseVideoCreation = planEntitlements.canExportVideo"),
  "trip clip should derive video creation access from canExportVideo"
);
assert.ok(
  tripClipSource.includes("if (!canUseVideoCreation)"),
  "trip clip should block export when the plan cannot export video"
);
assert.ok(
  tripClipSource.includes("showLoginRequiredForVideoCreation"),
  "trip clip should explain that login is required for video creation"
);

console.log("ok - edit and video creation access are gated by auth and plan");
