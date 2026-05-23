"use client";

import { useState, useEffect } from "react";
import type { Client } from "@/lib/types";

type Granularity = "daily" | "weekly" | "monthly";

interface TrendChartProps {
  clients: Client[];
  dateFrom: string;
  dateTo: string;
}

interface Bucket {
  label: string;
  key: string;
  granularity: Granularity;
}

function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split("T")[0];
}

function visitMatchesBucket(visitDate: string, bucket: Bucket): boolean {
  if (bucket.granularity === "daily") return visitDate === bucket.key;
  if (bucket.granularity === "weekly") return getWeekMonday(visitDate) === bucket.key;
  return visitDate.startsWith(bucket.key);
}

function getBuckets(dateFrom: string, dateTo: string, granularity: Granularity): Bucket[] {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");

  if (granularity === "daily") {
    const buckets: Bucket[] = [];
    const d = new Date(from);
    while (d <= to) {
      buckets.push({
        label: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
        key: d.toISOString().split("T")[0],
        granularity: "daily",
      });
      d.setDate(d.getDate() + 1);
    }
    return buckets;
  }

  if (granularity === "weekly") {
    const buckets: Bucket[] = [];
    const startMonday = new Date(from);
    const day = startMonday.getDay();
    startMonday.setDate(startMonday.getDate() + (day === 0 ? -6 : 1 - day));
    const curr = new Date(startMonday);
    while (curr <= to) {
      buckets.push({
        label: curr.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
        key: curr.toISOString().split("T")[0],
        granularity: "weekly",
      });
      curr.setDate(curr.getDate() + 7);
    }
    return buckets;
  }

  // Monthly
  const buckets: Bucket[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const multiYear = diffDays > 400;

  while (start <= end) {
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      label: start.toLocaleDateString("en-CA", {
        month: "short",
        ...(multiYear ? { year: "2-digit" } : {}),
      }),
      key,
      granularity: "monthly",
    });
    start.setMonth(start.getMonth() + 1);
  }

  return buckets.length > 24 ? buckets.slice(-24) : buckets;
}

function getDefaultGranularity(dateFrom: string, dateTo: string): Granularity {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (diffDays <= 14) return "daily";
  if (diffDays <= 90) return "weekly";
  return "monthly";
}

function getTrendTitle(granularity: Granularity, dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (granularity === "daily") return diffDays === 1 ? "Daily trend" : `${diffDays}-day trend`;
  if (granularity === "weekly") return `${Math.ceil(diffDays / 7)}-week trend`;
  const months = Math.round(diffDays / 30.5);
  return months <= 24 ? `${months}-month trend` : "Trend overview";
}

const GRANULARITIES: { label: string; value: Granularity }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

