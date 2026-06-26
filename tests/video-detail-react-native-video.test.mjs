import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/video/[id].tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.ok(
  packageJson.dependencies["react-native-video"],
  "react-native-video should be installed"
);

assert.equal(
  packageJson.dependencies["expo-video"],
  undefined,
  "expo-video should be removed from app dependencies"
);

assert.equal(
  source.includes("expo-video"),
  false,
  "video detail should not use expo-video"
);

assert.ok(
  source.includes('import Video from "react-native-video";'),
  "video detail should import react-native-video"
);

assert.ok(
  source.includes("<Video"),
  "video detail should render the react-native-video component"
);

console.log("ok - video detail uses react-native-video");
