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

  // ── Statistical forecasts (pure math, no AI) ──────────────────────────────
  const forecast = useMemo(() => {
    const now = Date.now();
    const today = todayStr();

    const lastVisit = (c: Client) => {
      const dates = (c.visits ?? []).map((v) => new Date(v.date).getTime());
      return dates.length ? Math.max(...dates) : null;
    };

    const clientSpend = (c: Client) =>
      (c.visits ?? []).reduce((s, v) => s + (v.spend ?? 0), 0);

    // Going cold: 60–89 days since last visit → will cross 90-day threshold in <30 days
    const goingCold = clients.filter((c) => {
      const lv = lastVisit(c);
      if (!lv) return false;
      const days = (now - lv) / 86400000;
      return days >= 60 && days < 90;
    }).length;

    // VIP pipeline: $500–$999 lifetime spend
    const vipPipeline = clients.filter((c) => {
      const s = clientSpend(c);
      return s >= 500 && s < 1000;
    });
    const avgToVip =
      vipPipeline.length > 0
        ? Math.round(
            vipPipeline.reduce((s, c) => s + (1000 - clientSpend(c)), 0) / vipPipeline.length
          )
        : 0;

    // Upcoming events in next 30 days
    const in30 = new Date(now + 30 * 86400000).toISOString().split("T")[0];
    const upcomingEvents = clients.filter(
      (c) => c.event_date && c.event_date >= today && c.event_date <= in30
    ).length;

    // Revenue run rate: last 30 days → projected annual
    const ago30 = new Date(now - 30 * 86400000).toISOString().split("T")[0];
    const last30Rev = clients.reduce(
      (s, c) =>
        s +
        (c.visits ?? [])
          .filter((v) => v.date >= ago30)
          .reduce((vs, v) => vs + (v.spend ?? 0), 0),
      0
    );
    const projectedAnnual = Math.round(last30Rev * 12);

    // Average return gap across all returning clients
    const gaps: number[] = [];
    clients.forEach((c) => {
      const sorted = (c.visits ?? []).map((v) => v.date).sort();
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(
          (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
        );
      }
    });
    const avgGap =
      gaps.length > 0
        ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
        : null;

    // Clients due back soon (±7 days of avg return gap)
    const dueSoon = avgGap
      ? clients.filter((c) => {
          const lv = lastVisit(c);
          if (!lv || (c.visits ?? []).length < 2) return false;
          const daysSince = (now - lv) / 86400000;
          return daysSince >= avgGap - 7 && daysSince <= avgGap + 7;
        }).length
      : 0;

    return { goingCold, vipPipeline: vipPipeline.length, avgToVip, upcomingEvents, last30Rev, projectedAnnual, avgGap, dueSoon };
  }, [clients]);

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
          <BranchBars clients={filteredClients} ownerMode={ownerMode} activeBranch={branch} />

          {/* Trend chart */}
          <TrendChart clients={filteredClients} dateFrom={dateFrom} dateTo={dateTo} />

          {/* Statistical forecast — pure math, no AI */}
          <div className="flex flex-col gap-5">
            <p className="section-title">Forecast</p>
            <div
              className="grid gap-0"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                border: "1px solid var(--line)",
              }}
            >
              {[
                {
                  value: forecast.goingCold,
                  label: "Going cold",
                  sub: "60–89 days inactive",
                  color: forecast.goingCold > 0 ? "var(--warn)" : "var(--muted)",
                },
                {
                  value: forecast.vipPipeline,
                  label: "VIP pipeline",
                  sub: forecast.vipPipeline > 0 ? `avg $${forecast.avgToVip} to threshold` : "none at $500–$999",
                  color: "var(--vip)",
                },
                {
                  value: forecast.upcomingEvents,
                  label: "Events in 30 days",
                  sub: "upcoming appointments",
                  color: forecast.upcomingEvents > 0 ? "var(--ink)" : "var(--muted)",
                },
                {
                  value: `$${forecast.last30Rev.toLocaleString()}`,
                  label: "Last 30-day revenue",
                  sub: `≈ $${(forecast.projectedAnnual).toLocaleString()} / yr run rate`,
                  color: "var(--good)",
                },
                {
                  value: forecast.avgGap !== null ? `${forecast.avgGap}d` : "—",
                  label: "Avg return gap",
                  sub: forecast.dueSoon > 0 ? `${forecast.dueSoon} client${forecast.dueSoon !== 1 ? "s" : ""} due now` : "between repeat visits",
                  color: "var(--ink)",
                },
              ].map((stat, i, arr) => (
                <div
                  key={stat.label}
                  className="flex flex-col gap-1 p-4"
                  style={{
                    borderRight: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <span
                    className="font-serif"
                    style={{ fontSize: "1.5rem", fontWeight: 400, color: stat.color }}
                  >
                    {stat.value}
                  </span>
                  <span className="label" style={{ color: "var(--ink)", fontSize: "0.58rem" }}>
                    {stat.label}
                  </span>
                  <span className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>
                    {stat.sub}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI summary */}
          <DailySummary ownerMode={ownerMode} branch={branch} />
        </div>
      )}
    </div>
  );
}
