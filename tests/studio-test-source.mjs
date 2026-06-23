import fs from "node:fs";

const studioSourceFiles = [
  "features/studio/StudioScreen.tsx",
  "features/studio/studio-screen.components.tsx",
  "features/studio/studio-screen.model.ts",
  "features/studio/studio-screen.styles.ts"
];

export function readStudioSource() {
  return studioSourceFiles.map((path) => fs.readFileSync(path, "utf8")).join("\n");
}
