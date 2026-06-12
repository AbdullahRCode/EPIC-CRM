import { describe, it, expect } from "vitest";
import { todayStr, daysAgoStr, parseDateLocal } from "../lib/dates";

describe("todayStr", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses the store clock (America/Vancouver), not UTC", () => {
    // 2026-06-12 01:30 UTC is still 2026-06-11 6:30 pm in Vancouver (UTC-7).
    // The old toISOString() approach returned 2026-06-12 here — the
    // evening-entries-dated-tomorrow bug.
    const eveningUtc = new Date("2026-06-12T01:30:00Z");
    expect(todayStr(eveningUtc)).toBe("2026-06-11");
  });

  it("agrees with UTC during daytime hours", () => {
    const middayUtc = new Date("2026-06-11T18:00:00Z"); // 11 am Vancouver
    expect(todayStr(middayUtc)).toBe("2026-06-11");
  });
});

describe("daysAgoStr", () => {
  it("returns a date `days` before today (store clock)", () => {
    const today = todayStr();
    const yesterday = daysAgoStr(1);
    const diffMs =
      new Date(`${today}T12:00:00`).getTime() - new Date(`${yesterday}T12:00:00`).getTime();
    expect(Math.round(diffMs / 86400000)).toBe(1);
  });
});

describe("parseDateLocal", () => {
  it("parses date-only strings at local noon (no UTC-midnight day shift)", () => {
    const d = parseDateLocal("2026-06-11");
    expect(d.getDate()).toBe(11);
    expect(d.getMonth()).toBe(5);
    expect(d.getHours()).toBe(12);
  });

  it("passes full timestamps through", () => {
    const d = parseDateLocal("2026-06-11T08:15:00Z");
    expect(d.toISOString()).toBe("2026-06-11T08:15:00.000Z");
  });
});
