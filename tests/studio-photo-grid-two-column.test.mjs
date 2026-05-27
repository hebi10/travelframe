import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(tabs)/studio.tsx", "utf8");
const paginatedGridStart = source.indexOf("function PaginatedPhotoGrid");
const paginatedGridEnd = source.indexOf("function BackupUsageBadge", paginatedGridStart);
const stylesStart = source.indexOf("const styles = StyleSheet.create({");

assert.ok(
  paginatedGridStart >= 0 && paginatedGridEnd > paginatedGridStart,
  "studio should define PaginatedPhotoGrid"
);
assert.ok(stylesStart >= 0, "studio should define styles");

const paginatedGrid = source.slice(paginatedGridStart, paginatedGridEnd);
const styles = source.slice(stylesStart);
const photoCardStyle = styles.slice(
  styles.indexOf("photoCard: {"),
  styles.indexOf("thumbnail:", styles.indexOf("photoCard: {"))
);

assert.ok(source.includes("FlatList"), "photo grid should use FlatList for a stable two-column layout");
assert.ok(
  paginatedGrid.includes("numColumns={2}"),
  "photo grid should explicitly render two columns"
);
assert.ok(
  paginatedGrid.includes("columnWrapperStyle={styles.photoGridRow}"),
  "photo grid should define row layout through columnWrapperStyle"
);
assert.ok(
  paginatedGrid.includes("styles.photoGridItem"),
  "photo grid should wrap each thumbnail in a fixed-width item container"
);
assert.ok(
  styles.includes("photoGridItem: {") && styles.includes('width: "48%"'),
  "photo grid items should remain about half-width even when the last row has one item"
);
assert.ok(
  !photoCardStyle.includes("flexGrow"),
  "photo cards should not grow to fill a final odd row"
);

console.log("ok - studio photo grid keeps odd final items half width");
