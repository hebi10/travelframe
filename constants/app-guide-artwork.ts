// Static requires keep all captured help images in Metro's asset graph.
const screenshotArtwork: Readonly<Record<string, number>> = {
  "body-frame-welcome": require("../assets/ui/guides/guide-capture-detail.png"),
  "body-frame-project": require("../assets/ui/guides/guide-project.png"),
  "body-frame-reference": require("../assets/ui/guides/guide-reference.png"),
  "body-frame-measurements": require("../assets/ui/guides/guide-measurements.png"),
  "body-frame-video": require("../assets/ui/guides/guide-video.png"),
  "body-frame-settings-backup": require("../assets/ui/guides/guide-settings.png"),
  "body-frame-records": require("../assets/ui/guides/guide-records.png"),
  "body-frame-account": require("../assets/ui/guides/guide-settings.png"),
  "body-frame-settings": require("../assets/ui/guides/guide-settings.png")
};

export function getAppGuideArtwork(stepId: string): number | null {
  return screenshotArtwork[stepId] ?? null;
}
