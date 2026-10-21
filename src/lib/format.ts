// Display helpers. Everything is formatted the Indian way (1,23,456.5).

export const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

type Numeric = number | string | { toString(): string } | null | undefined;

function toNumber(value: Numeric) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

const qtyFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const moneyFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function formatQty(value: Numeric, unit?: string | null) {
  const n = toNumber(value);
  if (n === null) return "—";
  return unit ? `${qtyFormat.format(n)} ${unit}` : qtyFormat.format(n);
}

export function formatSignedQty(value: Numeric, unit?: string | null) {
  const n = toNumber(value) ?? 0;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatQty(Math.abs(n), unit)}`;
}

export function formatMoney(value: Numeric) {
  const n = toNumber(value);
  return n === null ? "—" : moneyFormat.format(n);
}

export function formatPercent(value: Numeric) {
  const n = toNumber(value);
  return n === null ? "—" : `${qtyFormat.format(n)}%`;
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(date),
  );
}

/** Today's date in the business timezone, as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Formats a calendar date stored as a database DATE (no time of day). */
export function formatCalendarDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** The moment a calendar day starts in the business timezone (e.g. 2026-10-21 00:00 IST, as a Date). */
export function startOfDayInZone(iso: string, timeZone = APP_TIMEZONE) {
  const utcMidnight = new Date(`${iso}T00:00:00.000Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(utcMidnight)
      .map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(utcMidnight.getTime() - (asIfUtc - utcMidnight.getTime()));
}
