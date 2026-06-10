"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import type { Client, Branch } from "@/lib/types";
import { getClients } from "@/app/actions/clients";
import { useBranchOwner } from "@/lib/branch-context";
import BranchBars from "@/components/BranchBars";
import DailySummary from "@/components/DailySummary";
import DonutChart from "@/components/DonutChart";
import { deriveTags } from "@/lib/types";

type DatePreset = "yesterday" | "today" | "week" | "month" | "all" | "custom";

interface RangeState {
  preset: DatePreset;
  customFrom: string;
  customTo: string;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function computeRange(state: RangeState, clients: Client[]): { from: string; to: string } {
  const today = todayStr();
  const yesterday = yesterdayStr();

  if (state.preset === "yesterday") return { from: yesterday, to: yesterday };
  if (state.preset === "today") return { from: today, to: today };
  if (state.preset === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().split("T")[0], to: today };
  }
  if (state.preset === "month") {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return { from: d.toISOString().split("T")[0], to: today };
  }
  if (state.preset === "custom") {
    return { from: state.customFrom || today, to: state.customTo || today };
  }
  // "all"
  const allDates = clients.flatMap((c) => (c.visits ?? []).map((v) => v.date)).sort();
  const earliest =
    allDates[0] ?? new Date(Date.now() - 2 * 365 * 86400000).toISOString().split("T")[0];
  return { from: earliest, to: today };
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Yesterday", value: "yesterday" },
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" },
];

function parseProductGroup(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("calvin klein")) return "Calvin Klein";
  if (t.includes("carlo lusso")) return "Carlo Lusso";
  if (t.includes("giorgio") || t.includes("fiorelli")) return "Giorgio Fiorelli";
  if (t.includes("mantoni")) return "Mantoni";
  if (t.includes("tommy")) return "Tommy Hilfiger";
  if (t.includes("bertolini")) return "Bertolini";
  if (t.includes("renoir")) return "Renoir";
  if (t.includes("shirt")) return "Dress Shirt";
  if (t.includes("tie")) return "Ties & Accessories";
  if (t.includes("shoe") || t.includes("boot")) return "Footwear";
  if (t.includes("sport") || t.includes("blazer")) return "Sports Coat";
  if (t.includes("tux")) return "Tuxedo";
  return "Other";
}

