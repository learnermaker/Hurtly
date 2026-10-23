const DAY = 86_400_000;

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDay(t: number, now = Date.now()): string {
  const k = dayKey(t);
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(now - DAY)) return "Yesterday";
  return new Date(t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function daysAgo(n: number, now = Date.now()): number {
  return now - n * DAY;
}

export function relativeDays(t: number, now = Date.now()): string {
  const d = Math.floor((now - t) / DAY);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 60) return `${d} days ago`;
  return `${Math.round(d / 30)} months ago`;
}

export function errorText(e: unknown, fallback = "Something went wrong."): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
