import { describe, it, expect } from "vitest";
import { deriveTags, type Client, type Visit } from "../lib/types";
import { daysAgoStr, todayStr } from "../lib/dates";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    tenant_id: "epic-menswear",
    name: "Test Client",
    phone: "604 000 0000",
    branch: "Victoria",
    events: [],
    alterations: [],
    follow_up: { needed: false },
    visits: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function visit(date: string, spend?: number, reason: Visit["reason"] = "Walk-in (purchased)"): Visit {
  return { id: `v-${date}-${spend}`, date, reason, spend };
}

describe("deriveTags", () => {
  it("VIP at exactly $1000 lifetime spend", () => {
    expect(deriveTags(makeClient({ visits: [visit(todayStr(), 999)] }))).not.toContain("VIP");
    expect(deriveTags(makeClient({ visits: [visit(todayStr(), 1000)] }))).toContain("VIP");
    expect(
      deriveTags(makeClient({ visits: [visit(todayStr(), 600), visit(daysAgoStr(10), 400)] }))
    ).toContain("VIP");
  });

  it("Returning at 2+ visits", () => {
    expect(deriveTags(makeClient({ visits: [visit(todayStr())] }))).not.toContain("Returning");
    expect(
      deriveTags(makeClient({ visits: [visit(todayStr()), visit(daysAgoStr(5))] }))
    ).toContain("Returning");
  });

  it("Cold at 90+ days since last visit, not before", () => {
    expect(deriveTags(makeClient({ visits: [visit(daysAgoStr(89))] }))).not.toContain("Cold");
    expect(deriveTags(makeClient({ visits: [visit(daysAgoStr(120))] }))).toContain("Cold");
    // no visits at all → no Cold tag (never visited ≠ lapsed)
    expect(deriveTags(makeClient())).not.toContain("Cold");
  });

  it("Alterations tag clears once picked up", () => {
    const base = { alterations: ["Hem"] as Client["alterations"] };
    expect(deriveTags(makeClient({ ...base, alteration_status: "Ready" }))).toContain("Alterations");
    expect(deriveTags(makeClient({ ...base, alteration_status: "Picked up" }))).not.toContain(
      "Alterations"
    );
  });

  it("Inquiry tag from inquiry visits", () => {
    expect(
      deriveTags(makeClient({ visits: [visit(todayStr(), undefined, "Walk-in (inquiry)")] }))
    ).toContain("Inquiry");
  });
});
