import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");

for (const snippet of [
  "let importSuccessCount = 0;",
  "let importFailureCount = 0;",
  "importSuccessCount += 1;",
  "importFailureCount += 1;",
  "importSuccessCount > 0",
  "const [studioLoadErrorMessage, setStudioLoadErrorMessage] = useState<string | null>(null);",
  "onRetry={loadStudio}",
  "{singleImageWorks.length > 0 ? (",
  "numColumns={2}",
  "columnWrapperStyle={styles.photoGridRow}",
  "styles.photoGridItem",
  "width: \"48%\""
]) {
  assert.ok(source.includes(snippet), `studio follow-up feedback missing: ${snippet}`);
}

assert.equal(
  source.includes("showStudioLoadError(error);"),
  false,
  "studio load failures should render an inline retry state instead of repeated alerts"
);

assert.equal(
  source.includes("flexGrow: 1"),
  false,
  "photo cards should not grow to fill a final odd row"
);

assert.equal(
  /<Text\s+selectable(?![={])/.test(source),
  false,
  "non-copy studio text should opt out of Android text selection UI"
);

console.log("ok - studio follow-up feedback is reflected");
