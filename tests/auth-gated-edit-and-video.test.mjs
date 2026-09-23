import assert from "node:assert/strict";
import fs from "node:fs";

import { readStudioSource } from "./studio-test-source.mjs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const studioSource = readStudioSource();
const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const tripClipSource = readTripClipSource();
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
  tripClipSource.includes("getGuestWeeklyVideoExportUsage"),
  "logged-out video creation should use the guest weekly quota"
);
assert.ok(
  tripClipSource.includes("recordGuestWeeklyVideoExport"),
  "successful logged-out video creation should record the weekly quota"
);
assert.ok(
  tripClipSource.includes("if (isLoggedIn)"),
  "logged-in users should bypass the guest weekly quota"
);

console.log("ok - photo editing stays auth-gated while guest video output uses a weekly quota");
