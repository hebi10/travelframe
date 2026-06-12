import assert from "node:assert/strict";
import fs from "node:fs";

const actionRowSource = fs.readFileSync("components/action-row.tsx", "utf8");

assert.ok(
  !actionRowSource.includes("style={({ pressed }) =>"),
  "settings action rows should not change color or opacity on touch-down while the user is trying to scroll"
);

assert.ok(
  !actionRowSource.includes("pressed &&") && !actionRowSource.includes("opacity: 0.55"),
  "settings action rows should keep their visual state stable until an actual onPress action runs"
);

console.log("ok - settings action rows keep stable color while scrolling");
