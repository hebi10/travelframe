export const TRIP_CLIP_TITLE_PREFIX = "여행 클립";

const tripClipTitlePattern = /^여행\s*클립\s*(\d+)$/;

export const getNextTripClipTitle = (existingTitles: (string | null | undefined)[]) => {
  const maxNumber = existingTitles.reduce((maxNumber, title) => {
    if (!title) {
      return maxNumber;
    }

    const match = title.trim().match(tripClipTitlePattern);
    const titleNumber = match?.[1] ? Number(match[1]) : 0;
    return Number.isFinite(titleNumber) ? Math.max(maxNumber, titleNumber) : maxNumber;
  }, 0);

  return `${TRIP_CLIP_TITLE_PREFIX} ${maxNumber + 1}`;
};
