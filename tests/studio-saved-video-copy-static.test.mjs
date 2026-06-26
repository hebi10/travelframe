import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

assert.equal(
  source.includes("router.push(`/video/${video.id}` as Href)"),
  false,
  "saved video text area should not open the video detail screen"
);

assert.ok(
  source.includes('params: { videoId: video.id, returnTo: "/studio?tab=works" }'),
  "saved video edit action should still open the editor"
);

console.log("ok - saved video text area is static");
