const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const isOwnedCloudBackupStoragePath = (uid, storagePath) => {
  if (!isNonEmptyString(uid) || !isNonEmptyString(storagePath)) {
    return false;
  }

  return (
    storagePath.startsWith(`users/${uid}/backups/photos/`) ||
    storagePath.startsWith(`users/${uid}/backups/image-works/`) ||
    storagePath.startsWith(`users/${uid}/backups/videos/`) ||
    storagePath.startsWith(`users/${uid}/music/`)
  );
};

const collectOwnedCloudBackupStoragePaths = ({
  uid,
  photoBackups = [],
  imageWorks = [],
  videos = [],
  musicTracks = []
}) => {
  const seen = new Set();
  const paths = [];
  const pushOwnedPath = (storagePath) => {
    if (!isOwnedCloudBackupStoragePath(uid, storagePath) || seen.has(storagePath)) {
      return;
    }

    seen.add(storagePath);
    paths.push(storagePath);
  };

  for (const photo of photoBackups) {
    pushOwnedPath(photo?.storagePath);
    pushOwnedPath(photo?.previewStoragePath);
  }

  for (const imageWork of imageWorks) {
    for (const storagePath of imageWork?.storagePaths ?? []) {
      pushOwnedPath(storagePath);
    }
  }

  for (const video of videos) {
    pushOwnedPath(video?.storagePath);
  }

  for (const musicTrack of musicTracks) {
    pushOwnedPath(musicTrack?.storagePath);
  }

  return paths;
};

exports.isOwnedCloudBackupStoragePath = isOwnedCloudBackupStoragePath;
exports.collectOwnedCloudBackupStoragePaths = collectOwnedCloudBackupStoragePaths;
