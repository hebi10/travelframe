// Only the camera destination changes; other features keep their backup preferences.
export const createAppOnlySaveFallback = () => ({
  cameraSaveScope: "app" as const
});
