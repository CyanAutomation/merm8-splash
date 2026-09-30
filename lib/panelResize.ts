export function calculateResizedPanelPercentage(
  currentPercentage: number,
  pointerDelta: number,
  containerSize: number,
  minPercentage: number,
  maxPercentage: number
): number {
  const safeCurrent = Math.min(maxPercentage, Math.max(minPercentage, currentPercentage))
  if (containerSize <= 0) return Math.round(safeCurrent)

  const nextPercentage = safeCurrent + (pointerDelta / containerSize) * 100
  return Math.round(Math.min(maxPercentage, Math.max(minPercentage, nextPercentage)))
}
