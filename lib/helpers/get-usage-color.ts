export const getUsageColor = (percentage: number) => {
  if (percentage > 80) return '#e11d48'
  if (percentage > 50) return '#facc15'
  return '#86efac' // Blue for low usage
}
