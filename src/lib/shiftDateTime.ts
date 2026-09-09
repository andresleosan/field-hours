/** Calendar fields in the same organization timezone used by the shift history. */
export function shiftDateTime(value: string | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const field = (name: string) => parts.find((part) => part.type === name)?.value;
  return `${field("year")}-${field("month")}-${field("day")}T${field("hour")}:${field("minute")}`;
}

/** Resolve wall time without relying on the browser's timezone. */
export function shiftDateTimeToIso(value: string, timezone: string, original?: string | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== value) return null;

  // Preserve seconds and the exact occurrence of repeated autumn clock times.
  if (original && shiftDateTime(original, timezone) === value) return original;

  // Sample both sides of a DST transition, then round-trip each possible offset.
  const offsets = new Set([-1, 0, 1].map((day) => {
    const sample = wall + day * 86_400_000;
    return Date.parse(`${shiftDateTime(new Date(sample), timezone)}:00Z`) - sample;
  }));
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((instant) => shiftDateTime(new Date(instant), timezone) === value)
    .sort((a, b) => a - b);
  if (!candidates.length) return null; // A skipped spring-forward time does not exist.
  // When editing within a repeated hour, stay closest to the recorded occurrence.
  if (original) candidates.sort((a, b) => Math.abs(a - Date.parse(original)) - Math.abs(b - Date.parse(original)));
  return new Date(candidates[0]).toISOString();
}
