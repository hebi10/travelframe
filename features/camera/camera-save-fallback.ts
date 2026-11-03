// Album permission recovery is a local choice; it must not opt into cloud backup.
export const createAppOnlySaveFallback = () => ({
  cameraSaveScope: "app" as const,
  storageMode: "local_only" as const,
  cloudBackupEnabled: false
});
