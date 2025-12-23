export const START_DATE = "2025-12-23"; // choose your “Day 0”

export function toISODate(d: Date): string {
  // local date (not UTC) so it matches Faroese users’ expectations
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysSinceStart(today: Date, startISO = START_DATE): number {
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
