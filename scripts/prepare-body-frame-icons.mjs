import fs from "node:fs/promises";
import { generateImageAsync, generateImageBackgroundAsync, compositeImagesAsync } from "@expo/image-utils";

// Package the approved artwork for Android; do not redraw or alter the mark.
const projectRoot = process.cwd();
const src = "assets/icons/body-frame-approved.png";
for (const [name, padding] of [["app-icon.png", 0], ["adaptive-icon.png", 128], ["splash-icon.png", 128]]) {
  const { source } = await generateImageAsync({ projectRoot }, {
    src, name, width: 1024 - padding * 2, height: 1024 - padding * 2, resizeMode: "contain",
    backgroundColor: "#151719"
  });
  const output = padding ? await compositeImagesAsync({
    foreground: source,
    background: await generateImageBackgroundAsync({ width: 1024, height: 1024, resizeMode: "contain", backgroundColor: "#151719" }),
    x: padding, y: padding
  }) : source;
  await fs.writeFile(`assets/icons/${name}`, output);
  console.log(`Prepared ${name} (1024px, ${padding}px safe-area padding)`);
}
