"use client";

import type { Client } from "@/lib/types";

interface TrendChartProps {
  clients: Client[];
  dateFrom: string;
  dateTo: string;
}

interface Bucket {
  label: string;
  key: string;
  isDay: boolean;
}

function getBuckets(dateFrom: string, dateTo: string): Bucket[] {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

  if (diffDays <= 31) {
    // Daily buckets
    const buckets: Bucket[] = [];
    const d = new Date(from);
    for (let i = 0; i < diffDays; i++) {
      buckets.push({
        label: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
        key: d.toISOString().split("T")[0],
        isDay: true,
      });
      d.setDate(d.getDate() + 1);
    }
    return buckets;
  }

  // Monthly buckets
  const buckets: Bucket[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const multiYear = diffDays > 400;

  while (start <= end) {
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      label: start.toLocaleDateString("en-CA", {
        month: "short",
        ...(multiYear ? { year: "2-digit" } : {}),
      }),
      key,
      isDay: false,
    });
    start.setMonth(start.getMonth() + 1);
  }

  // Cap at 24 most recent months to prevent chart overcrowding
  return buckets.length > 24 ? buckets.slice(-24) : buckets;
}

function getTrendTitle(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (diffDays === 1) return "Daily trend";
  if (diffDays <= 31) return `${diffDays}-day trend`;
  const months = Math.round(diffDays / 30.5);
  if (months <= 24) return `${months}-month trend`;
  return "Trend overview";
}

export default function TrendChart({ clients, dateFrom, dateTo }: TrendChartProps) {
  const buckets = getBuckets(dateFrom, dateTo);

  const data = buckets.map((bucket) => {
    let visits = 0;
    let newClients = 0;
    let totalSpend = 0;

    for (const client of clients) {
      for (const visit of client.visits ?? []) {
        const matches = bucket.isDay
          ? visit.date === bucket.key
          : visit.date.startsWith(bucket.key);
        if (matches) {
          visits++;
          totalSpend += visit.spend ?? 0;
        }
      }
      const createdKey = bucket.isDay
        ? client.created_at.split("T")[0]
        : client.created_at.substring(0, 7);
      if (createdKey === bucket.key) newClients++;
    }

    return { label: bucket.label, visits, newClients, totalSpend };
  });

  const maxVisits = Math.max(...data.map((d) => d.visits), 1);
  const maxSpend = Math.max(...data.map((d) => d.totalSpend), 1);

  const svgH = 120;
  const svgW = 100;
  const totalW = svgW * data.length;

  const visitPoints = data
    .map((d, i) => {
      const x = i * svgW + svgW / 2;
      const y = svgH - (d.visits / maxVisits) * (svgH - 16) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  const spendPoints = data
    .map((d, i) => {
      const x = i * svgW + svgW / 2;
      const y = svgH - (d.totalSpend / maxSpend) * (svgH - 16) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  // Show at most ~12 axis labels to prevent crowding
  const labelInterval = Math.ceil(data.length / 12);

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="section-title">Trend</p>
        <p className="label" style={{ color: "var(--muted)" }}>No data for selected range</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p
          className="section-title"
          style={{ borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}
        >
          {getTrendTitle(dateFrom, dateTo)}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 2, background: "var(--ink)" }} />
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              Visits
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 2, background: "var(--vip)" }} />
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              Revenue
            </span>
          </div>
        </div>
      </div>

      <div style={{ borderBottom: "1px solid var(--line)", marginBottom: "1rem" }} />

      <svg
        viewBox={`0 0 ${totalW} ${svgH + 20}`}
        style={{ width: "100%", overflow: "visible" }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = svgH - frac * (svgH - 16) - 4;
          return (
            <line
              key={frac}
              x1={0}
              y1={y}
              x2={totalW}
              y2={y}
              stroke="var(--line)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Spend line */}
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

        {/* Dots + labels */}
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
                  style={{
                    fontSize: 9,
                    fontFamily: "Outfit, sans-serif",
                    fill: "var(--ink)",
                  }}
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
                <rect
                  x={x - 6}
                  y={svgH - 4}
                  width={12}
                  height={4}
                  fill="var(--ink)"
                  opacity={0.15}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Summary table — only when bucket count is manageable */}
      {data.length <= 12 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: "0.5rem" }}
        >
          {data.map((d, i) => (
            <div key={i} className="flex flex-col gap-0.5 text-center">
              <span className="label" style={{ color: "var(--ink)", fontSize: "0.6rem" }}>
                {d.label}
              </span>
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
