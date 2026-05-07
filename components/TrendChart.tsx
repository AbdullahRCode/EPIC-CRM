"use client";

import type { Client } from "@/lib/types";

interface TrendChartProps {
  clients: Client[];
}

function getMonthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toLocaleDateString("en-CA", { month: "short" });
}

function getMonthKey(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TrendChart({ clients }: TrendChartProps) {
  // Build 6-month visit + spend data
  const months = Array.from({ length: 6 }, (_, i) => 5 - i);

  const data = months.map((offset) => {
    const key = getMonthKey(offset);
    const label = getMonthLabel(offset);

    let visits = 0;
    let newClients = 0;
    let totalSpend = 0;

    for (const client of clients) {
      for (const visit of client.visits ?? []) {
        if (visit.date.startsWith(key)) {
          visits++;
          totalSpend += visit.spend ?? 0;
        }
      }
      const createdKey = client.created_at.substring(0, 7);
      if (createdKey === key) newClients++;
    }

    return { label, visits, newClients, totalSpend };
  });

  const maxVisits = Math.max(...data.map((d) => d.visits), 1);
  const maxSpend = Math.max(...data.map((d) => d.totalSpend), 1);

  const svgH = 120;
  const svgW = 100; // viewBox units per segment
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="section-title" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}>
          6-month trend
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 2, background: "var(--ink)" }} />
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>Visits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 2, background: "var(--vip)" }} />
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>Revenue</span>
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

          return (
            <g key={i}>
              {/* Visit dot */}
              <circle cx={x} cy={visitY} r={3} fill="var(--ink)" />

              {/* Visit count */}
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

              {/* Month label */}
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

              {/* New clients bar */}
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

      {/* Monthly summary table */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: "0.5rem" }}
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
    </div>
  );
}
