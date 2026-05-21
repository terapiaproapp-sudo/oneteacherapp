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
  return `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Calculates the end time based on a start time string (HH:MM) and duration in decimal hours.
 */
export function calculateEndTime(startTime: string, duration: number): string {
  if (!startTime) return "";
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalStartMinutes = hours * 60 + minutes;
  const durationMinutes = Math.round(duration * 60);
  const totalEndMinutes = (totalStartMinutes + durationMinutes) % (24 * 60);

  const endHours = Math.floor(totalEndMinutes / 60);
  const endMinutes = totalEndMinutes % 60;

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

