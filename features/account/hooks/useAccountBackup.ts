import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import {
  initialBackupOverview
} from "@/features/account/account-screen.constants";
import {
  subscribeCloudBackupOverview,
  type CloudBackupOverview
} from "@/lib/cloud-backup";

export function useAccountBackupOverview(user: User | null) {
  const [backupOverview, setBackupOverview] =
    useState<CloudBackupOverview>(initialBackupOverview);

  useEffect(
    () =>
      subscribeCloudBackupOverview({
        user,
        onChange: setBackupOverview
      }),
    [user]
  );

  return backupOverview;
}
