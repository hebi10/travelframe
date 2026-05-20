export const assertLocalLibraryCapacity = ({
  currentCount,
  limit,
  label
}: {
  currentCount: number;
  limit?: number;
  label: string;
}) => {
  if (limit === undefined) {
    return;
  }

  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  const safeCount = Math.max(0, Math.floor(Number(currentCount) || 0));

  if (safeCount >= safeLimit) {
    throw new Error(`${label} 보관함 한도 ${safeLimit}개를 모두 사용했습니다.`);
  }
};
