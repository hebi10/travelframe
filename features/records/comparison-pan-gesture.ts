/**
 * Claim only horizontal slider gestures after a small movement threshold.
 * Leaving touch-start and vertical motion unclaimed lets the parent ScrollView scroll.
 */
export function shouldStartComparisonPan(dx: number, dy: number): boolean {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  return horizontal > 8 && horizontal > vertical * 1.2;
}
