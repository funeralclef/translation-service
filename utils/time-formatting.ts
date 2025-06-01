/**
 * Converts decimal hours to a human-readable format
 * @param hours - The number of hours as a decimal (e.g., 2.5, 0.25, 1.75)
 * @returns A formatted string like "2 hours 30 minutes", "15 minutes", "1 hour"
 */
export function formatEstimatedTime(hours: number): string {
  if (hours <= 0) {
    return "0 minutes";
  }

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  // Handle cases where rounding minutes gives us 60
  const adjustedHours = minutes === 60 ? wholeHours + 1 : wholeHours;
  const adjustedMinutes = minutes === 60 ? 0 : minutes;

  if (adjustedHours === 0) {
    return `${adjustedMinutes} minute${adjustedMinutes !== 1 ? 's' : ''}`;
  } else if (adjustedMinutes === 0) {
    return `${adjustedHours} hour${adjustedHours !== 1 ? 's' : ''}`;
  } else {
    return `${adjustedHours} hour${adjustedHours !== 1 ? 's' : ''} ${adjustedMinutes} minute${adjustedMinutes !== 1 ? 's' : ''}`;
  }
}

/**
 * Converts decimal hours to a compact format
 * @param hours - The number of hours as a decimal
 * @returns A compact formatted string like "2h 30m", "15m", "1h"
 */
export function formatEstimatedTimeCompact(hours: number): string {
  if (hours <= 0) {
    return "0m";
  }

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  // Handle cases where rounding minutes gives us 60
  const adjustedHours = minutes === 60 ? wholeHours + 1 : wholeHours;
  const adjustedMinutes = minutes === 60 ? 0 : minutes;

  if (adjustedHours === 0) {
    return `${adjustedMinutes}m`;
  } else if (adjustedMinutes === 0) {
    return `${adjustedHours}h`;
  } else {
    return `${adjustedHours}h ${adjustedMinutes}m`;
  }
} 