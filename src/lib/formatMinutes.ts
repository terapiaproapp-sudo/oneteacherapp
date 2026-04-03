/**
 * Formats decimal hours (e.g., 1.5) as "1h30" for display.
 * Internal storage uses decimal hours; this is for UI only.
 */
export function formatHoursDisplay(decimalHours: number): string {
  if (decimalHours <= 0) return "0min";
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}
