"use client";

import { useEffect, useState, useMemo } from "react";
import type { Client, Branch } from "@/lib/types";
import { getClients } from "@/app/actions/clients";
import { useBranchOwner } from "@/lib/branch-context";
import BranchBars from "@/components/BranchBars";
import TrendChart from "@/components/TrendChart";
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
  const coldCount = clients.filter((c) => deriveTags(c).includes("Cold")).length;
  const followUpCount = clients.filter((c) => c.follow_up?.needed).length;
  const alterationsReady = clients.filter((c) => c.alteration_status === "Ready").length;
  const ordersArrived = clients.filter((c) => c.special_order_status === "Arrived").length;

  const STATS = [
    {
      label: rangeState.preset === "all" ? "Total clients" : "Active clients",
      value: activeClients,
    },
    { label: "VIP", value: vipCount, color: "var(--vip)" },
    { label: "Cold (90d+)", value: coldCount, color: "var(--muted)" },
    { label: "Follow-ups", value: followUpCount, color: "var(--danger)" },
    {
      label: rangeState.preset === "all" ? "Total revenue" : "Revenue in period",
      value: `$${totalRevenue.toLocaleString()}`,
      color: "var(--good)",
    },
    { label: "Alt. ready", value: alterationsReady, color: "var(--good)" },
    { label: "Orders arrived", value: ordersArrived, color: "var(--good)" },
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

  const maxProductCount = Math.max(...topProducts.map((p) => p.count), 1);

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
        <button
          className="btn btn-ghost insights-export-btn flex-shrink-0"
          onClick={() => window.print()}
          style={{ alignSelf: "center" }}
        >
          Export Report
        </button>
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

          {/* Quick stats grid — 2 cols mobile, 4 tablet, 7 desktop */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 insights-stats-grid"
            style={{ border: "1px solid var(--line)" }}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 p-4"
                style={{
                  borderRight:
                    i < STATS.length - 1 ? "1px solid var(--line)" : "none",
                  borderBottom: "none",
                }}
              >
                <span
                  className="font-serif"
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 400,
                    color: stat.color ?? "var(--ink)",
                  }}
                >
                  {stat.value}
                </span>
                <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                  {stat.label}
                </span>
              </div>
            ))}
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
              <div className="flex flex-col gap-3">
                {topProducts.map((product, idx) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <span
                      className="label flex-shrink-0"
                      style={{
                        color: idx === 0 ? "var(--vip)" : "var(--muted)",
                        fontSize: "0.6rem",
                        width: "1.5rem",
                        textAlign: "right",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          style={{
                            fontSize: "0.88rem",
                            fontWeight: idx === 0 ? 600 : 400,
                            color: idx === 0 ? "var(--ink)" : "var(--ink)",
                          }}
                        >
                          {product.name}
                        </span>
                        <div className="flex gap-3">
                          <span className="label" style={{ color: "var(--muted)" }}>
                            {product.count} sale{product.count !== 1 ? "s" : ""}
                          </span>
                          {product.revenue > 0 && (
                            <span
                              className="label"
                              style={{ color: idx === 0 ? "var(--vip)" : "var(--good)" }}
                            >
                              ${product.revenue.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Horizontal bar */}
                      <div
                        style={{
                          height: 3,
                          background: "var(--line)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            height: "100%",
                            width: `${(product.count / maxProductCount) * 100}%`,
                            background: idx === 0 ? "var(--vip)" : "var(--ink)",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Staff leaderboard */}
          <div>
            <p className="section-title">Top Staff</p>
            {!hasStaffData ? (
              <p className="label" style={{ color: "var(--muted)" }}>
                Start logging employee names on each visit to see rankings.
              </p>
            ) : topStaff.length === 0 ? (
              <p className="label" style={{ color: "var(--muted)" }}>
                No staff data in this period.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {topStaff.map((staff, idx) => (
                  <div key={staff.displayName} className="flex items-center gap-3">
                    <span
                      className="label flex-shrink-0"
                      style={{
                        color: idx === 0 ? "var(--vip)" : "var(--muted)",
                        fontSize: idx === 0 ? "0.85rem" : "0.6rem",
                        width: "1.5rem",
                        textAlign: "right",
                      }}
                    >
                      {idx === 0 ? "✦" : idx + 1}
                    </span>
                    <div className="flex-1 flex items-center justify-between gap-2 flex-wrap">
                      <span
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: idx === 0 ? 600 : 400,
                          textTransform: "capitalize",
                        }}
                      >
                        {staff.displayName}
                      </span>
                      <div className="flex gap-3">
                        <span className="label" style={{ color: "var(--muted)" }}>
                          {staff.count} sale{staff.count !== 1 ? "s" : ""}
                        </span>
                        {staff.revenue > 0 && (
                          <span
                            className="label"
                            style={{ color: idx === 0 ? "var(--vip)" : "var(--good)" }}
                          >
                            ${staff.revenue.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branch comparison bars */}
          <div className="branch-bars-container">
            <BranchBars
              clients={filteredClients}
              ownerMode={ownerMode}
              activeBranch={branch}
            />
          </div>

          {/* Trend chart */}
          <div
            className="trend-chart-container overflow-x-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <TrendChart clients={filteredClients} dateFrom={dateFrom} dateTo={dateTo} />
          </div>

          {/* AI daily summary */}
          <DailySummary ownerMode={ownerMode} branch={branch} />
        </div>
      )}
    </div>
  );
}
