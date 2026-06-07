"use client";

import { useState } from "react";
import type { Branch } from "@/lib/types";
import { BRANCHES } from "@/lib/types";

const BRANCH_COLORS: Record<Branch, string> = {
  "Victoria": "#0a0a0a",
  "Surrey - Guildford": "#d4ad53",
  "Surrey - Central City": "#1f5a32",
  "Burnaby": "#8a5a1f",
  "Tsawwassen Mills": "#6b6b66",
  "Calgary": "#8a1f1f",
};

interface DonutChartProps {
  revenueByBranch: Partial<Record<Branch, number>>;
  clientsByBranch: Partial<Record<Branch, number>>;
  activeBranch: Branch | "All";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  R: number,
  ri: number,
  startDeg: number,
  endDeg: number
): string {
  const gap = 1.2;
  const s = startDeg + gap / 2;
  const e = endDeg - gap / 2;
  if (e <= s) return "";

  const so = polarToCartesian(cx, cy, R, s);
  const eo = polarToCartesian(cx, cy, R, e);
  const si = polarToCartesian(cx, cy, ri, e);
  const ei = polarToCartesian(cx, cy, ri, s);
  const large = e - s > 180 ? 1 : 0;

  return [
    `M ${so.x.toFixed(2)} ${so.y.toFixed(2)}`,
    `A ${R} ${R} 0 ${large} 1 ${eo.x.toFixed(2)} ${eo.y.toFixed(2)}`,
    `L ${si.x.toFixed(2)} ${si.y.toFixed(2)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${ei.x.toFixed(2)} ${ei.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export default function DonutChart({
  revenueByBranch,
  clientsByBranch,
  activeBranch,
}: DonutChartProps) {
  const [hovered, setHovered] = useState<Branch | null>(null);

  const totalRevenue = BRANCHES.reduce((s, b) => s + (revenueByBranch[b] ?? 0), 0);
  const totalClients = BRANCHES.reduce((s, b) => s + (clientsByBranch[b] ?? 0), 0);

  const hasAnyRevenue = totalRevenue > 0;

  interface Segment {
    branch: Branch;
    revenue: number;
    clients: number;
    pct: number;
    startDeg: number;
    endDeg: number;
    isPhantom: boolean;
  }

  const segments: Segment[] = [];
  let cursor = 0;

  if (!hasAnyRevenue) {
    BRANCHES.forEach((b, idx) => {
      segments.push({
        branch: b,
        revenue: 0,
        clients: clientsByBranch[b] ?? 0,
        pct: 100 / BRANCHES.length,
        startDeg: idx * 60,
        endDeg: (idx + 1) * 60,
        isPhantom: true,
      });
    });
  } else {
    const PHANTOM_DEG = 3.6;
    const zeroBranches = BRANCHES.filter((b) => !revenueByBranch[b]);
    const revenueTotal = BRANCHES.reduce((s, b) => s + (revenueByBranch[b] ?? 0), 0);
    const reservedDeg = zeroBranches.length * PHANTOM_DEG;
    const activeDeg = 360 - reservedDeg;

    BRANCHES.forEach((b) => {
      const rev = revenueByBranch[b] ?? 0;
      const span = rev === 0 ? PHANTOM_DEG : (rev / revenueTotal) * activeDeg;
      segments.push({
        branch: b,
        revenue: rev,
        clients: clientsByBranch[b] ?? 0,
        pct: revenueTotal > 0 ? (rev / revenueTotal) * 100 : 0,
        startDeg: cursor,
        endDeg: cursor + span,
        isPhantom: rev === 0,
      });
      cursor += span;
    });
  }

  // Thicker donut: R=80, ri=52, viewBox 172×172 (cx=cy=86, 6px padding)
  const cx = 86;
  const cy = 86;
  const R = 80;
  const ri = 52;

  return (
    <div className="donut-chart-container flex flex-col items-center gap-5" style={{ maxWidth: 320, width: "100%" }}>
      <div style={{ position: "relative", width: 172, height: 172 }}>
        <svg viewBox="0 0 172 172" width="172" height="172">
          {segments.map((seg) => {
            const color = seg.isPhantom ? "var(--line)" : BRANCH_COLORS[seg.branch];
            const isActive = activeBranch === "All" || activeBranch === seg.branch;
            const isHovered = hovered === seg.branch;
            const path = arcPath(cx, cy, R, ri, seg.startDeg, seg.endDeg);
            if (!path) return null;

            return (
              <path
                key={seg.branch}
                d={path}
                fill={color}
                opacity={!isActive ? 0.15 : isHovered ? 1 : 0.88}
                style={{
                  cursor: "pointer",
                  transition: "opacity 0.15s, transform 0.1s",
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHovered ? "scale(1.03)" : "scale(1)",
                }}
                onMouseEnter={() => setHovered(seg.branch)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {/* Center text */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
            width: ri * 1.5,
          }}
        >
          {hovered ? (
            <>
              <p
                className="font-serif"
                style={{ fontSize: "1rem", fontWeight: 300, color: "var(--ink)", lineHeight: 1.1 }}
              >
                ${(revenueByBranch[hovered] ?? 0).toLocaleString()}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-outfit), system-ui, sans-serif",
                  fontSize: "0.5rem",
                  fontWeight: 500,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                {segments.find((s) => s.branch === hovered)?.pct.toFixed(1)}%
              </p>
            </>
          ) : (
            <>
              <p
                className="font-serif"
                style={{ fontSize: "1rem", fontWeight: 300, color: "var(--ink)", lineHeight: 1.1 }}
              >
                ${totalRevenue.toLocaleString()}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-outfit), system-ui, sans-serif",
                  fontSize: "0.5rem",
                  fontWeight: 500,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                {totalClients} clients
              </p>
            </>
          )}
        </div>
      </div>

      {/* Legend — vertical bar + branch name + revenue + % */}
      <div className="flex flex-col w-full" style={{ gap: 0 }}>
        {segments.map((seg) => {
          const isActive = activeBranch === "All" || activeBranch === seg.branch;
          const barColor = seg.isPhantom ? "var(--line)" : BRANCH_COLORS[seg.branch];
          const isZero = seg.revenue === 0;

          return (
            <div
              key={seg.branch}
              className="flex items-center justify-between"
              style={{
                borderBottom: "1px solid var(--line)",
                padding: "0.55rem 0",
                opacity: isActive ? (isZero ? 0.4 : 1) : 0.25,
                cursor: "default",
              }}
              onMouseEnter={() => setHovered(seg.branch)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-2">
                {/* Vertical bar instead of square dot */}
                <span
                  style={{
                    width: 3,
                    height: 16,
                    background: barColor,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-outfit), system-ui, sans-serif",
                    fontSize: "0.65rem",
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink)",
                  }}
                >
                  {seg.branch}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="font-serif"
                  style={{ fontSize: "0.9rem", fontWeight: 400, color: isZero ? "var(--muted)" : "var(--ink)" }}
                >
                  {isZero ? "—" : `$${seg.revenue.toLocaleString()}`}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-outfit), system-ui, sans-serif",
                    fontSize: "0.6rem",
                    color: "var(--muted)",
                    minWidth: "2.5rem",
                    textAlign: "right",
                  }}
                >
                  {isZero ? "—" : `${seg.pct.toFixed(0)}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
