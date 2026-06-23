import fs from "node:fs";

const accountSourceFiles = [
  "features/account/AccountScreen.tsx",
  "features/account/account-screen.components.tsx",
  "features/account/account-screen.constants.ts",
  "features/account/account-screen.helpers.ts",
  "features/account/account-screen.styles.ts",
  "features/account/hooks/useAccountBackup.ts",
  "features/account/hooks/useAccountMusic.ts",
  "features/account/hooks/useAccountStats.ts"
];

export function readAccountSource() {
  return accountSourceFiles.map((path) => fs.readFileSync(path, "utf8")).join("\n");
}
