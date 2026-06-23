import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { User } from "firebase/auth";

import { getAppSettings, type StorageMode } from "@/lib/app-settings";
import { getImageBundleWorks } from "@/lib/work-library";
import { getMadeVideos } from "@/lib/video-library";
import { getPhotos } from "@/lib/photo-library";
import {
  getUserSubscriptionProducts,
  type UserSubscriptionProducts
} from "@/lib/subscription";
import { syncUserMusicTracks, type UserMusicTrack } from "@/lib/user-music";
import {
  getWeeklyVideoExportUsage,
  type WeeklyVideoExportUsage
} from "@/lib/video-export-quota";
import {
  initialStats,
  initialSubscriptionProducts,
  type UsageStats
} from "@/features/account/account-screen.constants";

export function useAccountStats({
  user,
  weeklyVideoExportLimit
}: {
  user: User | null;
  weeklyVideoExportLimit: number;
}) {
  const [stats, setStats] = useState<UsageStats>(initialStats);
  const [storageMode, setStorageMode] = useState<StorageMode>("local_only");
  const [isSubscriptionProductsLoading, setIsSubscriptionProductsLoading] =
    useState(true);
  const [subscriptionProducts, setSubscriptionProducts] = useState<UserSubscriptionProducts>(
    initialSubscriptionProducts
  );
  const [musicTracks, setMusicTracks] = useState<UserMusicTrack[]>([]);
  const [weeklyVideoExportUsage, setWeeklyVideoExportUsage] =
    useState<WeeklyVideoExportUsage | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsSubscriptionProductsLoading(true);

      const loadStats = async () => {
        const [
          photos,
          videos,
          imageBundles,
          userMusicTracks,
          appSettings,
          nextSubscriptionProducts,
          nextWeeklyVideoExportUsage
        ] = await Promise.all([
          getPhotos(),
          getMadeVideos(),
          getImageBundleWorks(),
          user ? syncUserMusicTracks(user) : Promise.resolve([]),
          getAppSettings(),
          getUserSubscriptionProducts(user),
          getWeeklyVideoExportUsage(user, weeklyVideoExportLimit)
        ]);

        if (!isActive) {
          return;
        }

        setStats({
          originalPhotos: photos.filter((photo) => photo.kind === "original").length,
          editedPhotos: photos.filter((photo) => photo.kind === "edited").length,
          imageBundles: imageBundles.length,
          videos: videos.length
        });
        setStorageMode(appSettings.storageMode);
        setMusicTracks(userMusicTracks);
        setSubscriptionProducts(nextSubscriptionProducts);
        setWeeklyVideoExportUsage(nextWeeklyVideoExportUsage);
        setIsSubscriptionProductsLoading(false);
      };

      loadStats().catch(() => {
        if (isActive) {
          setIsSubscriptionProductsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [user, weeklyVideoExportLimit])
  );

  return {
    stats,
    storageMode,
    isSubscriptionProductsLoading,
    subscriptionProducts,
    musicTracks,
    setMusicTracks,
    weeklyVideoExportUsage
  };
}
