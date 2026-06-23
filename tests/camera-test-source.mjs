import fs from "node:fs";

const cameraSourceFiles = [
  "features/camera/CameraScreen.tsx",
  "features/camera/camera-screen.components.tsx",
  "features/camera/camera-screen.constants.ts",
  "features/camera/camera-screen.helpers.ts",
  "features/camera/camera-screen.model.ts",
  "features/camera/camera-screen.styles.ts"
];

export function readCameraSource() {
  return cameraSourceFiles.map((path) => fs.readFileSync(path, "utf8")).join("\n");
}