export default function InsightsPage() {
  const { branch, ownerMode } = useBranchOwner();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeState, setRangeState] = useState<RangeState>({
    preset: "all",
    customFrom: todayStr(),
    customTo: todayStr(),
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getClients(branch === "All" ? undefined : (branch as Branch));
        setClients(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [branch]);

  const { from: dateFrom, to: dateTo } = useMemo(
    () => computeRange(rangeState, clients),
    [rangeState, clients]
  );

  const filteredClients = useMemo(() => {
    if (rangeState.preset === "all") return clients;
    return clients.map((c) => ({
      ...c,
      visits: (c.visits ?? []).filter((v) => v.date >= dateFrom && v.date <= dateTo),
    }));
  }, [clients, rangeState.preset, dateFrom, dateTo]);

  // Stats
  const activeClients =
    rangeState.preset === "all"
      ? clients.length
      : filteredClients.filter((c) => c.visits.length > 0).length;

  const totalRevenue = filteredClients.reduce(
    (s, c) => s + (c.visits ?? []).reduce((vs, v) => vs + (v.spend ?? 0), 0),
    0
  );

  const vipCount = clients.filter((c) => deriveTags(c).includes("VIP")).length;
  const followUpCount = clients.filter((c) => c.follow_up?.needed).length;
  const alterationsReady = clients.filter((c) => c.alteration_status === "Ready").length;

  const PERF_STATS = [
    {
      label: rangeState.preset === "all" ? "Total clients" : "Active clients",
      value: String(activeClients),
      color: "var(--ink)",
    },
    {
      label: rangeState.preset === "all" ? "Total revenue" : "Revenue in period",
      value: `$${totalRevenue.toLocaleString()}`,
      color: "var(--good)",
    },
  ];

  const STATS = [
    { label: "Follow-ups", value: followUpCount, color: "var(--danger)" },
    { label: "Alt. Ready", value: alterationsReady, color: "var(--good)" },
    { label: "VIP", value: vipCount, color: "var(--vip)" },
  ];

  // Revenue and client count by branch (for donut chart)
  const revenueByBranch = useMemo(() => {
    const result: Partial<Record<Branch, number>> = {};
    filteredClients.forEach((c) => {
      const spend = (c.visits ?? []).reduce((s, v) => s + (v.spend ?? 0), 0);
      result[c.branch] = (result[c.branch] ?? 0) + spend;
    });
    return result;
  }, [filteredClients]);

  const clientsByBranch = useMemo(() => {
    const result: Partial<Record<Branch, number>> = {};
    filteredClients.forEach((c) => {
      result[c.branch] = (result[c.branch] ?? 0) + 1;
    });
    return result;
  }, [filteredClients]);

  // Top Products Sold
  const topProducts = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {};
    filteredClients.forEach((c) => {
      (c.visits ?? []).forEach((v) => {
        if (!v.items?.trim()) return;
        const group = parseProductGroup(v.items);
        if (!counts[group]) counts[group] = { count: 0, revenue: 0 };
        counts[group].count++;
        counts[group].revenue += v.spend ?? 0;
      });
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredClients]);

  // Top Staff
  const topStaff = useMemo(() => {
    const staffMap: Record<string, { displayName: string; count: number; revenue: number }> = {};
    filteredClients.forEach((c) => {
      (c.visits ?? []).forEach((v) => {
        const name = v.staff?.trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!staffMap[key]) staffMap[key] = { displayName: name, count: 0, revenue: 0 };
        staffMap[key].count++;
        staffMap[key].revenue += v.spend ?? 0;
      });
    });
    return Object.values(staffMap)
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .slice(0, 5);
  }, [filteredClients]);

  const hasStaffData = useMemo(() => {
    return filteredClients.some((c) => (c.visits ?? []).some((v) => v.staff?.trim()));
  }, [filteredClients]);

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 97px)" }}>
      {/* Page header */}
      <div
        className="px-4 sm:px-6 pt-5 pb-3 flex items-start justify-between gap-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div>
          <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
            <em>Insights</em>
          </h1>
          <p className="label mt-1" style={{ color: "var(--muted)" }}>
            {branch === "All" ? "All branches" : branch} — performance at a glance
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className="btn btn-ghost insights-export-btn flex-shrink-0"
            onClick={() => window.print()}
          >
            Export Report
          </button>
          {ownerMode && (
            <button
              className="btn btn-ghost"
              onClick={async () => {
                const res = await fetch(`/api/reports/daily?secret=${process.env.NEXT_PUBLIC_REPORT_SECRET ?? "epic-report-2026"}&type=daily`);
                if (res.ok) alert("Daily report sent to owner email.");
                else alert("Failed to send report — check Resend API key in Vercel.");
              }}
              style={{ fontSize: "0.6rem", letterSpacing: "0.15em" }}
            >
              ✉ Send Daily Report
            </button>
          )}
        </div>
      </div>

      {/* Date range picker */}
      <div
        className="px-4 sm:px-6 py-3 flex flex-col gap-3 insights-controls"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = rangeState.preset === p.value;
            return (
              <button
                key={p.value}
                className="btn"
                style={{
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--paper)" : "var(--muted)",
                  borderColor: active ? "var(--ink)" : "var(--line)",
                  minHeight: 44,
                }}
                onClick={() => setRangeState((r) => ({ ...r, preset: p.value }))}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {rangeState.preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              className="input-line"
              style={{ maxWidth: "9rem" }}
              value={rangeState.customFrom}
              onChange={(e) => setRangeState((r) => ({ ...r, customFrom: e.target.value }))}
            />
            <span className="label" style={{ color: "var(--muted)" }}>to</span>
            <input
              type="date"
              className="input-line"
              style={{ maxWidth: "9rem" }}
              value={rangeState.customTo}
              onChange={(e) => setRangeState((r) => ({ ...r, customTo: e.target.value }))}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="label" style={{ color: "var(--muted)" }}>Loading...</span>
        </div>
      ) : (
        <div className="px-4 sm:px-6 py-6 flex flex-col gap-10 insights-print-container">

          {/* Stats — Group 1: Performance */}
          <div className="flex flex-col gap-3 insights-stats-grid">
            <div className="grid grid-cols-2 gap-0">
              {PERF_STATS.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    border: "1px solid var(--line)",
                    padding: "1.25rem 1rem",
                    background: "var(--paper)",
                  }}
                >
                  <p
                    className="font-serif"
                    style={{ fontSize: "2rem", fontWeight: 300, color: stat.color, lineHeight: 1.1 }}
                  >
                    {stat.value}
                  </p>
                  <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem", marginTop: "0.35rem" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Stats — Group 2: Status */}
            <div className="grid grid-cols-3 gap-0">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    border: "1px solid var(--line)",
                    padding: "1.25rem 1rem",
                    background: "var(--paper)",
                  }}
                >
                  <p
                    className="font-serif"
                    style={{ fontSize: "2rem", fontWeight: 300, color: stat.color, lineHeight: 1.1 }}
                  >
                    {stat.value}
                  </p>
                  <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem", marginTop: "0.35rem" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* AI daily summary */}
          <div style={{ border: "1px solid var(--line)", padding: "1.5rem" }}>
            <DailySummary ownerMode={ownerMode} branch={branch} />
          </div>

          {/* Revenue by branch donut chart */}
          <div>
            <p className="section-title">Revenue by Branch</p>
            <div className="flex justify-center sm:justify-start overflow-x-auto">
              <DonutChart
                revenueByBranch={revenueByBranch}
                clientsByBranch={clientsByBranch}
                activeBranch={branch}
              />
            </div>
          </div>

          {/* Top Products Sold */}
          <div>
            <p className="section-title">Top Products Sold</p>
            {topProducts.length === 0 ? (
              <p className="label" style={{ color: "var(--muted)" }}>
                No purchase data in this period. Log items on visits to see rankings.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 0,
                }}
              >
                {topProducts.map((product, idx) => (
                  <div
                    key={product.name}
                    style={{
                      border: "1px solid var(--line)",
                      borderTop: idx === 0 ? "2px solid var(--vip)" : "1px solid var(--line)",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <p className="font-serif" style={{ fontSize: "1rem", fontStyle: "italic", color: "var(--ink)" }}>
                      {product.name}
                    </p>
                    <p style={{ fontSize: "1.6rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1 }}>
                      {product.count}
                    </p>
                    <p className="label" style={{ fontSize: "0.5rem", color: "var(--muted)" }}>
                      {product.count === 1 ? "SALE" : "SALES"}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--vip)", marginTop: "auto", paddingTop: "0.5rem" }}>
                      {product.revenue > 0 ? `$${product.revenue.toLocaleString()}` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Staff leaderboard */}
          <div>
            <p className="section-title">Top Staff</p>
            {topStaff.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 0,
                }}
              >
                {topStaff.map((staff, idx) => (
                  <div
                    key={staff.displayName}
                    style={{
                      border: "1px solid var(--line)",
                      borderTop: idx === 0 ? "2px solid var(--vip)" : "1px solid var(--line)",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <p className="font-serif" style={{ fontSize: "1rem", fontStyle: "italic", color: "var(--ink)" }}>
                      {idx === 0 && <span style={{ color: "var(--vip)", marginRight: "0.3rem" }}>✦</span>}
                      <span style={{ textTransform: "capitalize" }}>{staff.displayName}</span>
                    </p>
                    <p style={{ fontSize: "1.6rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1 }}>
                      {staff.count}
                    </p>
                    <p className="label" style={{ fontSize: "0.5rem", color: "var(--muted)" }}>
                      {staff.count === 1 ? "SALE" : "SALES"}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--vip)", marginTop: "auto", paddingTop: "0.5rem" }}>
                      {staff.revenue > 0 ? `$${staff.revenue.toLocaleString()}` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {!hasStaffData && (
              <p className="label" style={{ color: "var(--muted)", marginTop: "0.75rem", fontSize: "0.6rem" }}>
                Log employee names on each visit to build rankings.
              </p>
            )}
            {hasStaffData && topStaff.length === 0 && (
              <p className="label" style={{ color: "var(--muted)" }}>
                No staff data in this period.
              </p>
            )}
          </div>

          {/* Branch comparison */}
          <div>
            <BranchBars
              clients={filteredClients}
              ownerMode={ownerMode}
              activeBranch={branch}
            />
          </div>

        </div>
      )}
    </div>
  );
}
