import { useEffect, useRef } from "react";

import { type AdPlacement } from "@/lib/ad-entitlement";
import { usePostSaveAd } from "@/lib/use-post-save-ad";

type InterstitialAdModalProps = {
  visible: boolean;
  placement: AdPlacement;
  onClose: () => void;
};

export function InterstitialAdModal({ visible, onClose }: InterstitialAdModalProps) {
  const { requestPostSaveAd, cancelPostSaveAd } = usePostSaveAd();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) return;
    requestPostSaveAd();
    onCloseRef.current();
  }, [requestPostSaveAd, visible]);

  useEffect(() => () => cancelPostSaveAd(), [cancelPostSaveAd]);

  return null;
}
