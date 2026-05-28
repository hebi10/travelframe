import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");

assert.equal(
  source.includes("router.push(`/video/${video.id}` as Href)"),
  true,
  "saved video work cards should open the video detail playback screen"
);

assert.ok(
  source.includes("router.push(`/trip-clip?videoId=${video.id}` as Href)"),
  "saved video work cards should still keep the edit action"
);

console.log("ok - studio saved video cards link to video detail");
