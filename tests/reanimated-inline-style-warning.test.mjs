import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transformSync } from "@babel/core";

// Run the installed development Worklets plugin, which detects syntax rather
// than types: even a plain color option's `.value` can produce this warning.
process.env.BABEL_ENV = "development";
process.env.NODE_ENV = "development";
function compile(source, filename) {
  return transformSync(source, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [["@babel/plugin-syntax-typescript", { isTSX: true }], "react-native-worklets/plugin"]
  }).code;
}
assert.match(
  compile('const view = <View style={{ backgroundColor: option.value }} />;', "fixture.tsx"),
  /getUseOfValueInStyleWarning/,
  "the regression check must keep warning detection enabled"
);
const failures = [];
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(filename);
    else if (filename.endsWith(".tsx")) {
      const source = fs.readFileSync(filename, "utf8");
      if (!source.includes(".value")) continue;
      if (compile(source, filename).includes("getUseOfValueInStyleWarning")) failures.push(filename);
    }
  }
}
for (const root of ["app", "components", "features"]) inspect(root);
assert.deepEqual(failures, [], "app JSX must not generate Reanimated inline-style warnings");
console.log("ok - development Worklets compilation produces no inline-style warnings across app screens");
