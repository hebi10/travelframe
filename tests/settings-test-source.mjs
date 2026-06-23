import fs from "node:fs";

const settingsSourceFiles = [
  "features/settings/SettingsScreen.tsx",
  "features/settings/settings-screen.components.tsx",
  "features/settings/settings-screen.constants.ts",
  "features/settings/settings-screen.helpers.ts",
  "features/settings/settings-screen.model.ts",
  "features/settings/settings-screen.styles.ts"
];

export function readSettingsSource() {
  return settingsSourceFiles.map((path) => fs.readFileSync(path, "utf8")).join("\n");
}