export default function TrendChart({ clients, dateFrom, dateTo }: TrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>(() =>
    getDefaultGranularity(dateFrom, dateTo)
  );

  useEffect(() => {
    setGranularity(getDefaultGranularity(dateFrom, dateTo));
  }, [dateFrom, dateTo]);

  const buckets = getBuckets(dateFrom, dateTo, granularity);

  const data = buckets.map((bucket) => {
    let visits = 0;
    let newClients = 0;
    let totalSpend = 0;

    for (const client of clients) {
      for (const visit of client.visits ?? []) {
        if (visitMatchesBucket(visit.date, bucket)) {
          visits++;
          totalSpend += visit.spend ?? 0;
        }
      }

      const sortedDates = (client.visits ?? []).map((v) => v.date).sort();
      const firstDate = sortedDates[0];
      if (firstDate && visitMatchesBucket(firstDate, bucket)) newClients++;
    }

    return { label: bucket.label, visits, newClients, totalSpend };
  });

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="section-title">Trend</p>
        <p className="label" style={{ color: "var(--muted)" }}>No data for selected range</p>
      </div>
    );
  }

  const maxVisits = Math.max(...data.map((d) => d.visits), 1);
  const maxSpend = Math.max(...data.map((d) => d.totalSpend), 1);

  const svgH = 120;
  const svgW = 100;
  const totalW = svgW * data.length;
  const labelInterval = data.length <= 8 ? 1 : Math.ceil(data.length / 8);
  const minPxWidth = Math.max(300, data.length * 50);

  const visitPoints = data
    .map((d, i) => `${i * svgW + svgW / 2},${svgH - (d.visits / maxVisits) * (svgH - 16) - 4}`)
    .join(" ");

  const spendPoints = data
    .map((d, i) => `${i * svgW + svgW / 2},${svgH - (d.totalSpend / maxSpend) * (svgH - 16) - 4}`)
    .join(" ");

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p
          className="section-title"
          style={{ borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}
        >
          {getTrendTitle(granularity, dateFrom, dateTo)}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Granularity toggle */}
          <div className="flex gap-1">
            {GRANULARITIES.map((g) => (
              <button
                key={g.value}
                onClick={() => setGranularity(g.value)}
                className="btn"
                style={{
                  fontSize: "0.58rem",
                  padding: "0.15rem 0.45rem",
                  background: granularity === g.value ? "var(--ink)" : "transparent",
                  color: granularity === g.value ? "var(--paper)" : "var(--muted)",
                  borderColor: granularity === g.value ? "var(--ink)" : "var(--line)",
                }}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 14, height: 2, background: "var(--ink)" }} />
              <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>Visits</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{ width: 14, height: 2, background: "var(--vip)" }} />
              <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>Revenue</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderBottom: "1px solid var(--line)", marginBottom: "0.5rem" }} />

      {/* Scrollable chart */}
      <div style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <svg
          viewBox={`0 0 ${totalW} ${svgH + 20}`}
          style={{ display: "block", width: "100%", minWidth: `${minPxWidth}px`, overflow: "visible" }}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const y = svgH - frac * (svgH - 16) - 4;
            return (
              <line key={frac} x1={0} y1={y} x2={totalW} y2={y} stroke="var(--line)" strokeWidth={0.5} />
            );
          })}

          {/* Revenue line */}
          <polyline
            points={spendPoints}
            fill="none"
            stroke="var(--vip)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.7}
          />

          {/* Visit line */}
          <polyline
            points={visitPoints}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dots, value labels, axis labels, new-client bars */}
          {data.map((d, i) => {
            const x = i * svgW + svgW / 2;
            const visitY = svgH - (d.visits / maxVisits) * (svgH - 16) - 4;
            const showLabel = i % labelInterval === 0 || i === data.length - 1;

            return (
              <g key={i}>
                <circle cx={x} cy={visitY} r={3} fill="var(--ink)" />

                {d.visits > 0 && (
                  <text
                    x={x}
                    y={visitY - 7}
                    textAnchor="middle"
                    style={{ fontSize: 9, fontFamily: "Outfit, sans-serif", fill: "var(--ink)" }}
                  >
                    {d.visits}
                  </text>
                )}

                {showLabel && (
                  <text
                    x={x}
                    y={svgH + 14}
                    textAnchor="middle"
                    style={{
                      fontSize: 9,
                      fontFamily: "Outfit, sans-serif",
                      fill: "var(--muted)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {d.label}
                  </text>
                )}

                {d.newClients > 0 && (
                  <rect x={x - 6} y={svgH - 4} width={12} height={4} fill="var(--ink)" opacity={0.15} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Summary table for small bucket counts */}
      {data.length <= 12 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, gap: "0.25rem" }}
        >
          {data.map((d, i) => (
            <div key={i} className="flex flex-col gap-0.5 text-center">
              <span className="label" style={{ color: "var(--ink)", fontSize: "0.6rem" }}>{d.label}</span>
              {d.newClients > 0 && (
                <span className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>
                  +{d.newClients} new
                </span>
              )}
              {d.totalSpend > 0 && (
                <span className="label" style={{ color: "var(--vip)", fontSize: "0.5rem" }}>
                  ${(d.totalSpend / 1000).toFixed(1)}k
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
