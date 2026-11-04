// The grid shows newest first, so increasing a chronological position moves left.
export const getPhotoAccessibilityMoveIndex = (
  index: number,
  count: number,
  action: "increment" | "decrement"
) => Math.max(0, Math.min(count - 1, index + (action === "increment" ? -1 : 1)));

export const getPhotoPositionIndex = (input: string, count: number) => {
  if (!/^\d+$/.test(input.trim())) return null;
  const position = Number(input);
  return Number.isSafeInteger(position) && position >= 1 && position <= count
    ? count - position
    : null;
};
