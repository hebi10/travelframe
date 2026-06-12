import assert from "node:assert/strict";
import fs from "node:fs";

const previewSource = fs.readFileSync("components/trip-clip-preview-player.tsx", "utf8");
const recordingSource = fs.readFileSync("components/trip-clip-recording-canvas.tsx", "utf8");

assert.ok(
  recordingSource.includes("const currentLayerStyle =") &&
    recordingSource.includes('transition === "fade" && frame.nextPhoto') &&
    recordingSource.includes("opacity: 1 - progress"),
  "recording fade transition should fade the outgoing photo out"
);

assert.ok(
  recordingSource.includes('transition === "fade" ? progress') &&
    recordingSource.includes("styles.recordingNextLayer, nextLayerStyle"),
  "recording fade transition should fade the incoming photo in"
);

assert.ok(
  previewSource.includes('isActive && incomingLayer && transition === "fade"') &&
    previewSource.includes("1 - progress"),
  "preview fade transition should fade the outgoing photo out"
);

assert.ok(
  previewSource.includes('isIncoming && transition === "fade"') &&
    previewSource.includes("? progress"),
  "preview fade transition should fade the incoming photo in"
);

console.log("ok - trip clip fade transitions crossfade outgoing and incoming photos");
