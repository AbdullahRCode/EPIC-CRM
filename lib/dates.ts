// Store-local date handling.
//
// All visit/sale/event dates in the CRM are date-only strings (YYYY-MM-DD)
// meant in the business timezone (BC/Calgary stores → America/Vancouver).
// Vercel functions run in UTC, so `new Date().toISOString()` rolls any entry
// logged after ~4–5 pm Pacific onto tomorrow's date; `new Date("YYYY-MM-DD")`
// parses to UTC midnight, which is *yesterday* evening locally.

const BUSINESS_TZ = process.env.NEXT_PUBLIC_BUSINESS_TZ ?? "America/Vancouver";

/** Today's date (YYYY-MM-DD) on the store clock, safe on server and client. */
export function todayStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Store-local date N days ago (YYYY-MM-DD). */
export function daysAgoStr(days: number): string {
  return todayStr(new Date(Date.now() - days * 86400000));
}

/**
 * Parse a date-only string at local noon so comparisons and displays don't
 * shift a day across the UTC boundary. Falls through for full timestamps.
 */
export function parseDateLocal(d: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
}
