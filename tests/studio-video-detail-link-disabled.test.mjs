import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

assert.equal(
  source.includes("router.push(`/video/${video.id}` as Href)"),
  true,
  "saved video work cards should open the video detail playback screen"
);

assert.ok(
  source.includes('pathname: "/trip-clip"') &&
    source.includes("videoId: video.id") &&
    source.includes('returnTo: "/studio?tab=works"'),
  "saved video work cards should still keep the edit action"
);

console.log("ok - studio saved video cards link to video detail");
