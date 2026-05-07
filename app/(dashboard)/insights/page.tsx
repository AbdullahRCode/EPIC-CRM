"use client";

import { useEffect, useState, useMemo } from "react";
import type { Client, Branch } from "@/lib/types";
import { getClients } from "@/app/actions/clients";
import { useBranchOwner } from "@/lib/branch-context";
import BranchBars from "@/components/BranchBars";
import TrendChart from "@/components/TrendChart";
import DailySummary from "@/components/DailySummary";
import { deriveTags } from "@/lib/types";

type DatePreset = "today" | "week" | "month" | "year" | "all" | "custom";

interface RangeState {
  preset: DatePreset;
  customFrom: string;
  customTo: string;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function computeRange(state: RangeState, clients: Client[]): { from: string; to: string } {
  const today = todayStr();
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
  if (state.preset === "year") {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    d.setDate(d.getDate() + 1);
    return { from: d.toISOString().split("T")[0], to: today };
  }
  if (state.preset === "custom") {
    return { from: state.customFrom || today, to: state.customTo || today };
  }
  // "all" — earliest recorded visit to today
  const allDates = clients.flatMap((c) => (c.visits ?? []).map((v) => v.date)).sort();
  const earliest =
    allDates[0] ??
    new Date(Date.now() - 2 * 365 * 86400000).toISOString().split("T")[0];
  return { from: earliest, to: today };
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
  { label: "This year", value: "year" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" },
];

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

  // Clients with visits pre-filtered to the selected range
  const filteredClients = useMemo(() => {
    if (rangeState.preset === "all") return clients;
    return clients.map((c) => ({
      ...c,
      visits: (c.visits ?? []).filter((v) => v.date >= dateFrom && v.date <= dateTo),
    }));
  }, [clients, rangeState.preset, dateFrom, dateTo]);

  // Revenue and active clients are range-aware
  const activeClients =
    rangeState.preset === "all"
      ? clients.length
      : filteredClients.filter((c) => c.visits.length > 0).length;

  const totalRevenue = filteredClients.reduce(
    (s, c) => s + (c.visits ?? []).reduce((vs, v) => vs + (v.spend ?? 0), 0),
    0
  );

  // Status indicators always reflect current state
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

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 97px)" }}>
      <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          <em>Insights</em>
        </h1>
        <p className="label mt-1" style={{ color: "var(--muted)" }}>
          {branch === "All" ? "All branches" : branch} — performance at a glance
        </p>
      </div>

      {/* Date range picker */}
      <div
        className="px-6 py-3 flex flex-col gap-3"
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
                }}
                onClick={() => setRangeState((r) => ({ ...r, preset: p.value }))}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {rangeState.preset === "custom" && (
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="input-line"
              style={{ maxWidth: "9rem" }}
              value={rangeState.customFrom}
              onChange={(e) =>
                setRangeState((r) => ({ ...r, customFrom: e.target.value }))
              }
            />
            <span className="label" style={{ color: "var(--muted)" }}>
              to
            </span>
            <input
              type="date"
              className="input-line"
              style={{ maxWidth: "9rem" }}
              value={rangeState.customTo}
              onChange={(e) =>
                setRangeState((r) => ({ ...r, customTo: e.target.value }))
              }
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="label" style={{ color: "var(--muted)" }}>Loading...</span>
        </div>
      ) : (
        <div className="px-6 py-6 flex flex-col gap-10">
          {/* Quick stats */}
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              border: "1px solid var(--line)",
            }}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 p-4"
                style={{
                  borderRight: i < STATS.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <span
                  className="font-serif"
                  style={{
                    fontSize: "1.6rem",
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

          {/* Branch comparison */}
          <BranchBars clients={filteredClients} />

          {/* Trend chart */}
          <TrendChart clients={filteredClients} dateFrom={dateFrom} dateTo={dateTo} />

          {/* AI daily summary */}
          <DailySummary ownerMode={ownerMode} />
        </div>
      )}
    </div>
  );
}
