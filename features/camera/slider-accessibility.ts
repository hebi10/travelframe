export const getAccessibleSliderValue = (
  value: number,
  min: number,
  max: number,
  action: "increment" | "decrement"
) => {
  const step = (max - min) / 10;
  const next = value + (action === "increment" ? step : -step);
  return Number(Math.max(min, Math.min(max, next)).toFixed(6));
};
