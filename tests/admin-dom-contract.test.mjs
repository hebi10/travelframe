import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("all literal admin element lookups exist in static or dynamically authored HTML", () => {
  const html = fs.readFileSync("admin/index.html", "utf8");
  const source = fs.readFileSync("admin/admin.js", "utf8");
  const lookups = new Set(
    [...source.matchAll(/\$\(["']([^"']+)["']\)/g)].map((match) => match[1])
  );
  const elements = new Set(
    [...(html + "\n" + source).matchAll(/\bid=["']([^"']+)["']/g)]
      .map((match) => match[1])
  );
  const missing = [...lookups].filter((id) => !elements.has(id));
  assert.deepEqual(missing, [], `Unknown element IDs: ${missing.join(", ")}`);
  assert.ok(lookups.size >= 60, "admin ID regression coverage is unexpectedly small");
});
