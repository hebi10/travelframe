import assert from "node:assert/strict";
import fs from "node:fs";

const settingsSource = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const modalTitleTexts = settingsSource.match(
  /<Text[^>]*style=\{\[styles\.modalTitle,\s*themed\.text\]\}[^>]*>/g
) ?? [];

assert.ok(modalTitleTexts.length > 0, "settings should render modal title text");

for (const titleText of modalTitleTexts) {
  assert.ok(
    titleText.includes("selectable={false}"),
    `settings modal title should not render Android selectable text background: ${titleText}`
  );
}

console.log("ok - settings modal titles avoid Android selectable text backgrounds");
