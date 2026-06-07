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
}

interface DataPoint {
  label: string;
  visits: number;
  newClients: number;
  totalSpend: number;
}

function getBuckets(dateFrom: string, dateTo: string): Bucket[] {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const multiYear = diffDays > 400;

  const buckets: Bucket[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (start <= end) {
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      label: start.toLocaleDateString("en-CA", {
        month: "short",
        ...(multiYear ? { year: "2-digit" } : {}),
      }),
      key,
    });
    start.setMonth(start.getMonth() + 1);
  }

  return buckets.length > 24 ? buckets.slice(-24) : buckets;
}

function getTrendTitle(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const months = Math.round(diffDays / 30.5);
  return months <= 24 ? `${months}-month trend` : "Trend overview";
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function formatRevenue(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

export default function TrendChart({ clients, dateFrom, dateTo }: TrendChartProps) {
  const buckets = getBuckets(dateFrom, dateTo);

  const allData: DataPoint[] = buckets.map((bucket) => {
    let visits = 0;
    let newClients = 0;
    let totalSpend = 0;

    for (const client of clients) {
      for (const visit of client.visits ?? []) {
        if (visit.date.startsWith(bucket.key)) {
          visits++;
          totalSpend += visit.spend ?? 0;
        }
      }
      const sortedDates = (client.visits ?? []).map((v) => v.date).sort();
      const firstDate = sortedDates[0];
      if (firstDate && firstDate.startsWith(bucket.key)) newClients++;
    }

    return { label: bucket.label, visits, newClients, totalSpend };
  });

  const data = allData.slice(-7);

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="section-title">Trend</p>
        <p className="label" style={{ color: "var(--muted)" }}>No data for selected range</p>
      </div>
    );
  }

  const maxVisits = Math.max(...data.map((d) => d.visits), 1);
  const maxRevenue = Math.max(...data.map((d) => d.totalSpend), 1);

  const svgH = 160;
  const labelH = 24;
  const rightPad = 52;
  const colW = 80;
  const totalW = colW * data.length + rightPad;

  function visitY(v: number): number {
    return svgH - (v / maxVisits) * (svgH - 24) - 12;
  }

  function revenueY(r: number): number {
    return svgH - (r / maxRevenue) * (svgH - 24) - 12;
  }

  const visitPoints = data.map((d, i) => ({ x: i * colW + colW / 2, y: visitY(d.visits) }));
  const revenuePoints = data.map((d, i) => ({
    x: i * colW + colW / 2,
    y: revenueY(d.totalSpend),
  }));

  const visitPath = smoothPath(visitPoints);
  const revenuePath = smoothPath(revenuePoints);

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p
          className="section-title"
          style={{ borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}
        >
          {getTrendTitle(dateFrom, dateTo)}
        </p>

        {/* Legend */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 14, height: 2, background: "var(--ink)" }} />
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              Visits
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 14, height: 2, background: "#d4ad53" }} />
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              Revenue
            </span>
          </div>
        </div>
      </div>

      <div style={{ borderBottom: "1px solid var(--line)" }} />

      {/* Scrollable SVG */}
      <div
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        <svg
          viewBox={`0 0 ${totalW} ${svgH + labelH}`}
          style={{
            display: "block",
            width: "100%",
            minWidth: `${Math.max(320, data.length * 70)}px`,
            overflow: "visible",
          }}
        >
          {/* Grid lines at 25%, 50%, 75% */}
          {[0.25, 0.5, 0.75].map((frac) => {
            const y = visitY(frac * maxVisits);
            return (
              <line
                key={frac}
                x1={0}
                y1={y}
                x2={totalW - rightPad}
                y2={y}
                stroke="var(--line)"
                strokeWidth={0.5}
              />
            );
          })}

          {/* Revenue bezier curve */}
          {revenuePath && (
            <path
              d={revenuePath}
              fill="none"
              stroke="#d4ad53"
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* Visit bezier curve */}
          {visitPath && (
            <path
              d={visitPath}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}

          {/* Dots and value labels */}
          {data.map((d, i) => {
            const vx = visitPoints[i].x;
            const vy = visitPoints[i].y;
            const rx = revenuePoints[i].x;
            const ry = revenuePoints[i].y;

            return (
              <g key={i}>
                <circle cx={vx} cy={vy} r={4} fill="var(--ink)" />
                {d.visits > 0 && (
                  <text
                    x={vx}
                    y={vy - 9}
                    textAnchor="middle"
                    fontFamily="Outfit, system-ui, sans-serif"
                    fontSize={9}
                    fill="var(--ink)"
                  >
                    {d.visits}
                  </text>
                )}

                <circle cx={rx} cy={ry} r={3} fill="#d4ad53" />
                {d.totalSpend > 0 && (
                  <text
                    x={rx}
                    y={ry - 9}
                    textAnchor="middle"
                    fontFamily="Outfit, system-ui, sans-serif"
                    fontSize={8}
                    fill="#d4ad53"
                  >
                    {formatRevenue(d.totalSpend)}
                  </text>
                )}

                <text
                  x={vx}
                  y={svgH + labelH - 4}
                  textAnchor="middle"
                  fontFamily="Outfit, system-ui, sans-serif"
                  fontSize={9}
                  fill="var(--muted)"
                >
                  {d.label}
                </text>
              </g>
            );
          })}

          {/* Right axis: max, mid, $0 */}
          {[
            { label: formatRevenue(maxRevenue), y: revenueY(maxRevenue) },
            { label: formatRevenue(maxRevenue / 2), y: revenueY(maxRevenue / 2) },
            { label: "$0", y: revenueY(0) },
          ].map(({ label, y }) => (
            <text
              key={label}
              x={totalW - rightPad + 6}
              y={y + 3}
              textAnchor="start"
              fontFamily="Outfit, system-ui, sans-serif"
              fontSize={8}
              fill="#d4ad53"
              opacity={0.7}
            >
              {label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
