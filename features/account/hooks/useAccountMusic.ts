import { useState } from "react";
import type { User } from "firebase/auth";

import {
  getAppSettings,
  isCloudBackupTargetEnabled
} from "@/lib/app-settings";
import {
  deleteUserMusicTrack,
  pickAndUploadUserMusicTrack,
  type UserMusicTrack
} from "@/lib/user-music";
import { getAuthErrorMessage } from "@/features/account/account-screen.helpers";

export function useAccountMusicActions({
  user,
  musicTrackLimit,
  setMessage,
  setMusicTracks
}: {
  user: User | null;
  musicTrackLimit: number;
  setMessage: (message: string | null) => void;
  setMusicTracks: (tracks: UserMusicTrack[]) => void;
}) {
  const [isMusicSubmitting, setIsMusicSubmitting] = useState(false);

  const handleUploadMusic = async () => {
    if (isMusicSubmitting) {
      return;
    }

    try {
      setIsMusicSubmitting(true);
      setMessage(null);
      const appSettings = await getAppSettings();
      const nextTracks = await pickAndUploadUserMusicTrack(
        user,
        musicTrackLimit,
        {
          uploadToCloud: isCloudBackupTargetEnabled(appSettings, "music")
        }
      );
      setMusicTracks(nextTracks);
      setMessage("???뚯븙????ν뻽?듬땲?? ?곸긽 留뚮뱾湲곗뿉???좏깮?????덉뒿?덈떎.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsMusicSubmitting(false);
    }
  };

  const handleDeleteMusic = async (track: UserMusicTrack) => {
    if (isMusicSubmitting) {
      return;
    }

    try {
      setIsMusicSubmitting(true);
      setMessage(null);
      const nextTracks = await deleteUserMusicTrack({ user, track });
      setMusicTracks(nextTracks);
      setMessage("???뚯븙????젣?덉뒿?덈떎.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsMusicSubmitting(false);
    }
  };

  return {
    isMusicSubmitting,
    handleUploadMusic,
    handleDeleteMusic
  };
}
