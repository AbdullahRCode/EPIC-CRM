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
  const gap = 1.2; // degrees gap between segments
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

  // Build segment data — branches with $0 get a thin phantom 1% slice
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
    // Equal slices if no revenue at all
    BRANCHES.forEach((b, idx) => {
      const startDeg = idx * 60;
      const endDeg = startDeg + 60;
      segments.push({
        branch: b,
        revenue: 0,
        clients: clientsByBranch[b] ?? 0,
        pct: 100 / BRANCHES.length,
        startDeg,
        endDeg,
        isPhantom: true,
      });
    });
  } else {
    // Allocate degrees: branches with $0 get 1% of 360 = 3.6 degrees
    const PHANTOM_DEG = 3.6;
    const zeroBranches = BRANCHES.filter((b) => !revenueByBranch[b]);
    const revenueTotal = BRANCHES.reduce((s, b) => s + (revenueByBranch[b] ?? 0), 0);
    const reservedDeg = zeroBranches.length * PHANTOM_DEG;
    const activeDeg = 360 - reservedDeg;

    BRANCHES.forEach((b) => {
      const rev = revenueByBranch[b] ?? 0;
      let span: number;
      if (rev === 0) {
        span = PHANTOM_DEG;
      } else {
        span = (rev / revenueTotal) * activeDeg;
      }
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

  const cx = 80;
  const cy = 80;
  const R = 72;
  const ri = 46;

  return (
    <div className="donut-chart-container flex flex-col items-center gap-5" style={{ maxWidth: 320 }}>
      <div style={{ position: "relative", width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" width="160" height="160">
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
                opacity={!isActive ? 0.18 : isHovered ? 1 : 0.9}
                style={{
                  cursor: "pointer",
                  transition: "opacity 0.15s, transform 0.1s",
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHovered ? "scale(1.04)" : "scale(1)",
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
          }}
        >
          {hovered ? (
            <>
              <p
                className="font-serif"
                style={{ fontSize: "0.95rem", fontWeight: 400, color: "var(--ink)" }}
              >
                ${(revenueByBranch[hovered] ?? 0).toLocaleString()}
              </p>
              <p className="label" style={{ fontSize: "0.48rem", color: "var(--muted)" }}>
                {segments.find((s) => s.branch === hovered)?.pct.toFixed(1)}%
              </p>
            </>
          ) : (
            <>
              <p
                className="font-serif"
                style={{ fontSize: "1rem", fontWeight: 400, color: "var(--ink)" }}
              >
                ${totalRevenue.toLocaleString()}
              </p>
              <p className="label" style={{ fontSize: "0.48rem", color: "var(--muted)" }}>
                {totalClients} clients
              </p>
            </>
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="label"
          style={{
            fontSize: "0.6rem",
            color: "var(--ink)",
            textAlign: "center",
            letterSpacing: "0.12em",
          }}
        >
          {hovered}
          {" · "}
          {clientsByBranch[hovered] ?? 0} clients
          {" · "}
          {segments.find((s) => s.branch === hovered)?.pct.toFixed(1)}%
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-col gap-2 w-full">
        {segments.map((seg) => {
          const isActive = activeBranch === "All" || activeBranch === seg.branch;
          const color = seg.isPhantom ? "var(--line)" : BRANCH_COLORS[seg.branch];
          return (
            <div
              key={seg.branch}
              className="flex items-center justify-between"
              style={{ opacity: isActive ? 1 : 0.35 }}
              onMouseEnter={() => setHovered(seg.branch)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: color,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                <span className="label" style={{ color: "var(--ink)", letterSpacing: "0.1em" }}>
                  {seg.branch}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="label" style={{ color: "var(--muted)" }}>
                  ${seg.revenue.toLocaleString()}
                </span>
                <span className="label" style={{ color: "var(--muted)", minWidth: "2.5rem", textAlign: "right" }}>
                  {seg.isPhantom ? "—" : `${seg.pct.toFixed(0)}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
