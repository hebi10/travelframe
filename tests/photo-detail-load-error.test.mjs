import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/photo/[id].tsx", "utf8");

const loadStart = source.indexOf("const loadPhoto = useCallback");
const loadEnd = source.indexOf("useFocusEffect", loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, "photo detail loadPhoto should exist");

const loadSource = source.slice(loadStart, loadEnd);

for (const snippet of [
  "try {",
  "const storedPhoto = await getPhotoById(id);",
  "catch (error)",
  "setMessage(getUserFacingErrorMessage(",
  "finally {",
  "setIsLoading(false);"
]) {
  assert.ok(loadSource.includes(snippet), `photo detail loadPhoto should handle failures: ${snippet}`);
}

assert.ok(
  loadSource.lastIndexOf("setIsLoading(false);") > loadSource.indexOf("finally {"),
  "photo detail should always stop loading in finally"
);

console.log("ok - photo detail stops loading and shows errors when photo restore fails");
