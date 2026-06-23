import { useEffect, useRef } from "react";

import type { TripClipDraft } from "@/lib/trip-clip-draft";

export function useTripClipDraft(
  createTripClipDraftPayload: () => Omit<TripClipDraft, "updatedAt">
) {
  const latestTripClipDraftRef = useRef<Omit<TripClipDraft, "updatedAt"> | null>(null);

  useEffect(() => {
    latestTripClipDraftRef.current = createTripClipDraftPayload();
  }, [createTripClipDraftPayload]);

  return {
    latestTripClipDraftRef
  };
}
