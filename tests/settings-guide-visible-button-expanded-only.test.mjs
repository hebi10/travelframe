import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("features/settings/SettingsScreen.tsx", "utf8");

const headerStart = source.indexOf("<View style={styles.guidePanelHeader}>");
const headerEnd = source.indexOf("<View style={styles.guideCollapsedRow}>", headerStart);
const headerSource = source.slice(headerStart, headerEnd);

assert.ok(headerStart >= 0 && headerEnd > headerStart, "settings guide header should exist");
assert.ok(
  !headerSource.includes("styles.guideVisibleButton"),
  "guide on/off button should not render in the collapsed header"
);

const expandedStart = source.indexOf("{guideExpanded ? (");
const visibleButtonIndex = source.indexOf("styles.guideVisibleButton", expandedStart);
const expandButtonIndex = source.indexOf("styles.guideExpandButton", expandedStart);

assert.ok(expandedStart >= 0, "settings guide panel should keep an expanded-only section");
assert.ok(
  visibleButtonIndex > expandedStart,
  "guide on/off button should only render inside the expanded section"
);
assert.ok(
  visibleButtonIndex < expandButtonIndex,
  "guide on/off button should render to the left of the collapse button"
);

console.log("ok - settings guide visibility button only shows when expanded");
